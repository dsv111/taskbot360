import { Injectable } from '@angular/core';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { environment } from '../../environments/environment';
import { TicketAnalysis } from './ticket-analysis.model';

// Interface for code implementation response
export interface CodeImplementation {
  code: string;
  explanation: string;
}

@Injectable({ providedIn: 'root' })
export class AiService {
  private genAI = new GoogleGenerativeAI(environment.geminiApiKey);

  /**
   * Build analysis prompt
   */
  private buildPrompt(userText: string): string {
    return `
You are an expert software project analyst. Analyze the user's ticket/task text and
return a strict JSON object (no markdown, no code fences) with fields:

{
  "category": "frontend|backend|database|qa|devops|security|data|other",
  "summary": "one short paragraph",
  "framework": "angular|react|vue|node|python|other",
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

REQUIREMENTS:
- **Return ONLY valid JSON** and nothing else (no explanation, no markdown, no code fences).
- **All fields MUST be present**. For unknown values use sensible defaults:
  - Strings: use \"unknown\".
  - Arrays: return an array; if no concrete items, include a placeholder like [\"No specific items provided\"].
  - Estimates: if unknown, set value: 0 and notes: \"unknown\".
- **'dos' and 'donts' MUST contain at least one item**. If there are no concrete recommendations, add a single item: \"No specific do's provided\" or \"No specific don'ts provided\" respectively.
- Ensure the \`breakdown\` sum equals \`estimate.value\`. Add notes in estimate if approximation was necessary.

Hints:
- Frontend: UI, Angular/React, components, forms, CSS, browser issues.
- Backend: APIs, services, business logic, auth, logging.
- Database: schema, queries, indexing.
- QA: automation, regression, test plans.
- DevOps: CI/CD, infra, scaling, monitoring.
- Security: auth, secrets, compliance.
- Data: ETL, analytics, reporting.

User ticket:
"""${userText}"""`;
  }

  /**
   * Build clarification prompt
   */
  private buildClarificationPrompt(
    userQuestion: string,
    previousResponse: string,
    history: string,
    ticketId: string
  ): string {
    return `
You are an expert software project analyst. The user asked a follow-up about a previous ticket.
Respond conversationally and concisely, referencing the previous analysis.

Conversation history:
${history}

Previous analysis:
${previousResponse}

User question:
${userQuestion}

Ticket ID: ${ticketId}
`;
  }

  /**
   * Build intent classification prompt
   */
  private buildIntentPrompt(userInput: string, history: string): string {
    return `
Classify as:
- "new_ticket": if describing a new task/ticket.
- "clarification": if it's a question/follow-up about prior analysis.

Return ONLY "new_ticket" or "clarification".

Conversation history:
${history}

User input:
${userInput}
`;
  }

  /**
   * Build code generation prompt
   */
  private buildCodePrompt(analysis: TicketAnalysis, framework: string): string {
    return `
You are a senior ${framework} engineer AND a software project tutor.
Based on this ticket analysis, generate a **complete runnable implementation** along with a **full, step-by-step explanation**.

Instructions for the explanation:
- Explain each step **clearly**, as if teaching a junior developer.
- Include reasoning behind **why each step is done**, not just "do this".
- Include potential pitfalls, common mistakes, and **how to avoid them**.
- Explain how each file and configuration relates to the project goal.
- Include **links to official documentation or references** (optional).
- Organize explanation in **numbered steps**, each step having multiple sentences if needed.
- Include code snippets inline **where necessary**.
- Avoid overly short bullet points. Give **rich context** for every step.

Return output ONLY inside the following markers:

<JSON_START>
{
  "code": "string with all sections + code fences",
  "explanation": "markdown explanation with detailed numbered steps"
}
<JSON_END>

Sections REQUIRED inside "code":
### 1) Prerequisites
### 2) Project Setup (scaffold & install)
### 3) File Tree
### 4) Source Files
### 5) Test(s)
### 6) Run & Build
### 7) Notes & Next Steps

Rules:
- Every file listed in file tree must appear in Source Files.
- No "..." — include full contents.
- Use placeholders (<API_BASE_URL>, <SECRET_KEY>) for secrets.
- At least one test + how to run it.
- Use idiomatic modern ${framework}.
- Valid JSON only (no markdown outside JSON).

Ticket analysis:
${JSON.stringify(analysis, null, 2)}
  `;
  }

