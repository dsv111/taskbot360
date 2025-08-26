import { Injectable } from '@angular/core';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { environment } from '../../environments/environment';
import { TicketAnalysis } from './ticket-analysis.model';

@Injectable({ providedIn: 'root' })
export class AiService {
  private genAI = new GoogleGenerativeAI(environment.geminiApiKey);

  private buildPrompt(userText: string): string {
    return `
You are an expert software project analyst. Analyze the user's ticket/task text and
return a strict JSON object (no markdown, no code fences) with fields:

{
  "category": "frontend|backend|database|qa|devops|security|data|other",
  "summary": "one short paragraph",
  "dos": ["..."],
  "donts": ["..."],
  "dependencies": ["..."],
  "scenarios": ["..."],
  "risks": ["..."],
  "outputs": ["..."],
  "estimate": { "unit": "hours|days", "value": 1, "confidence": 0.0, "notes": "..." },
  "breakdown": [
    { "step": "task name", "unit": "hours|days", "value": 1 },
    { "step": "another task", "unit": "hours|days", "value": 2 }
  ]
}

Classification hints:
- Frontend: UI, Angular/React, components, forms, CSS, accessibility, browser issues.
- Backend: APIs, services, business logic, auth, logging, performance.
- Database: schema, migrations, indexing, queries.
- QA: test plans, automation, regression, acceptance checks.
- DevOps: CI/CD, infra, env vars, observability, scaling.
- Security: authn/z, secrets, compliance, data protection.
- Data: ETL, analytics, reporting, exports.

Make the advice concrete and concise. 
Ensure breakdown matches the total estimate (sum of breakdown = estimate.value).
User ticket:
"""${userText}"""`;
  }

  private buildClarificationPrompt(userQuestion: string, previousResponse: string, history: string, ticketId: string): string {
    return `
You are an expert software project analyst. The user has asked a follow-up question or seeks clarification about a previous ticket analysis. Below is the conversation history, previous analysis, and the user's question. Provide a concise, conversational response that directly addresses the user's question, referencing the previous analysis where relevant. Do not generate a new ticket analysis unless explicitly requested. Return plain text, not JSON or a full analysis format.

Conversation history (last few messages):
"""
${history}
"""

Previous analysis:
"""
${previousResponse}
"""

User's question:
"""
${userQuestion}
"""

Ticket ID: ${ticketId}
`;
  }

  private buildIntentPrompt(userInput: string, history: string): string {
    return `
Classify the user's input as either:
- "new_ticket": If it's a new task description, ticket, or unrelated to prior messages.
- "clarification": If it's a question, doubt, follow-up, or reference to previous analysis (e.g., asking about time, risks, or modifications).

Return ONLY the classification as plain text: "new_ticket" or "clarification". No explanations.

Conversation history (last few messages):
"""
${history}
"""

User input:
"""
${userInput}
"""`;
  }

  async detectIntent(userInput: string, history: string): Promise<'new_ticket' | 'clarification'> {
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.1, // Low for deterministic classification
        maxOutputTokens: 10,
        responseMimeType: 'text/plain',
      },
    });

    const prompt = this.buildIntentPrompt(userInput, history);
    const result = await model.generateContent(prompt);
    const intent = result.response.text().trim().toLowerCase();

    return intent.includes('clarification') ? 'clarification' : 'new_ticket';
  }
  async clarifyResponse(userQuestion: string, previousResponse: string, history: string, ticketId: string): Promise<string> {
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.5,
        topP: 0.9,
        maxOutputTokens: 512,
        responseMimeType: 'text/plain',
      },
    });

    const prompt = this.buildClarificationPrompt(userQuestion, previousResponse, history, ticketId);
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  }

  async analyzeTicket(userText: string): Promise<TicketAnalysis> {
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.3,
        topP: 0.9,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
      },
    });

    const prompt = this.buildPrompt(userText);
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    try {
      const parsed = JSON.parse(text) as TicketAnalysis;
      return parsed;
    } catch {
      return {
        category: 'other',
        summary: text.slice(0, 500),
        dos: [],
        donts: [],
        dependencies: [],
        scenarios: [],
        risks: [],
        outputs: [],
        estimate: {
          unit: 'hours',
          value: 4,
          confidence: 0.3,
          notes: 'Fallback (model returned non-JSON)',
        },
        breakdown: [{ step: 'General analysis', unit: 'hours', value: 4 }],
      };
    }
  }

  formatForChat(a: TicketAnalysis): string {
    const est = `${a.estimate.value} ${a.estimate.unit} (confidence ${(
      a.estimate.confidence * 100
    ).toFixed(0)}%)`;

    const list = (arr: string[]) =>
      arr?.length ? arr.map((i) => `• ${i.trim()}`).join('\n') : '• —';

    const breakdown = a.breakdown?.length
      ? a.breakdown.map((b) => `• ${b.step}: ${b.value} ${b.unit}`).join('\n')
      : '• —';

    const formattedSummary = a.summary
      ? a.summary
          .split(/\. +/)
          .filter((s) => s.trim().length > 0)
          .map((s) => `• ${s.trim()}.`)
          .join('\n')
      : '• —';

    return [
      `Category: ${a.category.toUpperCase()}`,
      `Estimate: ${est}`,
      ``,
      `Summary:\n${formattedSummary}`,
      ``,
      `Do's:\n${list(a.dos)}`,
      ``,
      `Don'ts:\n${list(a.donts)}`,
      ``,
      `Dependencies:\n${list(a.dependencies)}`,
      ``,
      `Scenarios to cover:\n${list(a.scenarios)}`,
      ``,
      `Risks:\n${list(a.risks)}`,
      ``,
      `Deliverables:\n${list(a.outputs)}`,
      ``,
      `Breakdown:\n${breakdown}`,
    ].join('\n');
  }

  async enhanceImage(base64Image: string): Promise<string> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
      });

      const result = await model.generateContent([
        {
          text: 'Remove the background from this image and return a clean, circular-ready headshot with transparent background (PNG).',
        },
        {
          inlineData: {
            mimeType: 'image/png',
            data: base64Image.split(',')[1],
          },
        },
      ]);

      const enhanced =
        result.response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (enhanced) {
        return `data:image/png;base64,${enhanced}`;
      }

      return base64Image;
    } catch (err) {
      console.error('Image enhancement failed:', err);
      return base64Image;
    }
  }

  async extractTextFromImage(base64Image: string): Promise<string> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
      });

      const result = await model.generateContent([
        {
          text: 'Extract all readable text from this image as plain text only. Do not summarize or rephrase.',
        },
        {
          inlineData: {
            mimeType: 'image/png',
            data: base64Image.split(',')[1],
          },
        },
      ]);

      return result.response.text().trim();
    } catch (err) {
      console.error('Text extraction failed:', err);
      return '';
    }
  }
}
