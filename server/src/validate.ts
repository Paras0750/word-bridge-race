import { isRealWord } from "./dictionary";

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export function validateWord(
  word: string,
  start: string,
  end: string,
  usedWords: Set<string>,
): ValidationResult {
  const w = word.trim().toLowerCase();
  if (w.length === 0) return { valid: false, reason: "empty" };
  if (!/^[a-z]+$/.test(w)) return { valid: false, reason: "letters_only" };

  const s = start.trim().toLowerCase();
  const e = end.trim().toLowerCase();

  if (s && !w.startsWith(s)) return { valid: false, reason: "wrong_start" };
  if (e && !w.endsWith(e)) return { valid: false, reason: "wrong_end" };

  if (s && e) {
    const minLen = s.length + e.length;
    const overlapAllowed = s.length === 1 && e.length === 1 ? 1 : 0;
    if (w.length < minLen - overlapAllowed) return { valid: false, reason: "too_short" };
  }

  if (usedWords.has(w)) return { valid: false, reason: "already_used" };
  if (!isRealWord(w)) return { valid: false, reason: "not_a_word" };

  return { valid: true };
}
