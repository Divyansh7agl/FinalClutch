
export type AppState = 'home' | 'mode-select' | 'custom-setup' | 'simulation' | 'report';
export type SimulationMode = 'viva' | 'panic' | 'ai-interview' | 'custom';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export interface CustomContext {
  role: string;
  topic: string;
  difficulty: DifficultyLevel;
}

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
