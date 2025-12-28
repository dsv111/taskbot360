import { CommonModule } from '@angular/common';
import {
  AfterViewChecked,
  Component,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AiService } from '../../app/core/ai.service';
import { TicketAnalysis } from '../../../src/app/core/ticket-analysis.model';
import { Router } from '@angular/router';
import { MarkdownModule } from 'ngx-markdown';
import { HttpClientModule } from '@angular/common/http';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule, MarkdownModule],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.css',
})
export class ChatComponent implements AfterViewChecked {
  messages: {
    text: string;
    type: 'user' | 'bot' | 'extracted' | 'code' | 'explanation';
    ticketId?: string;
  }[] = [];

  @ViewChild('chatContainer') private chatContainer!: ElementRef;
  userInput = '';
  loading = false;
  user: any = null;
  flag: boolean = false;
  private currentTicketId: string | null = null;
  lastAnalysis: TicketAnalysis | null = null;

  constructor(private ai: AiService, private router: Router) {}

  ngOnInit() {
    const storedUser = sessionStorage.getItem('loggedInUser');
    if (!storedUser) {
      this.router.navigate(['/login']);
    } else {
      this.user = JSON.parse(storedUser);
    }
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    try {
      this.chatContainer.nativeElement.scrollTop =
        this.chatContainer.nativeElement.scrollHeight;
    } catch {}
  }

  goToHome() {
    this.router.navigate(['/home']);
  }

  logout() {
    sessionStorage.removeItem('loggedInUser');
    this.user = null;
    this.router.navigate(['/login']);
  }

  async sendMessage() {
    const text = this.userInput.trim();
    if (!text || this.loading) return;

    this.messages.push({
      text,
      type: 'user',
      ticketId: this.currentTicketId ?? undefined,
    });
    this.userInput = '';
    this.flag = false;
    this.loading = true;

    try {
      const history = this.messages
        .slice(-5)
        .map((m) => `${m.type}: ${m.text}`)
        .join('\n');

      const intent = await this.ai.detectIntent(text, history);

      if (intent === 'clarification' && this.currentTicketId) {
        const lastBotMessage = this.messages
          .slice()
          .reverse()
          .find((m) => m.type === 'bot' && m.ticketId === this.currentTicketId);

        if (lastBotMessage) {
          const reply = await this.ai.clarifyResponse(
            text,
            lastBotMessage.text,
            history,
            this.currentTicketId
          );
          this.messages.push({
            text: reply,
            type: 'bot',
            ticketId: this.currentTicketId,
          });
        } else {
          this.messages.push({
            text: '⚠️ No previous analysis found to clarify. Please provide a new ticket.',
            type: 'bot',
            ticketId: this.currentTicketId ?? undefined,
          });
        }
      } else {
        const ticketId = Date.now().toString();
        this.currentTicketId = ticketId;
        const analysis: TicketAnalysis = await this.ai.analyzeTicket(text);
        this.lastAnalysis = analysis;
        const reply = this.ai.formatForChat(analysis);
        this.messages.push({ text: reply, type: 'bot', ticketId });
      }
    } catch (e) {
      console.error(e);
      this.messages.push({
        text: '⚠️ Sorry, I could not process that. Please try again.',
        type: 'bot',
        ticketId: this.currentTicketId ?? undefined,
      });
    } finally {
      this.loading = false;
    }
  }

  async onImageUpload(event: any, flag: boolean) {
    const file = event.target.files[0];
    if (!file) return;
    this.flag = flag;
    this.loading = true;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        const text = await this.ai.extractTextFromImage(base64);

        if (text) {
          this.userInput = text;
          this.messages.push({
            text,
            type: 'extracted',
            ticketId: this.currentTicketId ?? undefined,
          });
        } else {
          this.messages.push({
            text: "⚠️ Couldn't extract any text from the image.",
            type: 'bot',
            ticketId: this.currentTicketId ?? undefined,
          });
        }
      } catch (e) {
        console.error(e);
        this.messages.push({
          text: '⚠️ Error while extracting text from image.',
          type: 'bot',
          ticketId: this.currentTicketId ?? undefined,
        });
      } finally {
        this.loading = false;
      }
    };

    reader.readAsDataURL(file);
  }

  onPlusClick() {
    this.messages = [];
    this.currentTicketId = null;
    this.lastAnalysis = null;
    this.userInput = '';
    console.log('New chat started.');
  }

  /**
 * Converts AI explanation text into numbered HTML list
 */
