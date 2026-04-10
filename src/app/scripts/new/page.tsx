"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/ui/Button";
import { parseScript } from "@/lib/parser";
import { saveScript } from "@/lib/storage";

const EXAMPLE = `HAMLET: Être ou ne pas être, telle est la question.
OPHÉLIE: Comme votre esprit a changé !
HAMLET: Et qui m'a rendu fou ? Votre amour peut-il l'ignorer ?
OPHÉLIE: Je ne saurais le dire.
HAMLET: Allez dans un couvent, allez !`;

export default function NewScriptPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<{ character: string; line: string }[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function handleTextChange(value: string) {
    setText(value);
    setError("");
    if (value.trim()) {
      const parsed = parseScript(value, "preview");
      setPreview(parsed.lines.slice(0, 8).map((l) => ({ character: l.character, line: l.text })));
    } else {
      setPreview([]);
    }
  }

  function loadExample() {
    setTitle("Hamlet — Acte III");
    handleTextChange(EXAMPLE);
  }

  function handleSave() {
    if (!title.trim()) {
      setError("Veuillez donner un titre à votre script.");
      return;
    }
    if (!text.trim()) {
      setError("Veuillez coller votre texte de script.");
      return;
    }
    const parsed = parseScript(text, title.trim());
    if (parsed.lines.length === 0) {
      setError(
        "Aucune réplique détectée. Vérifiez le format : « PERSONNAGE: réplique »"
      );
      return;
    }
    setSaving(true);
    setTimeout(() => {
      saveScript(parsed);
      router.push(`/scripts/${parsed.id}`);
    }, 200);
  }

  return (
    <main className="min-h-dvh flex flex-col">
      <PageHeader title="Nouveau script" back />

      <div className="flex-1 px-4 pb-8 space-y-4">
        {/* Titre */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-surface-800" htmlFor="title">
            Titre du script
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setError(""); }}
            placeholder="Ex. : Roméo et Juliette — Acte II"
            className="w-full bg-surface-200 border border-surface-300/60 rounded-xl px-4 h-11 text-surface-900 placeholder-surface-500 focus:outline-none focus:border-parrot-500/70 focus:bg-surface-200 transition-colors text-sm"
          />
        </div>

        {/* Textarea */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-surface-800" htmlFor="script-text">
              Texte du script
            </label>
            <button
              onClick={loadExample}
              className="text-xs text-parrot-400 hover:text-parrot-300 transition-colors"
            >
              Voir un exemple
            </button>
          </div>
          <textarea
            id="script-text"
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder={"PERSONNAGE: Votre réplique ici\nAUTRE: Et la suivante…"}
            rows={12}
            className="w-full bg-surface-200 border border-surface-300/60 rounded-xl px-4 py-3 text-surface-900 placeholder-surface-500 focus:outline-none focus:border-parrot-500/70 transition-colors text-sm font-mono leading-relaxed resize-none"
          />
          <p className="text-xs text-surface-500">
            Format : <code className="bg-surface-300/60 px-1 py-0.5 rounded-md">PERSONNAGE: réplique</code>
          </p>
        </div>

        {/* Erreur */}
        {error && (
          <div
            className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-sm"
            style={{ animation: "var(--animate-pop)" }}
          >
            <span className="shrink-0 mt-0.5">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Preview */}
        {preview.length > 0 && (
          <div
            className="space-y-2"
            style={{ animation: "var(--animate-fade-in)" }}
          >
            <p className="text-xs font-medium text-surface-600 uppercase tracking-wider">
              Aperçu
            </p>
            <div className="bg-surface-200 border border-surface-300/40 rounded-xl divide-y divide-surface-300/30 overflow-hidden">
              {preview.map((p, i) => (
                <div key={i} className="flex gap-3 px-3 py-2.5">
                  <span className="text-parrot-400 font-semibold text-xs shrink-0 uppercase tracking-wide pt-0.5 w-28 truncate">
                    {p.character}
                  </span>
                  <span className="text-surface-800 text-sm leading-snug">{p.line}</span>
                </div>
              ))}
              {text.split("\n").filter((l) => l.trim()).length > 8 && (
                <div className="px-3 py-2 text-xs text-surface-500 text-center">
                  et plus…
                </div>
              )}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="pt-2">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={saving}
            onClick={handleSave}
          >
            Enregistrer le script
          </Button>
        </div>
      </div>
    </main>
  );
}
