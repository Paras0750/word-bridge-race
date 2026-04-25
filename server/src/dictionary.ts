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

export function dictionarySize(): number {
  return loadDictionary().size;
}
