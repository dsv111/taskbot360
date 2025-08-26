import { CommonModule } from '@angular/common';
import { AfterViewChecked, Component, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AiService } from '../../app/core/ai.service';
import { TicketAnalysis } from '../../../src/app/core/ticket-analysis.model';
import { Router } from '@angular/router';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.css'
})
export class ChatComponent implements AfterViewChecked {
  messages: { text: string, type: 'user' | 'bot' | 'extracted', ticketId?: string }[] = [];
  @ViewChild('chatContainer') private chatContainer!: ElementRef;
  userInput = '';
  loading = false;
  user: any = null;
  private currentTicketId: string | null = null;

  private scrollToBottom(): void {
    try {
      this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
    } catch (err) {}
  }

  constructor(private ai: AiService, private router: Router) {}

  ngOnInit() {
    const storedUser = sessionStorage.getItem("loggedInUser");
    if (!storedUser) {
      this.router.navigate(['/login']);
    } else {
      this.user = JSON.parse(storedUser);
    }
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  goToHome() {
    this.router.navigate(['/home']);
  }

  logout() {
    sessionStorage.removeItem("loggedInUser");
    this.user = null;
    this.router.navigate(['/login']);
  }

  async sendMessage() {
    const text = this.userInput.trim();
    if (!text || this.loading) return;

    this.messages.push({ text, type: 'user', ticketId: this.currentTicketId ?? undefined });
    this.userInput = '';
    this.loading = true;

    try {
      // Get conversation history for intent detection
      const history = this.messages.slice(-5).map(m => `${m.type}: ${m.text}`).join('\n');
      
      // Detect if this is a follow-up or new ticket
      const intent = await this.ai.detectIntent(text, history);

      if (intent === 'clarification' && this.currentTicketId) {
        // Handle clarification
        const lastBotMessage = this.messages
          .slice()
          .reverse()
          .find(m => m.type === 'bot' && m.ticketId === this.currentTicketId);

        if (lastBotMessage) {
          const reply = await this.ai.clarifyResponse(text, lastBotMessage.text, history, this.currentTicketId);
          this.messages.push({ text: reply, type: 'bot', ticketId: this.currentTicketId });
        } else {
          this.messages.push({
            text: '⚠️ No previous analysis found to clarify. Please provide a new ticket.',
            type: 'bot',
            ticketId: this.currentTicketId ?? undefined
          });
        }
      } else {
        // New ticket analysis
        const ticketId = Date.now().toString();
        this.currentTicketId = ticketId;
        const analysis: TicketAnalysis = await this.ai.analyzeTicket(text);
        const reply = this.ai.formatForChat(analysis);
        this.messages.push({ text: reply, type: 'bot', ticketId });
      }
    } catch (e) {
      console.error(e);
      this.messages.push({
        text: '⚠️ Sorry, I could not process that. Please try again.',
        type: 'bot',
        ticketId: this.currentTicketId ?? undefined
      });
    } finally {
      this.loading = false;
    }
  }

  async onImageUpload(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    this.loading = true;
    const reader = new FileReader();

    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        const text = await this.ai.extractTextFromImage(base64);

        if (text) {
          this.userInput = text;
          this.messages.push({ text, type: 'extracted', ticketId: this.currentTicketId ?? undefined });
        } else {
          this.messages.push({
            text: "⚠️ Couldn't extract any text from the image.",
            type: 'bot',
            ticketId: this.currentTicketId ?? undefined
          });
        }
      } catch (e) {
        console.error(e);
        this.messages.push({
          text: '⚠️ Error while extracting text from image.',
          type: 'bot',
          ticketId: this.currentTicketId ?? undefined
        });
      } finally {
        this.loading = false;
      }
    };

    reader.readAsDataURL(file);
  }

  onPlusClick() {
  this.messages = []; // Clear current chat
  this.currentTicketId = null; // Reset ticket ID
  this.userInput = ''; // Clear input
  console.log('New chat started.');
}
}