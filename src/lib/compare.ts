import type { ComparisonResult, Settings } from "@/types";

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacritics
    .replace(/[^a-z0-9\s]/g, "")     // remove punctuation
    .replace(/\s+/g, " ")
    .trim();
}

/** Levenshtein distance between two strings */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1];
      else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/** Word-level overlap ratio (Jaccard-like) */
function wordOverlap(a: string, b: string): number {
  const wa = new Set(a.split(" ").filter(Boolean));
  const wb = new Set(b.split(" ").filter(Boolean));
  const intersection = [...wa].filter((w) => wb.has(w)).length;
  const union = new Set([...wa, ...wb]).size;
  return union === 0 ? 1 : intersection / union;
}

const THRESHOLDS: Record<Settings["comparisonMode"], { close: number; exact: number }> = {
  strict: { close: 0.9,  exact: 0.97 },
  normal: { close: 0.7,  exact: 0.9  },
  loose:  { close: 0.5,  exact: 0.75 },
};

export function compareLines(
  spoken: string,
  expected: string,
  mode: Settings["comparisonMode"] = "normal"
): ComparisonResult {
  const s = normalize(spoken);
  const e = normalize(expected);

  if (!s) return "wrong";
  if (s === e) return "exact";

  const maxLen = Math.max(s.length, e.length);
  const dist = levenshtein(s, e);
  const charSimilarity = maxLen === 0 ? 1 : 1 - dist / maxLen;
  const wordSim = wordOverlap(s, e);
  const similarity = 0.5 * charSimilarity + 0.5 * wordSim;

  const t = THRESHOLDS[mode];
  if (similarity >= t.exact) return "exact";
  if (similarity >= t.close) return "close";
  return "wrong";
}
