"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  use,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Logo from "@/components/Logo";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import {
  getScript,
  getSession,
  saveSession,
  clearSession,
  getSettings,
  updateStats,
} from "@/lib/storage";
import {
  speak,
  stopSpeaking,
  isTTSAvailable,
  initVoices,
} from "@/lib/tts";
import { STTRecognizer, isSTTAvailable } from "@/lib/stt";
import { compareLines } from "@/lib/compare";
import type { Script, Line, Session } from "@/types";

type Phase =
  | "idle"
  | "speaking"    // TTS is reading another character's line
  | "waiting"     // user's turn — waiting for mic press (or reveal click)
  | "listening"   // STT active
  | "success"     // correct answer (auto-advances)
  | "hint"        // showing hint after errors
  | "review"      // Perfect mode: user decides if they succeeded or failed
  | "restarted"   // Perfect mode: brief feedback when scene restarts
  | "complete";   // script finished

// ─────────────────────────────────────────────────────────────────────────────

export default function RehearsePageWrapper({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <React.Suspense fallback={<LoadingScreen />}>
      <RehearsePage id={id} />
    </React.Suspense>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function RehearsePage({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const character = searchParams.get("character") ?? "";
  const rate = parseFloat(searchParams.get("rate") ?? "1");
  const lang = searchParams.get("lang") ?? "fr-FR";
  const textOnly = searchParams.get("textOnly") === "1";
  const perfectMode = searchParams.get("perfect") === "1";

  const [script, setScript] = useState<Script | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [hintShown, setHintShown] = useState(false);
  const [noSTTRevealed, setNoSTTRevealed] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [completedLines, setCompletedLines] = useState<number[]>([]);
  const [sessionStart] = useState(Date.now());
  /** Increments on every Perfect-mode restart — forces the TTS effect to
   *  re-fire even if we land back on the same line id we were already on. */
  const [runKey, setRunKey] = useState(0);

  const sttRef = useRef<STTRecognizer | null>(null);
  const settings = getSettings();

  // In text-only mode we intentionally bypass both TTS and STT
  const ttsAvailable = !textOnly && isTTSAvailable();
  const sttAvailable = !textOnly && isSTTAvailable();

  // ── Load voices & script ──────────────────────────────────────────────────

  useEffect(() => {
    initVoices();
  }, []);

  useEffect(() => {
    const s = getScript(id);
    if (!s || !character) {
      router.replace("/");
      return;
    }
    setScript(s);

    const saved = getSession();
    if (
      saved &&
      saved.scriptId === id &&
      saved.character === character
    ) {
      setCurrentIdx(saved.currentLineIndex);
      setCompletedLines(saved.completedLines);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]); // run once on mount

  // ── Persist session ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!script) return;
    const session: Session = {
      scriptId: id,
      character,
      currentLineIndex: currentIdx,
      completedLines,
      startedAt: sessionStart,
      lastActiveAt: Date.now(),
      speechRate: rate,
      speechLang: lang,
    };
    saveSession(session);
  }, [currentIdx, completedLines, script, id, character, rate, lang, sessionStart]);

  // ── Derived values ────────────────────────────────────────────────────────

  const currentLine: Line | undefined = script?.lines[currentIdx];
  const isUserLine = currentLine?.character === character;

  // ── Advance (kept in ref to avoid stale closures in async callbacks) ──────

  const scriptRef = useRef(script);
  const currentIdxRef = useRef(currentIdx);
  scriptRef.current = script;
  currentIdxRef.current = currentIdx;

  const advance = useCallback(() => {
    const s = scriptRef.current;
    const idx = currentIdxRef.current;
    if (!s) return;

    const next = idx + 1;
    if (next >= s.lines.length) {
      updateStats(id, character, { completedRuns: 1 });
      clearSession();
      setPhase("complete");
      return;
    }
    setCurrentIdx(next);
    setTranscript("");
    setHintShown(false);
    setNoSTTRevealed(false);
    setAttempts(0);
    setPhase("idle");
  }, [id, character]);

  /** Perfect mode: user failed → reset to beginning of the scene */
  const restartScene = useCallback(() => {
    stopSpeaking();
    sttRef.current?.abort();
    setTranscript("");
    setHintShown(false);
    setNoSTTRevealed(false);
    setAttempts(0);
    setCompletedLines([]);
    setPhase("restarted");
    // Brief "restarting" feedback, then jump to line 0
    setTimeout(() => {
      setCurrentIdx(0);
      setRunKey((k) => k + 1);
      setPhase("idle");
    }, 1000);
  }, []);

  // ── TTS auto-play / waiting setup — triggers only on new line ────────────
  // IMPORTANT: `phase` must NOT be in the deps array.
  // If it were, calling setPhase("speaking") inside the effect would trigger
  // the cleanup (stopSpeaking) immediately after, silencing the TTS.
  // We only want this effect to run when we actually move to a new line.

  useEffect(() => {
    if (!currentLine) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let safetyTimer: ReturnType<typeof setTimeout> | null = null;

    if (!isUserLine) {
      setPhase("speaking");

      const onDone = () => {
        if (cancelled) return;
        cancelled = true; // prevent safety timer from also firing
        if (safetyTimer) clearTimeout(safetyTimer);
        timer = setTimeout(() => advance(), 450);
      };

      if (ttsAvailable) {
        speak(currentLine.text, {
          rate,
          lang,
          onEnd: onDone,
          onError: onDone,
        });

        // Safety net: some browsers (Chrome Android, some WebViews) silently
        // drop `onend` events — especially with many short utterances in a row.
        // Estimate an upper bound based on text length and force-advance if
        // we exceeded it, so the script never gets stuck.
        const estMs =
          Math.max(1800, currentLine.text.length * 90) / Math.max(rate, 0.5) + 2500;
        safetyTimer = setTimeout(() => {
          if (cancelled) return;
          console.warn("TTS safety timeout — forcing advance");
          onDone();
        }, estMs);
      }
      // No TTS: phase stays "speaking" → tap anywhere or "Continuer →" button
    } else {
      setPhase("waiting");
    }

    return () => {
      cancelled = true;
      if (timer !== null) clearTimeout(timer);
      if (safetyTimer !== null) clearTimeout(safetyTimer);
      if (!isUserLine && ttsAvailable) stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLine?.id, isUserLine, runKey]);

  // ── STT evaluation ────────────────────────────────────────────────────────

  const attemptsRef = useRef(attempts);
  attemptsRef.current = attempts;
  const currentLineRef = useRef(currentLine);
  currentLineRef.current = currentLine;

  const evaluateTranscript = useCallback(
    (spoken: string) => {
      const line = currentLineRef.current;
      if (!line) return;

      // In Perfect mode, the user decides — we skip automatic evaluation
      // and go straight to the review step.
      if (perfectMode) {
        updateStats(id, character, { attempts: 1 });
        setPhase("review");
        return;
      }

      const result = compareLines(spoken, line.text, settings.comparisonMode);
      const newAttempts = attemptsRef.current + 1;
      setAttempts(newAttempts);
      updateStats(id, character, { attempts: 1 });

      if (result === "exact" || result === "close") {
        updateStats(id, character, { successes: 1 });
        setCompletedLines((prev) => [...prev, currentIdxRef.current]);
        setPhase("success");
        setTimeout(() => advance(), 1200);
      } else {
        updateStats(id, character, { errors: 1 });
        if (newAttempts >= 2) {
          setHintShown(true);
          setPhase("hint");
        } else {
          setPhase("waiting");
        }
      }
    },
    [id, character, settings.comparisonMode, advance, perfectMode]
  );

  // ── Mic handlers ──────────────────────────────────────────────────────────

  function startListening() {
    setTranscript("");
    setPhase("listening");

    sttRef.current = new STTRecognizer({
      lang,
      onResult: (t, isFinal) => {
        setTranscript(t);
        if (isFinal) {
          sttRef.current?.stop();
          evaluateTranscript(t);
        }
      },
      onEnd: () => {
        // If onResult never fired a final result, fall back
        setPhase((prev) => (prev === "listening" ? "waiting" : prev));
      },
      onError: (err) => {
        console.warn("STT error:", err);
        setPhase("waiting");
      },
    });
    sttRef.current.start(lang);
  }

  function replayTTS() {
    if (!currentLine || !ttsAvailable) return;
    speak(currentLine.text, { rate, lang });
  }

  // ── Tap-anywhere-to-advance ───────────────────────────────────────────────
  // Triggered by clicking the main area (not the dialog card or action widgets).
  function handleAreaTap() {
    // Don't interrupt transient / interactive states
    if (
      phase === "listening" ||
      phase === "success" ||
      phase === "hint" ||
      phase === "review" ||
      phase === "restarted" ||
      phase === "complete"
    ) {
      return;
    }

    if (!isUserLine) {
      // Other character's line — tap always advances (skips remaining TTS)
      stopSpeaking();
      advance();
      return;
    }

    // User's line — behavior depends on mode
    if (!sttAvailable) {
      // Text-only / fallback: reveal first, then confirm
      if (!noSTTRevealed) {
        setNoSTTRevealed(true);
        return;
      }
      // Revealed: if Perfect mode, go to review; otherwise just advance
      if (perfectMode) {
        updateStats(id, character, { attempts: 1 });
        setPhase("review");
      } else {
        advance();
      }
      return;
    }

    // STT mode on user's line: tap outside dialog = skip
    advance();
  }

  function stopAll() {
    stopSpeaking();
    sttRef.current?.abort();
    // Use replace so the rehearsal page doesn't stay in history — otherwise
    // pressing "back" from the config page would take the user back to the
    // rehearsal instead of the library.
    router.replace(`/scripts/${id}`);
  }

  useEffect(() => {
    return () => {
      stopSpeaking();
      sttRef.current?.abort();
    };
  }, []);

  // ── Guard & derived ───────────────────────────────────────────────────────

  if (!script || !currentLine) return <LoadingScreen />;

  const totalLines = script.lines.length;
  const progress = totalLines ? currentIdx / totalLines : 0;

  if (phase === "complete") {
    return (
      <CompleteScreen
        script={script}
        character={character}
        onBack={() => router.replace(`/scripts/${id}`)}
      />
    );
  }

  return (
    <main className="min-h-dvh flex flex-col bg-surface-50">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={stopAll}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-surface-600 hover:text-surface-900 hover:bg-surface-200/60 transition-all active:scale-90 shrink-0"
          aria-label="Quitter"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5m0 0 7 7M5 12l7-7" />
          </svg>
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-surface-600 font-medium truncate">
              {script.title}
            </span>
            <div className="flex items-center gap-1.5 shrink-0 ml-2">
              {perfectMode && (
                <span className="text-xs bg-amber-500/15 text-amber-300 border border-amber-500/25 px-2 py-0.5 rounded-full font-medium">
                  ✨ Perfect
                </span>
              )}
              {textOnly && (
                <span className="text-xs bg-surface-300/60 text-surface-600 px-2 py-0.5 rounded-full">
                  📖
                </span>
              )}
              <span className="text-xs text-surface-500">
                {currentIdx + 1} / {totalLines}
              </span>
            </div>
          </div>
          <div className="h-1.5 bg-surface-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-parrot-500 rounded-full transition-all duration-500"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Context (previous lines) ────────────────────────────────────── */}
      <ContextLines
        script={script}
        currentIdx={currentIdx}
        character={character}
      />

      {/* ── Main area — tap anywhere outside the dialog to advance ──────── */}
      <div
        className="flex-1 px-4 flex flex-col gap-4 justify-center pb-6 cursor-pointer select-none"
        onClick={handleAreaTap}
        role="button"
        tabIndex={-1}
        aria-label="Toucher pour continuer"
      >
        {/* The dialog card itself: clicking it should NOT advance (user may
            want to read it carefully, select text, tap "Rejouer" etc). */}
        <div onClick={(e) => e.stopPropagation()} className="cursor-auto">
          <CurrentLineCard
            line={currentLine}
            isUserLine={isUserLine}
            phase={phase}
            transcript={transcript}
            hintShown={hintShown}
            noSTTRevealed={noSTTRevealed}
            ttsAvailable={ttsAvailable}
            sttAvailable={sttAvailable}
            onReplay={replayTTS}
            onManualAdvance={
              !isUserLine && phase === "speaking" && !ttsAvailable
                ? advance
                : undefined
            }
          />
        </div>

        {/* User action zone (hidden during success, hint, review, restarted) */}
        {isUserLine &&
          phase !== "success" &&
          phase !== "hint" &&
          phase !== "review" &&
          phase !== "restarted" && (
            <div onClick={(e) => e.stopPropagation()} className="cursor-auto">
              <UserActionArea
                phase={phase}
                sttAvailable={sttAvailable}
                textOnly={textOnly}
                noSTTRevealed={noSTTRevealed}
                onStartListening={startListening}
                onReveal={() => setNoSTTRevealed(true)}
                onNoSTTAdvance={() => {
                  if (perfectMode) {
                    updateStats(id, character, { attempts: 1 });
                    setPhase("review");
                  } else {
                    advance();
                  }
                }}
                onSkip={advance}
              />
            </div>
          )}

        {/* Hint card */}
        {phase === "hint" && (
          <div onClick={(e) => e.stopPropagation()} className="cursor-auto">
            <HintCard
              line={currentLine}
              onRetry={() => {
                setHintShown(false);
                setNoSTTRevealed(false);
                setPhase("waiting");
              }}
              onSkip={advance}
            />
          </div>
        )}

        {/* Perfect-mode review step */}
        {phase === "review" && (
          <div onClick={(e) => e.stopPropagation()} className="cursor-auto">
            <ReviewCard
              onSuccess={() => {
                updateStats(id, character, { successes: 1 });
                setCompletedLines((prev) => [...prev, currentIdxRef.current]);
                setPhase("success");
                setTimeout(() => advance(), 800);
              }}
              onFail={() => {
                updateStats(id, character, { errors: 1 });
                restartScene();
              }}
            />
          </div>
        )}

        {/* Perfect-mode "restarting" feedback */}
        {phase === "restarted" && (
          <div onClick={(e) => e.stopPropagation()} className="cursor-auto">
            <RestartedCard />
          </div>
        )}

        {/* Subtle hint at the bottom when tapping advances */}
        {(phase === "speaking" ||
          (phase === "waiting" &&
            (!sttAvailable || noSTTRevealed))) && (
          <p className="text-center text-xs text-surface-500/70 mt-auto pointer-events-none">
            Touchez l&apos;écran pour continuer
          </p>
        )}
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function ContextLines({
  script,
  currentIdx,
  character,
}: {
  script: Script;
  currentIdx: number;
  character: string;
}) {
  const start = Math.max(0, currentIdx - 3);
  const lines = script.lines.slice(start, currentIdx);
  if (!lines.length) return null;
  return (
    <div className="px-4 space-y-1.5 mb-1">
      {lines.map((line) => (
        <div
          key={line.id}
          className={[
            "flex gap-2 text-sm",
            line.character === character ? "opacity-60" : "opacity-40",
          ].join(" ")}
        >
          <span className="text-xs font-semibold uppercase tracking-wide text-surface-500 w-24 shrink-0 truncate pt-0.5">
            {line.character}
          </span>
          <span className="text-surface-700 leading-snug line-clamp-2">
            {line.text}
          </span>
        </div>
      ))}
    </div>
  );
}

function CurrentLineCard({
  line,
  isUserLine,
  phase,
  transcript,
  hintShown,
  noSTTRevealed,
  ttsAvailable,
  sttAvailable,
  onReplay,
  onManualAdvance,
}: {
  line: Line;
  isUserLine: boolean;
  phase: Phase;
  transcript: string;
  hintShown: boolean;
  noSTTRevealed: boolean;
  ttsAvailable: boolean;
  sttAvailable: boolean;
  onReplay: () => void;
  onManualAdvance?: () => void;
}) {
  // Blur the text when it's the user's turn and hasn't been revealed yet.
  // In the "review" phase (Perfect mode), always show the text so the user
  // can compare what they said with what was expected.
  const textBlurred =
    isUserLine && !hintShown && !noSTTRevealed && phase !== "review";
  const isSpeaking = phase === "speaking";
  const isSuccess = phase === "success";

  return (
    <div
      key={line.id}
      className={[
        "rounded-3xl p-5 border transition-all duration-300",
        isUserLine
          ? "bg-gradient-to-br from-parrot-900/40 to-surface-200 border-parrot-700/40"
          : "bg-surface-200 border-surface-300/40",
        isSuccess ? "ring-2 ring-parrot-500/50 scale-[1.01]" : "",
      ].join(" ")}
      style={{ animation: "var(--animate-slide-up)" }}
    >
      {/* Character label */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className={[
            "text-xs font-bold uppercase tracking-widest",
            isUserLine ? "text-parrot-400" : "text-surface-500",
          ].join(" ")}
        >
          {line.character}
        </span>
        {isUserLine && <Badge variant="green">Votre réplique</Badge>}
        {isSpeaking && !isUserLine && <SpeakingIndicator />}
      </div>

      {/* Line text */}
      <p
        className={[
          "text-xl leading-relaxed font-medium transition-all duration-300 select-none",
          isUserLine ? "text-parrot-100" : "text-surface-900",
          isSpeaking && !isUserLine ? "text-surface-700" : "",
          textBlurred ? "blur-sm pointer-events-none" : "",
        ].join(" ")}
        style={{ fontFamily: "var(--font-display)" }}
      >
        {line.text}
      </p>

      {/* Live STT transcript */}
      {transcript && (
        <div className="mt-3 pt-3 border-t border-surface-300/30">
          <p className="text-sm text-surface-600 italic">
            <span className="not-italic text-surface-500 font-medium">Vous : </span>
            {transcript}
          </p>
        </div>
      )}

      {/* Replay TTS button for other chars */}
      {!isUserLine && ttsAvailable && !isSpeaking && (
        <button
          onClick={onReplay}
          className="mt-3 flex items-center gap-1.5 text-xs text-surface-500 hover:text-parrot-400 transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          Rejouer
        </button>
      )}

      {/* Manual advance when no TTS */}
      {onManualAdvance && (
        <button
          onClick={onManualAdvance}
          className="mt-3 flex items-center gap-1.5 text-xs text-parrot-400 hover:text-parrot-300 transition-colors font-medium"
        >
          Continuer →
        </button>
      )}

      {/* Success feedback */}
      {isSuccess && (
        <div
          className="mt-3 flex items-center gap-1.5 text-parrot-400 text-sm font-semibold"
          style={{ animation: "var(--animate-pop)" }}
        >
          <span>✓</span> Bien dit !
        </div>
      )}
    </div>
  );
}

function SpeakingIndicator() {
  return (
    <div className="flex items-end gap-0.5 h-4" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1 bg-amber-400 rounded-full"
          style={{
            animation: `pulse 1s ease-in-out ${i * 0.15}s infinite`,
            height: `${8 + i * 4}px`,
          }}
        />
      ))}
    </div>
  );
}

function UserActionArea({
  phase,
  sttAvailable,
  textOnly,
  noSTTRevealed,
  onStartListening,
  onReveal,
  onNoSTTAdvance,
  onSkip,
}: {
  phase: Phase;
  sttAvailable: boolean;
  textOnly: boolean;
  noSTTRevealed: boolean;
  onStartListening: () => void;
  onReveal: () => void;
  onNoSTTAdvance: () => void;
  onSkip: () => void;
}) {
  // ── Text-only or no-STT flow ───────────────────────────────────────────────
  if (!sttAvailable) {
    return (
      <div className="flex flex-col items-center gap-4">
        {/* Only show the warning banner when STT is missing unexpectedly */}
        {!textOnly && (
          <div className="text-xs text-amber-300/80 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2.5 text-center leading-relaxed max-w-xs">
            🎙️ Reconnaissance vocale indisponible sur ce navigateur.
            <br />
            Lisez votre réplique à voix haute.
          </div>
        )}

        {!noSTTRevealed ? (
          <Button
            variant="secondary"
            size="lg"
            onClick={onReveal}
            icon={<span>👁</span>}
          >
            Voir ma réplique
          </Button>
        ) : (
          <Button
            variant="primary"
            size="lg"
            onClick={onNoSTTAdvance}
            icon={<span>✓</span>}
          >
            J&apos;ai dit ma réplique → Continuer
          </Button>
        )}
      </div>
    );
  }

  // ── STT available ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-4">
      {/* Listening state */}
      {phase === "listening" ? (
        <div className="flex flex-col items-center gap-3">
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 rounded-full bg-parrot-500/20 animate-ping" />
            <div
              className="absolute inset-2 rounded-full bg-parrot-500/30 animate-ping"
              style={{ animationDelay: "0.2s" }}
            />
            <div className="w-20 h-20 rounded-full flex items-center justify-center bg-parrot-500 shadow-2xl shadow-parrot-500/40 relative z-10">
              <MicIcon />
            </div>
          </div>
          <p className="text-sm text-parrot-400 font-medium animate-pulse">
            Je vous écoute…
          </p>
        </div>
      ) : (
        /* Waiting state — big mic button */
        <button
          onClick={onStartListening}
          className="w-20 h-20 rounded-full flex items-center justify-center bg-parrot-500 shadow-2xl shadow-parrot-500/40 hover:bg-parrot-400 hover:scale-105 active:scale-90 transition-all duration-200"
          aria-label="Parler"
        >
          <MicIcon />
        </button>
      )}

      {/* Skip link */}
      {phase === "waiting" && (
        <button
          onClick={onSkip}
          className="text-xs text-surface-500 hover:text-surface-700 transition-colors underline underline-offset-2"
        >
          Passer cette réplique
        </button>
      )}
    </div>
  );
}

function MicIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function HintCard({
  line,
  onRetry,
  onSkip,
}: {
  line: Line;
  onRetry: () => void;
  onSkip: () => void;
}) {
  return (
    <div
      className="rounded-2xl bg-amber-500/10 border border-amber-500/25 p-4 space-y-3"
      style={{ animation: "var(--animate-pop)" }}
    >
      <p className="text-amber-300 text-sm font-semibold">
        💡 La bonne réplique :
      </p>
      <p
        className="text-amber-100 text-lg leading-relaxed"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {line.text}
      </p>
      <div className="flex gap-2 pt-1">
        <Button variant="secondary" size="sm" onClick={onRetry} fullWidth>
          Réessayer
        </Button>
        <Button variant="ghost" size="sm" onClick={onSkip} fullWidth>
          Continuer →
        </Button>
      </div>
    </div>
  );
}

function ReviewCard({
  onSuccess,
  onFail,
}: {
  onSuccess: () => void;
  onFail: () => void;
}) {
  return (
    <div
      className="rounded-2xl bg-gradient-to-br from-amber-500/10 to-surface-200 border border-amber-500/25 p-4 space-y-3"
      style={{ animation: "var(--animate-pop)" }}
    >
      <div className="flex items-center gap-2">
        <span className="text-xl">✨</span>
        <p className="text-amber-300 text-sm font-semibold">
          L&apos;avez-vous dit correctement ?
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onFail}
          className="flex items-center justify-center gap-1.5 h-12 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 font-semibold text-sm transition-all active:scale-95"
        >
          <span className="text-lg">✗</span>
          Raté
        </button>
        <button
          onClick={onSuccess}
          className="flex items-center justify-center gap-1.5 h-12 rounded-xl bg-parrot-500 hover:bg-parrot-400 text-white shadow-lg shadow-parrot-500/20 font-semibold text-sm transition-all active:scale-95"
        >
          <span className="text-lg">✓</span>
          Réussi
        </button>
      </div>
      <p className="text-xs text-surface-500 text-center leading-relaxed">
        En cas d&apos;échec, la scène reprend du début.
      </p>
    </div>
  );
}

