
export type AppState = 'home' | 'mode-select' | 'simulation' | 'report';
export type SimulationMode = 'viva' | 'panic';

export interface PerformanceMetrics {
  clarity: number;
  composure: number;
  structure: number;
  confidence: number;
  fillerCount: number;
  avgDelay: number;
  transcript?: string;
  responses?: ResponseMetric[];
}

export interface QuestionData {
  id: string;
  text: string;
}

export interface ResponseMetric {
  questionId: string;
  questionText?: string;
  delay: number;
  fillerCount: number;
  wordCount: number;
  transcript: string;
}

export interface SessionData {
  mode: SimulationMode;
  metrics: PerformanceMetrics;
  timestamp: number;
}
