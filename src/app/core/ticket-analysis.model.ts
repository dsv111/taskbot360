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
  category: string;
  summary: string;
  dos: string[];
  donts: string[];
  dependencies: string[];
  scenarios: string[];
  risks: string[];
  outputs: string[];
  estimate: {
    unit: 'hours' | 'days';
    value: number;
    confidence: number;
    notes: string;
  };
  breakdown: { step: string; unit: 'hours' | 'days'; value: number }[]; // ⬅ added
}

