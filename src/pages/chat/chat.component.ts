import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
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
export class ChatComponent {
messages: { text: string, type: 'user' | 'bot' }[] = [];
  userInput = '';
  loading = false;

  constructor(private ai: AiService,private router:Router) {}
  goToHome() {
    this.router.navigate(['/home']);
  }

  logout() {
    // Assuming you have an AuthService to handle logout
    // Replace with your actual logout logic
    // For example: this.authService.logout();
    localStorage.clear(); // Example: Clear local storage
    this.router.navigate(['/login']); // Redirect to login page
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
      this.messages.push({ text: '⚠️ Sorry, I could not analyze that. Please try again.', type: 'bot' });
    } finally {
      this.loading = false;
    }
  }


}