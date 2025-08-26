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
    messages: { text: string, type: 'user' | 'bot' | 'extracted' }[] = [];


    @ViewChild('chatContainer') private chatContainer!: ElementRef;
    ngAfterViewChecked() {
      this.scrollToBottom();
    }
    userInput = '';
    loading = false;
    user: any = null;

    private scrollToBottom(): void {
      try {
        this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
      } catch (err) { }
    }

    constructor(private ai: AiService, private router: Router) { }

    ngOnInit() {
      // ✅ check session login
      const storedUser = sessionStorage.getItem("loggedInUser");
      if (!storedUser) {
        // not logged in → redirect
        this.router.navigate(['/login']);
      } else {
        this.user = JSON.parse(storedUser);
      }
    }

    goToHome() {
      this.router.navigate(['/home']);
    }

    logout() {
      // ✅ clear session only
      sessionStorage.removeItem("loggedInUser");
      this.user = null;
      this.router.navigate(['/login']);
    }

    async sendMessage() {
      const text = this.userInput.trim();
      if (!text || this.loading) return;

      this.messages.push({ text, type: 'user' });
      this.userInput = '';
      this.loading = true;

      try {
        const analysis: TicketAnalysis = await this.ai.analyzeTicket(text);
        const reply = this.ai.formatForChat(analysis);
        this.messages.push({ text: reply, type: 'bot' });
      } catch (e) {
        console.error(e);
        this.messages.push({
          text: '⚠️ Sorry, I could not analyze that. Please try again.',
          type: 'bot'
        });
      } finally {
        this.loading = false;
      }
    }


    async onImageUpload(event: any) {
      const file = event.target.files[0];
      if (!file) return;

      this.loading = true; // 🔹 start loader
      const reader = new FileReader();

      reader.onload = async () => {
        try {
          const base64 = reader.result as string;
          const text = await this.ai.extractTextFromImage(base64);

          if (text) {
            this.userInput = text;
            this.messages.push({ text, type: 'extracted' }); // OCR result message
          } else {
            this.messages.push({
              text: "⚠️ Couldn't extract any text from the image.",
              type: 'bot'
            });
          }
        } catch (e) {
          console.error(e);
          this.messages.push({
            text: '⚠️ Error while extracting text from image.',
            type: 'bot'
          });
        } finally {
          this.loading = false; // 🔹 ALWAYS stop loader here
        }
      };

      reader.readAsDataURL(file);
    }


  }