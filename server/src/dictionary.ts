import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const DICT_PATH = resolve(here, "dictionary.txt");

let dictionary: Set<string> | null = null;

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

export function isRealWord(word: string): boolean {
  return loadDictionary().has(word.trim().toLowerCase());
}

export function dictionarySize(): number {
  return loadDictionary().size;
}
