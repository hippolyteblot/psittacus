export type STTStatus = "idle" | "listening" | "processing" | "error" | "unsupported";

export interface STTOptions {
  lang?: string;
  onResult: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

// Minimal types for the Web Speech API (not always in lib.dom.d.ts)
interface ISpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly [index: number]: { transcript: string; confidence: number };
}

interface ISpeechRecognitionResultList {
  readonly length: number;
  readonly [index: number]: ISpeechRecognitionResult;
}

interface ISpeechRecognitionEvent {
  readonly results: ISpeechRecognitionResultList;
}

interface ISpeechRecognitionErrorEvent {
  readonly error: string;
}

interface ISpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((e: ISpeechRecognitionErrorEvent) => void) | null;
  onresult: ((e: ISpeechRecognitionEvent) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface ISpeechRecognitionCtor {
  new(): ISpeechRecognition;
}

function getSpeechRecognition(): ISpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: ISpeechRecognitionCtor;
    webkitSpeechRecognition?: ISpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSTTAvailable(): boolean {
  return getSpeechRecognition() !== null;
}

export class STTRecognizer {
  private recognition: ISpeechRecognition | null = null;
  private options: STTOptions;

  constructor(options: STTOptions) {
    this.options = options;
  }

  start(lang?: string): void {
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      this.options.onError?.("unsupported");
      return;
    }
    this.stop();

    const r = new Ctor();
    r.continuous = false;
    r.interimResults = true;
    r.lang = lang ?? this.options.lang ?? "fr-FR";
    r.maxAlternatives = 1;

    r.onstart = () => this.options.onStart?.();
    r.onend = () => this.options.onEnd?.();
    r.onerror = (e) => this.options.onError?.(e.error);

    r.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      const transcript = result[0].transcript;
      const isFinal = result.isFinal;
      this.options.onResult(transcript, isFinal);
    };

    this.recognition = r;
    r.start();
  }

  stop(): void {
    if (this.recognition) {
      try { this.recognition.stop(); } catch { /* ignore */ }
      this.recognition = null;
    }
  }

  abort(): void {
    if (this.recognition) {
      try { this.recognition.abort(); } catch { /* ignore */ }
      this.recognition = null;
    }
  }
}