private formatExplanationHtml(text: string): string {
  if (!text) return '';

  // Split text by numbered points like 1., 2., 3.
  const items = text.split(/\d+\.\s+/).filter(Boolean);

  if (items.length === 0) return text; // fallback to raw text

  let html = '<ol>';
  items.forEach(item => {
    // Trim and replace newlines inside each point with <br>
    const cleanItem = item.trim().replace(/\n/g, '<br>');
    html += `<li>${cleanItem}</li>`;
  });
  html += '</ol>';

  return html;
}


  /**
   * Request code & explanation and push nicely formatted markdown messages
   */
  async requestCodeImplementation() {
    if (this.loading || !this.lastAnalysis) return;

    this.loading = true;
    this.messages.push({
      text: 'Please provide the complete code and explanation for the last ticket.',
      type: 'user',
      ticketId: this.currentTicketId ?? undefined,
    });

    try {
      const codeData = await this.ai.getCodeImplementation(this.lastAnalysis);

      // format explanation into readable markdown
      const explanationHtml = this.formatExplanationHtml(
        codeData.explanation || ''
      );

      this.messages.push({
        text: explanationHtml || 'No explanation provided.',
        type: 'explanation',
        ticketId: this.currentTicketId ?? undefined,
      });

      // ensure code is in fenced block for syntax highlighting
      const codeMarkdown = this.wrapCodeInFences(
        codeData.code || '',
        this.lastAnalysis?.framework || 'other'
      );

      this.messages.push({
        text: codeMarkdown || '// No code provided.',
        type: 'code',
        ticketId: this.currentTicketId ?? undefined,
      });
    } catch (e) {
      console.error(e);
      this.messages.push({
        text: '⚠️ Sorry, I could not generate the code. Please try again.',
        type: 'bot',
        ticketId: this.currentTicketId ?? undefined,
      });
    } finally {
      this.loading = false;
    }
  }
  

  /**
   * Formats the explanation string into neat markdown.
   *
   * - If the AI already returned markdown (contains headings, bullets, or fenced code),
   *   return unchanged.
   * - Otherwise attempt to convert inline numbered content like:
   *     "1. First sentence. 2. Second sentence. 3. Third..."
   *   into a proper numbered list with paragraphs.
   */
  private formatExplanationMarkdown(text: string): string {
    if (!text) return '';

    const trimmed = text.trim();

    // Already markdown? If it has proper headers or fenced code, keep it.
    if (/^#{1,6}\s/m.test(trimmed) || /```/.test(trimmed)) {
      return trimmed;
    }

    // Break into items by numbered points (1., 2., etc.)
    const items = trimmed
      .split(/(?:\s|^)(\d+)\.\s+/)
      .filter((part) => part && !/^\d+$/.test(part));

    let md = '### Step-by-Step Explanation\n\n';

    items.forEach((item, idx) => {
      // Split into sentences for sub-bullets
      const sentences = item
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter(Boolean);

      if (sentences.length > 0) {
        // First sentence is usually the "title"
        const first = sentences.shift()!;
        md += `${idx + 1}. **${first}**\n`;
        sentences.forEach((s) => {
          md += `   - ${s}\n`;
        });
        md += '\n';
      }
    });

    return md.trim();
  }

  /**
   * Wrap code in fenced blocks for markdown. If AI already returned fenced code, keep it.
   */
  wrapCodeInFences(code: string, framework: string | null | undefined): string {
    const language = this.getLanguageForFramework(framework);
    return `\`\`\`${language}\n${code}\n\`\`\``;
  }

  getLanguageForFramework(framework: any): string {
    // Safety check: only call toLowerCase on strings
    if (typeof framework !== 'string') return '';
    const f = framework.toLowerCase();
    switch (f) {
      case 'angular':
        return 'typescript';
      case 'react':
        return 'javascript';
      case 'vue':
        return 'javascript';
      case 'java':
        return 'java';
      case 'python':
        return 'python';
      case 'c#':
        return 'csharp';
      default:
        return '';
    
  }

  }

  // Returns true when there's non-whitespace text in the input
  get inputHasText(): boolean {
    return !!this.userInput && this.userInput.trim().length > 0;
  }

  get canStartNewChat(): boolean {
    return this.messages.length > 0 || !!this.lastAnalysis || !!this.currentTicketId;
  }
}
