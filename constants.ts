
import { QuestionData } from './types';

export const QUESTIONS: QuestionData[] = [
  { id: '1', text: "Tell me about yourself and your journey to this role." },
  { id: '2', text: "What is your biggest failure, and what did you learn from it?" },
  { id: '3', text: "Describe a time you handled a high-conflict situation." },
  { id: '4', text: "Why should we hire you over other qualified candidates?" },
  { id: '5', text: "Explain a complex technical project to someone without a technical background." },
  { id: '6', text: "Where do you see yourself in five years?" },
  { id: '7', text: "How do you handle intense pressure and tight deadlines?" },
  { id: '8', text: "What's the most difficult feedback you've ever received?" },
  { id: '9', text: "Tell me about a time you went above and beyond for a goal." },
  { id: '10', text: "What motivates you to perform at your best every day?" }
];

export const FILLER_WORDS = ["um", "uh", "like", "basically", "actually", "you know", "kind of", "sort of"];

export const SCORING = {
  DELAY_THRESHOLD_MS: 4000,
  FILLER_PENALTY_THRESHOLD: 5,
  MIN_WORD_COUNT: 20,
  PANIC_MULTIPLIER: 1.2
};
