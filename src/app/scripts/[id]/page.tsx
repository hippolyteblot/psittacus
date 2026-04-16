"use client";

import React, { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { getScript, saveScript, getSettings, saveSettings, getStats } from "@/lib/storage";
import { updateScriptText } from "@/lib/parser";
import type { Script, Settings, Stats } from "@/types";

export default function ScriptConfigPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [script, setScript] = useState<Script | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [stats, setStats] = useState<Stats | undefined>(undefined);
  const [selectedChar, setSelectedChar] = useState<string>("");
  const [speechRate, setSpeechRate] = useState(1);
  const [speechLang, setSpeechLang] = useState("fr-FR");
  const [textOnly, setTextOnly] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleValue, setTitleValue] = useState("");

  useEffect(() => {
    const s = getScript(id);
    if (!s) { router.replace("/"); return; }
    const cfg = getSettings();
    setScript(s);
    setSettings(cfg);
    setSelectedChar(s.characters[0] ?? "");
    setSpeechRate(cfg.defaultSpeechRate);
    setSpeechLang(cfg.defaultSpeechLang);
    setEditText(s.rawText);
    setTitleValue(s.title);
  }, [id, router]);

  useEffect(() => {
    if (script && selectedChar) {
      setStats(getStats(script.id, selectedChar));
    }
  }, [script, selectedChar]);

  function handleSaveEdits() {
    if (!script) return;
    setSaving(true);
    const updated = updateScriptText(script, editText);
    updated.title = titleValue || updated.title;
    saveScript(updated);
    setScript(updated);
    setEditMode(false);
    setSaving(false);
  }

  function handleSaveTitleInline() {
    if (!script || !titleValue.trim()) { setTitleEditing(false); return; }
    const updated = { ...script, title: titleValue.trim(), updatedAt: Date.now() };
    saveScript(updated);
    setScript(updated);
    setTitleEditing(false);
  }

  function handleStart() {
    if (!script || !selectedChar) return;
    saveSettings({ defaultSpeechRate: speechRate, defaultSpeechLang: speechLang });
    const params = new URLSearchParams({
      character: selectedChar,
      rate: String(speechRate),
      lang: speechLang,
      textOnly: textOnly ? "1" : "0",
    });
    router.push(`/scripts/${id}/rehearse?${params.toString()}`);
  }

  if (!script || !settings) {
    return (
      <main className="min-h-dvh flex items-center justify-center">
        <div className="text-surface-600 text-sm animate-pulse">Chargement…</div>
      </main>
    );
  }

  const accuracy = stats && stats.attempts > 0
    ? Math.round((stats.successes / stats.attempts) * 100)
    : null;

  return (
    <main className="min-h-dvh flex flex-col">
      <PageHeader
        title={script.title}
        back
        action={
          <button
            onClick={() => setEditMode(!editMode)}
            className={[
              "flex items-center gap-1.5 px-3 h-9 rounded-xl text-sm font-medium transition-all",
              editMode
                ? "bg-parrot-500/20 text-parrot-300 border border-parrot-500/30"
                : "text-surface-600 hover:text-surface-900 hover:bg-surface-200/60",
            ].join(" ")}
          >
            {editMode ? "✕ Annuler" : "✏️ Éditer"}
          </button>
        }
      />

      <div className="flex-1 px-4 pb-8 space-y-4">
        {/* Edit mode */}
        {editMode ? (
          <div
            className="space-y-3"
            style={{ animation: "var(--animate-slide-up)" }}
          >
            <input
              type="text"
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              placeholder="Titre du script"
              className="w-full bg-surface-200 border border-surface-300/60 rounded-xl px-4 h-11 text-surface-900 placeholder-surface-500 focus:outline-none focus:border-parrot-500/70 transition-colors text-sm font-semibold"
            />
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={14}
              className="w-full bg-surface-200 border border-surface-300/60 rounded-xl px-4 py-3 text-surface-900 focus:outline-none focus:border-parrot-500/70 transition-colors text-sm font-mono leading-relaxed resize-none"
            />
            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={saving}
              onClick={handleSaveEdits}
            >
              Sauvegarder les modifications
            </Button>
          </div>
        ) : (
          <>
            {/* Stats */}
            {stats && (stats.attempts > 0 || stats.completedRuns > 0) && (
              <div className="grid grid-cols-3 gap-2" style={{ animation: "var(--animate-slide-up)" }}>
                <StatTile label="Tentatives" value={String(stats.attempts)} />
                <StatTile label="Précision" value={accuracy !== null ? `${accuracy}%` : "—"} highlight />
                <StatTile label="Runs" value={String(stats.completedRuns)} />
              </div>
            )}

            {/* Script info */}
            <Card variant="highlight">
              <div className="flex gap-4">
                <div className="flex-1">
                  <p className="text-xs text-surface-600 mb-1">Personnages</p>
                  <div className="flex flex-wrap gap-1.5">
                    {script.characters.map((c) => (
                      <Badge key={c} variant={c === selectedChar ? "green" : "default"}>
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-surface-600 mb-0.5">Répliques</p>
                  <p className="text-2xl font-bold text-surface-900">{script.lines.length}</p>
                </div>
              </div>
            </Card>

            {/* Personnage */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-surface-800">Je joue le rôle de…</p>
              <div className="grid grid-cols-2 gap-2">
                {script.characters.map((c) => (
                  <button
                    key={c}
                    onClick={() => setSelectedChar(c)}
                    className={[
                      "py-3 px-4 rounded-xl text-sm font-semibold transition-all text-left border",
                      selectedChar === c
                        ? "bg-parrot-500/20 border-parrot-500/50 text-parrot-300 shadow-lg shadow-parrot-500/10"
                        : "bg-surface-200 border-surface-300/40 text-surface-700 hover:border-surface-400/60 hover:text-surface-900",
                    ].join(" ")}
                  >
                    <span className="mr-2">{selectedChar === c ? "🦜" : "👤"}</span>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Paramètres */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-surface-800">Paramètres de lecture</p>

              {/* Mode selector */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setTextOnly(false)}
                  className={[
                    "flex flex-col items-center gap-1.5 py-3 px-3 rounded-xl border text-sm font-medium transition-all",
                    !textOnly
                      ? "bg-parrot-500/20 border-parrot-500/50 text-parrot-300 shadow-lg shadow-parrot-500/10"
                      : "bg-surface-200 border-surface-300/40 text-surface-600 hover:border-surface-400/60",
                  ].join(" ")}
                >
                  <span className="text-xl">🔊</span>
                  <span>Vocal + micro</span>
                  <span className="text-xs opacity-70 font-normal">TTS &amp; reconnaissance</span>
                </button>
                <button
                  onClick={() => setTextOnly(true)}
                  className={[
                    "flex flex-col items-center gap-1.5 py-3 px-3 rounded-xl border text-sm font-medium transition-all",
                    textOnly
                      ? "bg-parrot-500/20 border-parrot-500/50 text-parrot-300 shadow-lg shadow-parrot-500/10"
                      : "bg-surface-200 border-surface-300/40 text-surface-600 hover:border-surface-400/60",
                  ].join(" ")}
                >
                  <span className="text-xl">📖</span>
                  <span>Texte seul</span>
                  <span className="text-xs opacity-70 font-normal">Lecture manuelle</span>
                </button>
              </div>

              <Card>
                <div className={["space-y-4 transition-opacity", textOnly ? "opacity-40 pointer-events-none select-none" : ""].join(" ")}>
                  {/* Vitesse */}
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-sm text-surface-700">Vitesse de lecture</label>
                      <span className="text-sm font-semibold text-parrot-400">
                        {speechRate === 1 ? "Normale" : speechRate < 1 ? `${Math.round(speechRate * 100)}%` : `×${speechRate}`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={1.8}
                      step={0.1}
                      value={speechRate}
                      onChange={(e) => setSpeechRate(Number(e.target.value))}
                      className="w-full accent-parrot-500"
                      tabIndex={textOnly ? -1 : 0}
                    />
                    <div className="flex justify-between text-xs text-surface-500 mt-1">
                      <span>Lent</span>
                      <span>Rapide</span>
                    </div>
                  </div>
                  {/* Langue */}
                  <div>
                    <label className="text-sm text-surface-700 block mb-2">Langue</label>
                    <select
                      value={speechLang}
                      onChange={(e) => setSpeechLang(e.target.value)}
                      className="w-full bg-surface-300/50 border border-surface-400/30 rounded-xl px-4 h-10 text-surface-900 text-sm focus:outline-none focus:border-parrot-500/60"
                      tabIndex={textOnly ? -1 : 0}
                    >
                      <option value="fr-FR">Français</option>
                      <option value="en-US">English (US)</option>
                      <option value="en-GB">English (UK)</option>
                      <option value="es-ES">Español</option>
                      <option value="de-DE">Deutsch</option>
                      <option value="it-IT">Italiano</option>
                    </select>
                  </div>
                </div>
              </Card>
            </div>

            {/* CTA */}
            <div className="pt-2">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                disabled={!selectedChar}
                onClick={handleStart}
                icon={<span className="text-base">🎭</span>}
              >
                Commencer la répétition
              </Button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function StatTile({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-surface-200 border border-surface-300/40 rounded-xl p-3 text-center">
      <p
        className={[
          "text-2xl font-bold leading-none mb-1",
          highlight ? "text-parrot-400" : "text-surface-900",
        ].join(" ")}
      >
        {value}
      </p>
      <p className="text-xs text-surface-600">{label}</p>
    </div>
  );
}
