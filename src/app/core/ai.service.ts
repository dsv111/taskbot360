import { Injectable } from '@angular/core';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { environment } from '../../environments/environment';
import { TicketAnalysis } from './ticket-analysis.model';

@Injectable({ providedIn: 'root' })
export class AiService {
  private genAI = new GoogleGenerativeAI(environment.geminiApiKey);

  // System-style guidance + schema instruction
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
  "estimate": { "unit": "hours|days", "value": 1, "confidence": 0.0, "notes": "..." }
}

Classification hints:
- Frontend: UI, Angular/React, components, forms, CSS, accessibility, browser issues.
- Backend: APIs, services, business logic, auth, logging, performance.
- Database: schema, migrations, indexing, queries.
- QA: test plans, automation, regression, acceptance checks.
- DevOps: CI/CD, infra, env vars, observability, scaling.
- Security: authn/z, secrets, compliance, data protection.
- Data: ETL, analytics, reporting, exports.

Make the advice concrete and concise. Estimate conservatively for an average engineer.
User ticket:
"""${userText}"""`;
  }

  async analyzeTicket(userText: string): Promise<TicketAnalysis> {
    const model = this.genAI.getGenerativeModel({
      // Free & fast for MVP; you can switch to 1.5-pro later
      model: 'gemini-1.5-flash',
      // Ask Gemini to return JSON directly
      // (supported in newer SDKs; falls back to text if unavailable)
      generationConfig: {
        temperature: 0.3,
        topP: 0.9,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json'
      }
    });

    const prompt = this.buildPrompt(userText);
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    try {
      const parsed = JSON.parse(text) as TicketAnalysis;
      return parsed;
    } catch {
      // Fallback if model ignored JSON instruction
      return {
        category: 'other',
        summary: text.slice(0, 500),
        dos: [],
        donts: [],
        dependencies: [],
        scenarios: [],
        risks: [],
        outputs: [],
        estimate: { unit: 'hours', value: 4, confidence: 0.3, notes: 'Fallback (model returned non-JSON)' }
      };
    }
  }

  // Optional: format analysis to a readable message for the chat UI
  formatForChat(a: TicketAnalysis): string {
    const est = `${a.estimate.value} ${a.estimate.unit} (confidence ${(a.estimate.confidence * 100).toFixed(0)}%)`;
    const list = (arr: string[]) => arr?.length ? arr.map(i => `• ${i}`).join('\n') : '• —';
    return [
      `Category: ${a.category.toUpperCase()}`,
      `Estimate: ${est}`,
      ``,
      `Summary:\n${a.summary}`,
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
      `Deliverables:\n${list(a.outputs)}`
    ].join('\n');
  }
}
