import type { Script, Session, Stats, Settings } from "@/types";

const KEYS = {
  SCRIPTS: "psittacus:scripts",
  SESSION: "psittacus:session",
  STATS: "psittacus:stats",
  SETTINGS: "psittacus:settings",
} as const;

function safeGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function safeSet(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage full or unavailable
  }
}

// ── Scripts ──────────────────────────────────────────────────────────────────

export function getScripts(): Script[] {
  return safeGet<Script[]>(KEYS.SCRIPTS, []);
}

export function getScript(id: string): Script | undefined {
  return getScripts().find((s) => s.id === id);
}

export function saveScript(script: Script): void {
  const scripts = getScripts().filter((s) => s.id !== script.id);
  safeSet(KEYS.SCRIPTS, [script, ...scripts]);
}

export function deleteScript(id: string): void {
  const scripts = getScripts().filter((s) => s.id !== id);
  safeSet(KEYS.SCRIPTS, scripts);
  // clean associated data
  const stats = getAllStats().filter((s) => s.scriptId !== id);
  safeSet(KEYS.STATS, stats);
  const session = getSession();
  if (session?.scriptId === id) clearSession();
}

// ── Session ───────────────────────────────────────────────────────────────────

export function getSession(): Session | null {
  return safeGet<Session | null>(KEYS.SESSION, null);
}

export function saveSession(session: Session): void {
  safeSet(KEYS.SESSION, { ...session, lastActiveAt: Date.now() });
}

export function clearSession(): void {
  if (typeof window !== "undefined") localStorage.removeItem(KEYS.SESSION);
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export function getAllStats(): Stats[] {
  return safeGet<Stats[]>(KEYS.STATS, []);
}

export function getStats(scriptId: string, character: string): Stats | undefined {
  return getAllStats().find(
    (s) => s.scriptId === scriptId && s.character === character
  );
}

/** Increments numeric stats fields (pass positive integers as deltas) */
export function updateStats(
  scriptId: string,
  character: string,
  delta: { attempts?: number; successes?: number; errors?: number; completedRuns?: number; totalTime?: number }
): void {
  const all = getAllStats();
  const idx = all.findIndex(
    (s) => s.scriptId === scriptId && s.character === character
  );
  const base: Stats = all[idx] ?? {
    scriptId,
    character,
    attempts: 0,
    successes: 0,
    errors: 0,
    completedRuns: 0,
    totalTime: 0,
    lastRunAt: Date.now(),
  };
  const updated: Stats = {
    ...base,
    attempts: base.attempts + (delta.attempts ?? 0),
    successes: base.successes + (delta.successes ?? 0),
    errors: base.errors + (delta.errors ?? 0),
    completedRuns: base.completedRuns + (delta.completedRuns ?? 0),
    totalTime: base.totalTime + (delta.totalTime ?? 0),
    lastRunAt: Date.now(),
  };
  if (idx >= 0) all[idx] = updated;
  else all.push(updated);
  safeSet(KEYS.STATS, all);
}

// ── Settings ──────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: Settings = {
  defaultSpeechRate: 1,
  defaultSpeechLang: "fr-FR",
  showPhoneticHints: false,
  autoAdvance: true,
  comparisonMode: "normal",
};

export function getSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...safeGet<Partial<Settings>>(KEYS.SETTINGS, {}) };
}

export function saveSettings(settings: Partial<Settings>): void {
  safeSet(KEYS.SETTINGS, { ...getSettings(), ...settings });
}