function RestartedCard() {
  return (
    <div
      className="rounded-2xl bg-red-500/10 border border-red-500/25 p-6 text-center space-y-2"
      style={{ animation: "var(--animate-pop)" }}
    >
      <div className="text-4xl">🔁</div>
      <p className="text-red-300 text-sm font-semibold">
        On reprend du début
      </p>
      <p className="text-xs text-surface-600">
        Concentration, vous pouvez le faire !
      </p>
    </div>
  );
}

function CompleteScreen({
  script,
  character,
  onBack,
}: {
  script: Script;
  character: string;
  onBack: () => void;
}) {
  return (
    <main
      className="min-h-dvh flex flex-col items-center justify-center px-6 text-center gap-6"
      style={{ animation: "var(--animate-fade-in)" }}
    >
      <div className="text-7xl" style={{ animation: "var(--animate-pop)" }}>
        🎉
      </div>
      <div className="space-y-2">
        <h1
          className="text-3xl font-bold gradient-text"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Bravo !
        </h1>
        <p className="text-surface-700 text-base">
          Vous avez terminé{" "}
          <strong className="text-surface-900">{script.title}</strong>
          <br />
          dans le rôle de{" "}
          <strong className="text-parrot-400">{character}</strong>.
        </p>
      </div>
      <Logo size="lg" />
      <div className="flex flex-col gap-3 w-full max-w-sm">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={onBack}
          icon={<span>🔁</span>}
        >
          Recommencer
        </Button>
        <Button variant="ghost" size="md" fullWidth onClick={onBack}>
          Retour au script
        </Button>
      </div>
    </main>
  );
}

function LoadingScreen() {
  return (
    <main className="min-h-dvh flex items-center justify-center">
      <Logo size="lg" />
    </main>
  );
}