  /**
   * Detect intent
   */
  async detectIntent(
    userInput: string,
    history: string
  ): Promise<'new_ticket' | 'clarification'> {
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      // generationConfig: {
      //   temperature: 0.1,
      //   maxOutputTokens: 10,
      //   responseMimeType: 'text/plain',
      // },
    });

    const result = await model.generateContent(
      this.buildIntentPrompt(userInput, history)
    );
    const intent = result.response.text().trim().toLowerCase();
    return intent.includes('clarification') ? 'clarification' : 'new_ticket';
  }

  /**
   * Clarification response
   */
  async clarifyResponse(
    userQuestion: string,
    previousResponse: string,
    history: string,
    ticketId: string
  ): Promise<string> {
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.5,
        topP: 0.9,
        maxOutputTokens: 512,
        responseMimeType: 'text/plain',
      },
    });

    const result = await model.generateContent(
      this.buildClarificationPrompt(
        userQuestion,
        previousResponse,
        history,
        ticketId
      )
    );
    return result.response.text().trim();
  }

  /**
   * Analyze a new ticket
   */
  async analyzeTicket(userText: string): Promise<TicketAnalysis> {
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.3,
        topP: 0.9,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
      },
    });

    const result = await model.generateContent(this.buildPrompt(userText));
    const text = result.response.text();

    try {
      const parsed = JSON.parse(text) as TicketAnalysis;
      /** Ensure required fields exist and insert placeholders when necessary */
      const ensureArray = (v: any, placeholder: string) =>
        Array.isArray(v) && v.length ? v : [placeholder];

      const analysis: Partial<TicketAnalysis> = { ...parsed };

      analysis.category = analysis.category || 'other';
      analysis.summary =
        analysis.summary || (userText ? userText.slice(0, 500) : 'unknown');
      analysis.framework = analysis.framework || 'other';
      analysis.dos = ensureArray(analysis.dos, "No specific do's provided");
      analysis.donts = ensureArray(analysis.donts, "No specific don'ts provided");
      analysis.dependencies = Array.isArray(analysis.dependencies)
        ? analysis.dependencies
        : [];
      analysis.scenarios = Array.isArray(analysis.scenarios) ? analysis.scenarios : [];
      analysis.risks = Array.isArray(analysis.risks) ? analysis.risks : [];
      analysis.outputs = Array.isArray(analysis.outputs) ? analysis.outputs : [];

      analysis.estimate = analysis.estimate || {
        unit: 'hours',
        value: 0,
        confidence: 0.0,
        notes: 'unknown',
      };
      // ensure estimate fields exist
      analysis.estimate.unit = analysis.estimate.unit || 'hours';
      analysis.estimate.value =
        typeof analysis.estimate.value === 'number'
          ? analysis.estimate.value
          : 0;
      analysis.estimate.confidence =
        typeof analysis.estimate.confidence === 'number'
          ? analysis.estimate.confidence
          : 0.0;
      analysis.estimate.notes = analysis.estimate.notes || 'unknown';

      analysis.breakdown = Array.isArray(analysis.breakdown) && analysis.breakdown.length
        ? analysis.breakdown
        : [{ step: 'General analysis', unit: 'hours', value: analysis.estimate.value || 0 }];

      // If dos/donts were missing and we inserted placeholders, add a quick note to estimate.notes
      if (
        (Array.isArray(parsed.dos) && parsed.dos.length === 0) ||
        !Array.isArray(parsed.dos) ||
        (Array.isArray(parsed.donts) && parsed.donts.length === 0) ||
        !Array.isArray(parsed.donts)
      ) {
        analysis.estimate.notes =
          (analysis.estimate.notes || '') +
          ' (dos/donts were missing and placeholders inserted)';
      }

      return analysis as TicketAnalysis;
    } catch {
      return {
        category: 'other',
        summary: text.slice(0, 500),
        framework: 'other',
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
          notes: 'Fallback (invalid JSON)',
        },
        breakdown: [{ step: 'General analysis', unit: 'hours', value: 4 }],
      };
    }
  }

  /**
   * Get code implementation
   */
  async getCodeImplementation(
    analysis: TicketAnalysis
  ): Promise<CodeImplementation> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.3,
          topP: 0.9,
          maxOutputTokens: 6144,
          responseMimeType: 'text/plain',
        },
      });

      const prompt = this.buildCodePrompt(analysis, analysis.framework);

      const result = await model.generateContent(prompt);
      const response = await result.response;
      let text = response.text().trim();

      // 🔹 1. Try <JSON_START> ... <JSON_END>
      let match = text.match(/<JSON_START>([\s\S]*?)<JSON_END>/);
      if (match) {
        text = match[1].trim();
      }

      // 🔹 2. Strip markdown fences like ```json ... ```
      text = text
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();

      // 🔹 3. Fallback: extract first {...} block
      if (!text.startsWith('{')) {
        const braceMatch = text.match(/\{[\s\S]*\}/);
        if (braceMatch) {
          text = braceMatch[0];
        }
      }

      return JSON.parse(text) as CodeImplementation;
    } catch (error) {
      console.error('Error generating code implementation:', error);
      return {
        code: '// Sorry, I could not generate the code. Please try again.',
        explanation:
          'There was an error while generating the code implementation.',
      };
    }
  }

  /**
   * Format analysis for chat display
   */
  formatForChat(a: TicketAnalysis): string {
    const est = `${a.estimate.value} ${a.estimate.unit} (confidence ${(
      a.estimate.confidence * 100
    ).toFixed(0)}%)`;

    const list = (arr: string[]) =>
      arr?.length ? arr.map((i) => `• ${i}`).join('\n') : '• —';

    const breakdown = a.breakdown?.length
      ? a.breakdown.map((b) => `• ${b.step}: ${b.value} ${b.unit}`).join('\n')
      : '• —';

    const summary = a.summary
      ? a.summary
          .split(/\. +/)
          .filter(Boolean)
          .map((s) => `• ${s.trim()}.`)
          .join('\n')
      : '• —';

    return [
      `Category: ${a.category.toUpperCase()}`,
      `Estimate: ${est}`,
      ``,
      `Summary:\n${summary}`,
      ``,
      `Do's:\n${list(a.dos)}`,
      ``,
      `Don'ts:\n${list(a.donts)}`,
      ``,
      `Dependencies:\n${list(a.dependencies)}`,
      ``,
      `Scenarios:\n${list(a.scenarios)}`,
      ``,
      `Risks:\n${list(a.risks)}`,
      ``,
      `Deliverables:\n${list(a.outputs)}`,
      ``,
      `Breakdown:\n${breakdown}`,
    ].join('\n');
  }

  /**
   * Image enhancement (optional feature)
   */
  async enhanceImage(base64Image: string): Promise<string> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
      });
      const result = await model.generateContent([
        {
          text: 'Remove background and return circular-ready transparent PNG.',
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
      return enhanced ? `data:image/png;base64,${enhanced}` : base64Image;
    } catch (err) {
      console.error('Image enhancement failed:', err);
      return base64Image;
    }
  }

  /**
   * Extract text from image
   */
  async extractTextFromImage(base64Image: string): Promise<string> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
      });
      const result = await model.generateContent([
        { text: 'Extract all readable text as plain text only.' },
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
