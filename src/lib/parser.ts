import type { Line, Script } from "@/types";
import { nanoid } from "@/lib/nanoid";

/**
 * Parse a theater script with the format:
 *   CHARACTER: line text
 *
 * Multi-line continuations (lines that don't start with "CHARACTER:") are
 * appended to the previous line.
 */
export function parseScript(rawText: string, title: string): Script {
  const now = Date.now();
  const lines: Line[] = [];
  const characterSet = new Set<string>();

  const rawLines = rawText.split("\n");
  let lineIndex = 0;

  for (const raw of rawLines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    // Match "CHARACTER: text", "CHARACTER. text", or "CHARACTER; text"
    // Character name starts with uppercase, does not contain the separator itself
    const match = trimmed.match(/^([A-ZÀÂÇÉÈÊËÎÏÔÙÛÜ][^:;.\n]{0,40})[:.;]\s*(.*)$/);

    if (match) {
      const character = match[1].trim();
      const text = match[2].trim();
      characterSet.add(character);
      lines.push({ id: nanoid(), character, text, index: lineIndex++ });
    } else if (lines.length > 0) {
      // continuation line — append to previous
      lines[lines.length - 1].text += " " + trimmed;
    }
  }

  return {
    id: nanoid(),
    title,
    rawText,
    lines,
    characters: Array.from(characterSet),
    createdAt: now,
    updatedAt: now,
  };
}

export function updateScriptText(script: Script, rawText: string): Script {
  const parsed = parseScript(rawText, script.title);
  return {
    ...parsed,
    id: script.id,
    title: script.title,
    createdAt: script.createdAt,
    updatedAt: Date.now(),
  };
}
