"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import EmptyState from "@/components/EmptyState";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { getScripts, deleteScript, getSession, getStats } from "@/lib/storage";
import type { Script, Session, Stats } from "@/types";

export default function LibraryPage() {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [statsMap, setStatsMap] = useState<Record<string, Stats | undefined>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function load() {
    const s = getScripts();
    setScripts(s);
    setSession(getSession());
    const map: Record<string, Stats | undefined> = {};
    for (const sc of s) {
      if (sc.characters[0]) {
        map[sc.id] = getStats(sc.id, sc.characters[0]);
      }
    }
    setStatsMap(map);
  }

  useEffect(() => {
    load();
  }, []);

  function handleDelete(id: string) {
    if (deletingId === id) {
      deleteScript(id);
      setDeletingId(null);
      load();
    } else {
      setDeletingId(id);
      setTimeout(() => setDeletingId(null), 3000);
    }
  }

  return (
    <main className="min-h-dvh flex flex-col">
      {/* Header */}
      <header className="px-4 pt-6 pb-2">
        <div className="flex items-center justify-between">
          <Logo size="md" />
          <Link href="/scripts/new">
            <Button variant="primary" size="sm" icon={<PlusIcon />}>
              Nouveau
            </Button>
          </Link>
        </div>
        <p className="text-surface-600 text-sm mt-1">Vos scripts de répétition</p>
      </header>

      {/* Reprise de session */}
      {session && scripts.find((s) => s.id === session.scriptId) && (
        <div
          className="mx-4 mt-3"
          style={{ animation: "var(--animate-slide-up)" }}
        >
          <SessionResume session={session} scripts={scripts} />
        </div>
      )}

      {/* Liste */}
      <section className="flex-1 px-4 py-3 space-y-3 pb-8">
        {scripts.length === 0 ? (
          <EmptyState
            emoji="🎭"
            title="Aucun script pour l'instant"
            description="Importez votre premier texte de théâtre pour commencer à répéter."
            action={
              <Link href="/scripts/new">
                <Button variant="primary" size="lg" icon={<PlusIcon />}>
                  Importer un script
                </Button>
              </Link>
            }
          />
        ) : (
          scripts.map((script, i) => (
            <ScriptCard
              key={script.id}
              script={script}
              stats={statsMap[script.id]}
              isActiveSession={session?.scriptId === script.id}
              onDelete={() => handleDelete(script.id)}
              confirming={deletingId === script.id}
              style={{ animationDelay: `${i * 50}ms` }}
            />
          ))
        )}
      </section>
    </main>
  );
}

function SessionResume({ session, scripts }: { session: Session; scripts: Script[] }) {
  const script = scripts.find((s) => s.id === session.scriptId);
  if (!script) return null;
  const progress = script.lines.length
    ? Math.round((session.completedLines.length / script.lines.length) * 100)
    : 0;

  return (
    <Link href={`/scripts/${session.scriptId}/rehearse`}>
      <div className="rounded-2xl bg-gradient-to-r from-parrot-900/50 to-surface-200 border border-parrot-700/40 p-4 flex items-center gap-3 active:scale-[0.98] transition-transform">
        <div className="text-2xl shrink-0">▶️</div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-parrot-300 font-medium mb-0.5">Reprendre la session</p>
          <p className="font-semibold text-surface-900 truncate">{script.title}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex-1 h-1.5 bg-surface-300/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-parrot-500 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-surface-600 shrink-0">{progress}%</span>
          </div>
        </div>
        <ChevronRightIcon className="text-surface-600 shrink-0" />
      </div>
    </Link>
  );
}

function ScriptCard({
  script,
  stats,
  isActiveSession,
  onDelete,
  confirming,
  style,
}: {
  script: Script;
  stats: Stats | undefined;
  isActiveSession: boolean;
  onDelete: () => void;
  confirming: boolean;
  style?: React.CSSProperties;
}) {
  const lineCount = script.lines.length;
  const charCount = script.characters.length;

  return (
    <div
      className="rounded-2xl bg-surface-200 border border-surface-300/40 overflow-hidden"
      style={{ animation: "var(--animate-slide-up)", ...style }}
    >
      <Link href={`/scripts/${script.id}`} className="block p-4 active:bg-surface-300/30 transition-colors">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h2
                className="font-semibold text-surface-900 text-base leading-snug"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {script.title}
              </h2>
              {isActiveSession && (
                <Badge variant="green">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-parrot-400 animate-pulse mr-0.5" />
                  En cours
                </Badge>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Badge>{lineCount} réplique{lineCount !== 1 ? "s" : ""}</Badge>
              <Badge>{charCount} personnage{charCount !== 1 ? "s" : ""}</Badge>
              {stats && stats.completedRuns > 0 && (
                <Badge variant="amber">✓ {stats.completedRuns} run{stats.completedRuns > 1 ? "s" : ""}</Badge>
              )}
            </div>
          </div>
          <ChevronRightIcon className="text-surface-500 mt-0.5 shrink-0" />
        </div>

        <p className="text-surface-600 text-xs mt-2">
          {script.characters.slice(0, 4).join(" · ")}
          {script.characters.length > 4 && ` +${script.characters.length - 4}`}
        </p>
      </Link>

      <div className="flex border-t border-surface-300/40">
        <Link
          href={`/scripts/${script.id}`}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-surface-600 hover:text-surface-900 hover:bg-surface-300/30 transition-colors"
        >
          <EditIcon size={14} />
          Modifier
        </Link>
        <div className="w-px bg-surface-300/40" />
        <button
          onClick={onDelete}
          className={[
            "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs transition-colors",
            confirming
              ? "text-red-400 bg-red-500/10"
              : "text-surface-600 hover:text-red-400 hover:bg-red-500/10",
          ].join(" ")}
        >
          <TrashIcon size={14} />
          {confirming ? "Confirmer ?" : "Supprimer"}
        </button>
      </div>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ChevronRightIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function EditIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function TrashIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  );
}
