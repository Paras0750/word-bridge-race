import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { WordListId } from "./types";
import { WORD_LIST_IDS } from "./types";

const here = dirname(fileURLToPath(import.meta.url));
const LISTS_DIR = resolve(here, "wordlists");

const REGISTRY: Record<WordListId, { file: string; minLength: number }> = {
  dictionary: { file: "dictionary.txt", minLength: 3 },
  pets: { file: "pets.txt", minLength: 3 },
  atlas: { file: "atlas.txt", minLength: 3 },
  coding: { file: "coding.txt", minLength: 3 },
};

const wordLists = new Map<WordListId, Set<string>>();
const firstLastIndexes = new Map<WordListId, Map<string, number>>();

export function normalizeEntry(word: string, listId: WordListId): string {
  const trimmed = word.trim().toLowerCase();
  if (listId === "atlas") {
    return trimmed.replace(/\s+/g, " ");
  }
  return trimmed;
}

function isValidEntry(raw: string, listId: WordListId, minLength: number): boolean {
  const w = normalizeEntry(raw, listId);
  if (w.length < minLength) return false;
  if (listId === "atlas") {
    return /^[a-z]+(?: [a-z]+)*$/.test(w);
  }
  return /^[a-z]+$/.test(w);
}

function loadWordList(listId: WordListId): Set<string> {
  const cached = wordLists.get(listId);
  if (cached) return cached;

  const { file, minLength } = REGISTRY[listId];
  const path = resolve(LISTS_DIR, file);
  const raw = readFileSync(path, "utf8");
  const set = new Set<string>();
  for (const line of raw.split("\n")) {
    const w = normalizeEntry(line, listId);
    if (isValidEntry(w, listId, minLength)) set.add(w);
  }
  wordLists.set(listId, set);
  return set;
}

export function loadAllWordLists(): void {
  for (const listId of WORD_LIST_IDS) {
    loadWordList(listId);
  }
}

function ensureIndex(listId: WordListId): Map<string, number> {
  const cached = firstLastIndexes.get(listId);
  if (cached) return cached;

  const idx = new Map<string, number>();
  for (const w of loadWordList(listId)) {
    const first = w[0];
    const last = w[w.length - 1];
    if (!first || !last) continue;
    const key = `${first}${last}`;
    idx.set(key, (idx.get(key) ?? 0) + 1);
  }
  firstLastIndexes.set(listId, idx);
  return idx;
}

export function isValidWord(word: string, listId: WordListId): boolean {
  return loadWordList(listId).has(normalizeEntry(word, listId));
}

export function countMatching(
  start: string,
  end: string,
  listId: WordListId,
): number {
  const s = start.trim().toLowerCase();
  const e = end.trim().toLowerCase();
  if (!s || !e) return 0;
  if (s.length === 1 && e.length === 1) {
    return ensureIndex(listId).get(`${s}${e}`) ?? 0;
  }
  let count = 0;
  for (const w of loadWordList(listId)) {
    if (w.startsWith(s) && w.endsWith(e)) {
      count += 1;
      if (count >= 1000) break;
    }
  }
  return count;
}

export function sampleMatching(
  start: string,
  end: string,
  exclude: Set<string>,
  limit: number,
  listId: WordListId,
): string[] {
  const s = start.trim().toLowerCase();
  const e = end.trim().toLowerCase();
  if (!s || !e || limit <= 0) return [];
  const out: string[] = [];
  for (const w of loadWordList(listId)) {
    if (w.startsWith(s) && w.endsWith(e) && !exclude.has(w)) {
      out.push(w);
      if (out.length >= limit * 8) break;
    }
  }
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out.slice(0, limit);
}

function differsByOneEdit(a: string, b: string): boolean {
  if (a === b) return false;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  if (la === lb) {
    let diffs = 0;
    for (let i = 0; i < la; i++) {
      if (a[i] !== b[i]) {
        diffs++;
        if (diffs > 1) return false;
      }
    }
    return diffs === 1;
  }
  const longer = la > lb ? a : b;
  const shorter = la > lb ? b : a;
  let i = 0;
  let j = 0;
  let diffs = 0;
  while (i < longer.length && j < shorter.length) {
    if (longer[i] !== shorter[j]) {
      diffs++;
      if (diffs > 1) return false;
      i++;
    } else {
      i++;
      j++;
    }
  }
  return true;
}

export function isAlmostMatch(
  word: string,
  start: string,
  end: string,
  listId: WordListId,
): boolean {
  const w = word.trim().toLowerCase();
  if (w.length < 3) return false;
  const s = start.trim().toLowerCase();
  const e = end.trim().toLowerCase();
  if (!s || !e) return false;
  const dict = loadWordList(listId);
  const startedAt = Date.now();
  let checked = 0;
  for (const candidate of dict) {
    if (Date.now() - startedAt > 12) break;
    if (Math.abs(candidate.length - w.length) > 1) continue;
    if (!candidate.startsWith(s) || !candidate.endsWith(e)) continue;
    checked++;
    if (differsByOneEdit(w, candidate)) return true;
    if (checked >= 500) break;
  }
  return false;
}

export function wordListSize(listId: WordListId): number {
  return loadWordList(listId).size;
}

export function allWordListSizes(): Record<WordListId, number> {
  const out = {} as Record<WordListId, number>;
  for (const listId of WORD_LIST_IDS) {
    out[listId] = wordListSize(listId);
  }
  return out;
}

const PICKABLE_START_LETTERS = "abcdefghijklmnoprstuvwy".split("");
const PICKABLE_END_LETTERS = "abcdefghiklmnoprstuvwy".split("");

const validStartCache = new Map<WordListId, string[]>();
const validEndCache = new Map<string, string[]>();

export function validStartLetters(listId: WordListId): string[] {
  const cached = validStartCache.get(listId);
  if (cached) return cached;
  const found = new Set<string>();
  for (const w of loadWordList(listId)) {
    const first = w[0];
    if (first) found.add(first);
  }
  const letters = PICKABLE_START_LETTERS.filter((l) => found.has(l));
  validStartCache.set(listId, letters);
  return letters;
}

export function validEndLetters(start: string, listId: WordListId): string[] {
  const s = start.trim().toLowerCase();
  const cacheKey = `${listId}:${s}`;
  const cached = validEndCache.get(cacheKey);
  if (cached) return cached;
  const found = new Set<string>();
  for (const w of loadWordList(listId)) {
    if (w.startsWith(s)) {
      const last = w[w.length - 1];
      if (last) found.add(last);
    }
  }
  const letters = PICKABLE_END_LETTERS.filter((l) => found.has(l));
  validEndCache.set(cacheKey, letters);
  return letters;
}

export function pickRandomLetter(
  slot: "start" | "end",
  listId: WordListId,
  start = "",
): string {
  const pool =
    slot === "end" ? validEndLetters(start, listId) : validStartLetters(listId);
  const fallback = slot === "end" ? PICKABLE_END_LETTERS : PICKABLE_START_LETTERS;
  const letters = pool.length > 0 ? pool : fallback;
  return letters[Math.floor(Math.random() * letters.length)] ?? "a";
}

export function isPickableLetter(
  slot: "start" | "end",
  letter: string,
  listId: WordListId,
  start = "",
): boolean {
  const normalized = letter.trim().toLowerCase();
  const pool =
    slot === "end"
      ? validEndLetters(start, listId)
      : validStartLetters(listId);
  return pool.includes(normalized);
}
