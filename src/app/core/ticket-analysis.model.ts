export type TicketCategory =
  | 'frontend' | 'backend' | 'database' | 'qa' | 'devops'
  | 'security' | 'data' | 'other';

export interface TicketEstimate {
  unit: 'hours' | 'days';
  value: number;         // e.g. 6 (hours) or 2 (days)
  confidence: number;    // 0..1
  notes?: string;
}

export interface TicketAnalysis {
  category: TicketCategory;
  summary: string;
  dos: string[];
  donts: string[];
  dependencies: string[];
  scenarios: string[];   // edge cases & validations to cover
  risks: string[];
  outputs: string[];     // deliverables/acceptance artifacts
  estimate: TicketEstimate;
}
