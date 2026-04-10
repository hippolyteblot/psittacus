export interface Line {
  id: string;
  character: string;
  text: string;
  index: number;
}

export interface Script {
  id: string;
  title: string;
  rawText: string;
  lines: Line[];
  characters: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Session {
  scriptId: string;
  character: string;
  currentLineIndex: number;
  completedLines: number[];
  startedAt: number;
  lastActiveAt: number;
  speechRate: number;
  speechLang: string;
}

export interface Stats {
  scriptId: string;
  character: string;
  attempts: number;
  successes: number;
  errors: number;
  completedRuns: number;
  totalTime: number;
  lastRunAt: number;
}

export interface Settings {
  defaultSpeechRate: number;
  defaultSpeechLang: string;
  showPhoneticHints: boolean;
  autoAdvance: boolean;
  comparisonMode: "strict" | "normal" | "loose";
}

export type ComparisonResult = "exact" | "close" | "wrong";
