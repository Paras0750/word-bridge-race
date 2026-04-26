import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const DICT_PATH = resolve(here, "dictionary.txt");

let dictionary: Set<string> | null = null;
let firstLastIndex: Map<string, number> | null = null;

export function loadDictionary(): Set<string> {
  if (dictionary) return dictionary;
  const raw = readFileSync(DICT_PATH, "utf8");
  const set = new Set<string>();
  for (const line of raw.split("\n")) {
    const w = line.trim().toLowerCase();
    if (w.length >= 3) set.add(w);
  }
  dictionary = set;
  return set;
}

function ensureIndex(): Map<string, number> {
  if (firstLastIndex) return firstLastIndex;
  const idx = new Map<string, number>();
  for (const w of loadDictionary()) {
    const first = w[0];
    const last = w[w.length - 1];
    if (!first || !last) continue;
    const key = `${first}${last}`;
    idx.set(key, (idx.get(key) ?? 0) + 1);
  }
  firstLastIndex = idx;
  return idx;
}

export function isRealWord(word: string): boolean {
  return loadDictionary().has(word.trim().toLowerCase());
}

export function countMatching(start: string, end: string): number {
  const s = start.trim().toLowerCase();
  const e = end.trim().toLowerCase();
  if (!s || !e) return 0;
  if (s.length === 1 && e.length === 1) {
    return ensureIndex().get(`${s}${e}`) ?? 0;
  }
  let count = 0;
  for (const w of loadDictionary()) {
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
): string[] {
  const s = start.trim().toLowerCase();
  const e = end.trim().toLowerCase();
  if (!s || !e || limit <= 0) return [];
  const out: string[] = [];
  for (const w of loadDictionary()) {
    if (w.startsWith(s) && w.endsWith(e) && !exclude.has(w)) {
      out.push(w);
      if (out.length >= limit * 8) break;
    }
  }
  // Random sample
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
): boolean {
  const w = word.trim().toLowerCase();
  if (w.length < 3) return false;
  const s = start.trim().toLowerCase();
  const e = end.trim().toLowerCase();
  if (!s || !e) return false;
  const dict = loadDictionary();
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

export function dictionarySize(): number {
  return loadDictionary().size;
}
