export interface TTSOptions {
  rate?: number;
  lang?: string;
  onEnd?: () => void;
  onError?: (e: SpeechSynthesisErrorEvent) => void;
}

// Priority keywords for voice quality (best first)
const VOICE_PRIORITY = [
  "Google",     // Chrome on Android/Desktop — best quality
  "Natural",    // Some systems
  "Neural",     // Microsoft Edge neural voices
  "Enhanced",   // macOS enhanced voices
  "Premium",    // macOS premium voices
  "Compact",    // macOS compact — decent quality, local
];

let _voicesLoaded = false;

/** Initialise the voice list — call once on mount (async on some browsers) */
export function initVoices(): Promise<void> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return Promise.resolve();
  }
  if (_voicesLoaded || window.speechSynthesis.getVoices().length > 0) {
    _voicesLoaded = true;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const handler = () => {
      _voicesLoaded = true;
      window.speechSynthesis.removeEventListener("voiceschanged", handler);
      resolve();
    };
    window.speechSynthesis.addEventListener("voiceschanged", handler);
    // Fallback timeout
    setTimeout(() => {
      window.speechSynthesis.removeEventListener("voiceschanged", handler);
      resolve();
    }, 1500);
  });
}

function selectBestVoice(lang: string): SpeechSynthesisVoice | null {
  if (!isTTSAvailable()) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const primary = lang.slice(0, 2).toLowerCase();

  // Exact lang match first, then primary language code
  const exact = voices.filter(
    (v) => v.lang.toLowerCase() === lang.toLowerCase()
  );
  const primary_ = voices.filter((v) =>
    v.lang.toLowerCase().startsWith(primary)
  );
  const candidates = exact.length ? exact : primary_;

  if (!candidates.length) return null;

  // Apply priority keywords
  for (const keyword of VOICE_PRIORITY) {
    const found = candidates.find((v) => v.name.includes(keyword));
    if (found) return found;
  }

  // Prefer local (offline) voices — usually better quality than online ones
  const local = candidates.find((v) => v.localService);
  return local ?? candidates[0];
}

export function speak(text: string, options: TTSOptions = {}): void {
  if (!isTTSAvailable()) return;

  stopSpeaking();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = options.rate ?? 1;
  utterance.lang = options.lang ?? "fr-FR";

  // Pick the best available voice for the language
  const voice = selectBestVoice(options.lang ?? "fr-FR");
  if (voice) utterance.voice = voice;

  if (options.onEnd) utterance.onend = options.onEnd;
  if (options.onError) utterance.onerror = options.onError;

  // Chrome Android bug: speechSynthesis sometimes silently stops mid-utterance.
  // A common workaround is to resume it periodically.
  const resumeTimer = setInterval(() => {
    if (!window.speechSynthesis.speaking) {
      clearInterval(resumeTimer);
      return;
    }
    window.speechSynthesis.pause();
    window.speechSynthesis.resume();
  }, 10_000);

  utterance.onend = (e) => {
    clearInterval(resumeTimer);
    options.onEnd?.();
  };
  utterance.onerror = (e) => {
    clearInterval(resumeTimer);
    options.onError?.(e);
  };

  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (typeof window === "undefined") return;
  window.speechSynthesis?.cancel();
}

export function isTTSAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function getVoices(lang?: string): SpeechSynthesisVoice[] {
  if (!isTTSAvailable()) return [];
  const voices = window.speechSynthesis.getVoices();
  if (!lang) return voices;
  const primary = lang.slice(0, 2).toLowerCase();
  return voices.filter((v) => v.lang.toLowerCase().startsWith(primary));
}
