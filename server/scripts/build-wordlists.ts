/**
 * Regenerates curated word lists under src/wordlists/.
 * Cities: optional json-cities.json → cities.txt → atlas.txt (India-heavy, 4000+).
 *
 * json-cities.json is gitignored (>100MB). The committed cities.txt is used at
 * build/runtime. To refresh cities from source, download json-cities.json into
 * server/src/wordlists/ then run this script.
 *
 * Run: bun run scripts/build-wordlists.ts
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "../src/wordlists");
const CITIES_JSON_PATH = resolve(outDir, "json-cities.json");
const CITIES_TXT_PATH = resolve(outDir, "cities.txt");

const PETS = [
  "aardvark", "addax", "agouti", "albatross", "alligator", "alpaca", "anaconda",
  "angelfish", "ant", "anteater", "antelope", "ape", "armadillo", "axolotl",
  "baboon", "badger", "bandicoot", "barracuda", "basilisk", "bat", "beagle",
  "bear", "beaver", "bee", "beetle", "bison", "bobcat", "boar", "buffalo",
  "bulldog", "bullfrog", "butterfly", "buzzard", "camel", "canary", "capuchin",
  "caracal", "caribou", "carp", "cat", "catfish", "centipede", "chameleon",
  "cheetah", "chicken", "chihuahua", "chimp", "chinchilla", "chipmunk", "clam",
  "cobra", "cockatoo", "cockroach", "cod", "collie", "condor", "coral",
  "cougar", "cow", "coyote", "crab", "crane", "cricket", "crocodile", "crow",
  "cuckoo", "dalmatian", "deer", "dingo", "dinosaur", "dog", "dolphin", "donkey",
  "dormouse", "dove", "dragonfly", "duck", "eagle", "earthworm", "echidna",
  "eel", "egret", "eland", "elephant", "elk", "emu", "falcon", "ferret",
  "finch", "firefly", "fish", "flamingo", "flea", "fly", "fox", "frog",
  "gazelle", "gecko", "gerbil", "gibbon", "giraffe", "gnu", "goat", "goldfish",
  "goose", "gorilla", "grasshopper", "greyhound", "grouse", "gull", "hamster",
  "hare", "hawk", "hedgehog", "heron", "hippo", "hornet", "horse", "hound",
  "husky", "hyena", "ibex", "ibis", "iguana", "impala", "jackal", "jaguar",
  "jay", "jellyfish", "kangaroo", "kingfisher", "kinkajou", "kitten", "kiwi",
  "koala", "koi", "komodo", "krill", "ladybug", "lamb", "lark", "leech",
  "lemur", "leopard", "lion", "lizard", "llama", "lobster", "locust", "loris",
  "lynx", "macaw", "magpie", "malamute", "mallard", "mammoth", "manatee",
  "mandrill", "mantis", "mare", "marten", "meerkat", "mink", "mole", "mongoose",
  "monkey", "moose", "mosquito", "moth", "mouse", "mule", "narwhal", "newt",
  "nightingale", "ocelot", "octopus", "okapi", "opossum", "orangutan", "orca",
  "oriole", "ostrich", "otter", "owl", "ox", "oyster", "panda", "panther",
  "parakeet", "parrot", "partridge", "peacock", "pelican", "penguin", "pheasant",
  "pig", "pigeon", "pika", "piranha", "platypus", "pony", "porcupine", "possum",
  "prawn", "puffin", "puma", "puppy", "python", "quail", "rabbit", "raccoon",
  "rat", "raven", "reindeer", "rhino", "robin", "rooster", "salamander", "salmon",
  "scallop", "scorpion", "seahorse", "seal", "shark", "sheep", "shrew", "shrimp",
  "skunk", "sloth", "slug", "snail", "snake", "sparrow", "spider", "squid",
  "squirrel", "stag", "stallion", "starfish", "stingray", "stoat", "stork",
  "swan", "tabby", "tadpole", "tamarin", "tapir", "tarantula", "termite",
  "terrier", "thrush", "tiger", "toad", "tortoise", "toucan", "trout", "tuna",
  "turkey", "turtle", "unicorn", "urchin", "viper", "vole", "vulture", "wallaby",
  "walrus", "wasp", "weasel", "whale", "wildcat", "wolf", "wolverine", "wombat",
  "woodpecker", "worm", "wren", "yak", "zebra", "zebu",
];

const COUNTRIES = [
  "afghanistan", "albania", "algeria", "andorra", "angola", "antigua and barbuda",
  "argentina", "armenia", "australia", "austria", "azerbaijan", "bahamas", "bahrain",
  "bangladesh", "barbados", "belarus", "belgium", "belize", "benin", "bhutan",
  "bolivia", "bosnia and herzegovina", "botswana", "brazil", "brunei", "bulgaria",
  "burkina faso", "burundi", "cabo verde", "cambodia", "cameroon", "canada",
  "central african republic", "chad", "chile", "china", "colombia", "comoros", "congo",
  "costa rica", "croatia", "cuba", "cyprus", "czechia", "democratic republic of the congo",
  "denmark", "djibouti", "dominica", "dominican republic", "ecuador", "egypt",
  "el salvador", "equatorial guinea", "eritrea", "estonia", "eswatini", "ethiopia",
  "fiji", "finland", "france", "gabon", "gambia", "georgia", "germany", "ghana",
  "greece", "grenada", "guatemala", "guinea", "guinea bissau", "guyana", "haiti",
  "honduras", "hungary", "iceland", "india", "indonesia", "iran", "iraq", "ireland",
  "israel", "italy", "ivory coast", "jamaica", "japan", "jordan", "kazakhstan", "kenya",
  "kiribati", "kosovo", "kuwait", "kyrgyzstan", "laos", "latvia", "lebanon", "lesotho",
  "liberia", "libya", "liechtenstein", "lithuania", "luxembourg", "madagascar", "malawi",
  "malaysia", "maldives", "mali", "malta", "marshall islands", "mauritania", "mauritius",
  "mexico", "micronesia", "moldova", "monaco", "mongolia", "montenegro", "morocco",
  "mozambique", "myanmar", "namibia", "nauru", "nepal", "netherlands", "new zealand",
  "nicaragua", "niger", "nigeria", "north korea", "north macedonia", "norway", "oman",
  "pakistan", "palau", "palestine", "panama", "papua new guinea", "paraguay", "peru",
  "philippines", "poland", "portugal", "qatar", "republic of the congo", "romania",
  "russia", "rwanda", "saint kitts and nevis", "saint lucia",
  "saint vincent and the grenadines", "samoa", "san marino", "sao tome and principe",
  "saudi arabia", "senegal", "serbia", "seychelles", "sierra leone", "singapore",
  "slovakia", "slovenia", "solomon islands", "somalia", "south africa", "south korea",
  "south sudan", "spain", "sri lanka", "sudan", "suriname", "sweden", "switzerland",
  "syria", "taiwan", "tajikistan", "tanzania", "thailand", "timor leste", "togo", "tonga",
  "trinidad and tobago", "tunisia", "turkey", "turkmenistan", "tuvalu", "uganda",
  "ukraine", "united arab emirates", "united kingdom", "united states", "uruguay",
  "uzbekistan", "vanuatu", "vatican city", "venezuela", "vietnam", "yemen", "zambia",
  "zimbabwe",
];

/** Extra Indian / international cities not always in the dataset. */
const CITY_SUPPLEMENT = [
  "ram nagar", "ramnagar", "srinagar", "new delhi", "old delhi", "greater noida",
  "salt lake", "santacruz", "andheri", "bandra", "powai", "worli", "malad",
  "borivali", "thane west", "vashi", "nerul", "belapur", "panaji", "mapusa",
  "margao", "vasco da gama", "hubli", "dharwad", "belgaum", "gulbarga", "mysuru",
  "shivamogga", "tumakuru", "ballari", "raichur", "bidar", "hassan", "mandya",
  "chamarajanagar", "chikmagalur", "udupi", "karwar", "bagalkot", "bijapur",
  "gangtok", "namchi", "itanagar", "pasighat", "aizawl", "lunglei", "kohima",
  "dimapur", "imphal", "churachandpur", "shillong", "tura", "agartala", "udaipur",
  "jaisalmer", "bikaner", "ajmer", "kota", "alwar", "bharatpur", "sikar", "pali",
  "barmer", "jodhpur", "mount abu", "pushkar", "silchar", "dibrugarh", "jorhat",
  "tezpur", "nagaon", "guwahati", "darjeeling", "siliguri", "asansol", "durgapur",
  "bardhaman", "howrah", "salt lake city", "new town",
  "paris", "london", "tokyo", "berlin", "rome", "madrid", "sydney", "toronto",
  "chicago", "boston", "seattle", "miami", "dallas", "houston", "denver",
];

const CODING = [
  "agile", "algorithm", "angular", "ansible", "apache", "api", "app", "array",
  "async", "await", "backend", "bash", "binary", "bitwise", "boolean", "branch",
  "buffer", "bug", "byte", "bytecode", "cache", "callback", "charset", "class",
  "client", "closure", "cloud", "cluster", "code", "codec", "coding", "commit",
  "compile", "compiler", "component", "compute", "console", "const", "constant",
  "constructor", "container", "context", "cookie", "cpu", "cron", "css", "cursor",
  "daemon", "data", "database", "datatype", "debug", "debugger", "decimal", "deploy",
  "devops", "django", "docker", "domain", "dynamic", "element", "elixir", "encode",
  "encrypt", "endpoint", "enum", "erlang", "error", "event", "exception", "execute",
  "export", "express", "extension", "fetch", "filter", "firewall", "firmware",
  "fixture", "flask", "float", "for", "format", "fortran", "framework", "frontend",
  "function", "gateway", "generic", "github", "gitlab", "global", "golang", "gradle",
  "graphql", "grep", "hack", "handler", "hardware", "hash", "hashtable", "haskell",
  "header", "heap", "hex", "host", "hosting", "html", "http", "https", "immutable",
  "import", "index", "inherit", "input", "install", "integer", "interface",
  "internet", "iterator", "java", "javascript", "jenkins", "json", "kafka", "kernel",
  "keyword", "kotlin", "kubernetes", "lambda", "laravel", "library", "license",
  "linker", "linux", "literal", "loader", "localhost", "logging", "logic", "loop",
  "lua", "machine", "malloc", "manifest", "mapper", "memory", "merge", "method",
  "middleware", "migrate", "module", "mongodb", "monitor", "mysql", "namespace",
  "native", "network", "nginx", "nim", "node", "nodejs", "null", "numpy", "object",
  "octave", "opcode", "operand", "operator", "optimize", "output", "package",
  "packet", "pandas", "parallel", "parser", "patch", "payload", "perl", "pixel",
  "platform", "plugin", "pointer", "postgres", "process", "promise", "property",
  "protocol", "proxy", "python", "query", "queue", "rails", "random", "react",
  "reactor", "record", "recurse", "redis", "refactor", "regex", "register",
  "release", "remote", "render", "replica", "request", "response", "return",
  "router", "ruby", "runtime", "rust", "sandbox", "scala", "schema", "scope",
  "script", "semver", "serialize", "server", "service", "session", "shell",
  "socket", "software", "solidity", "source", "spark", "spawn", "spring", "sql",
  "sqlite", "stack", "static", "stderr", "stdin", "stdout", "storage", "string",
  "struct", "subnet", "sudo", "svelte", "swift", "switch", "syntax", "syscall",
  "system", "table", "template", "terminal", "terraform", "thread", "throttle",
  "token", "toolchain", "trait", "transaction", "transform", "tuple", "typescript",
  "ubuntu", "unicode", "unittest", "unix", "update", "upload", "utility", "uuid",
  "validate", "variable", "vector", "version", "virtual", "vmware", "vue", "web",
  "webhook", "webpack", "website", "widget", "window", "workflow", "wrapper",
  "yaml", "yield", "zig",
];

interface CityRow {
  name: string;
  country_code: string;
}

function normalizeAtlasWord(word: string): string {
  return word.toLowerCase().trim().replace(/\s+/g, " ");
}

function normalizeCityName(name: string): string | null {
  const ascii = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (ascii.length < 3) return null;
  if (!/^[a-z]+(?: [a-z]+)*$/.test(ascii)) return null;
  return ascii;
}

function buildCitiesFromJson(): string[] {
  console.log(`Reading ${CITIES_JSON_PATH} …`);
  const raw = readFileSync(CITIES_JSON_PATH, "utf8");
  const rows = JSON.parse(raw) as CityRow[];

  const indian = new Set<string>();
  const international = new Set<string>();

  for (const row of rows) {
    const normalized = normalizeCityName(row.name);
    if (!normalized) continue;
    if (row.country_code === "IN") {
      indian.add(normalized);
    } else {
      international.add(normalized);
    }
  }

  for (const name of CITY_SUPPLEMENT) {
    const normalized = normalizeCityName(name);
    if (normalized) indian.add(normalized);
  }

  const intlSorted = [...international].sort((a, b) => a.localeCompare(b));
  const minCities = 4000;
  const intlCap = Math.max(0, minCities - indian.size);
  const intlPick = intlSorted.slice(0, intlCap);
  const cities = [...indian, ...intlPick].sort((a, b) => a.localeCompare(b));

  console.log(
    `Cities: ${indian.size} India + ${intlPick.length} international = ${cities.length} total`,
  );
  return cities;
}

function writeCitiesTxt(cities: string[]): void {
  writeFileSync(CITIES_TXT_PATH, `${cities.join("\n")}\n`, "utf8");
  console.log(`Wrote ${CITIES_TXT_PATH} (${cities.length} cities)`);
}

function loadCitiesTxt(): string[] {
  const raw = readFileSync(CITIES_TXT_PATH, "utf8");
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length >= 3);
}

function writeList(name: string, words: string[]): void {
  const unique = [...new Set(words.map((w) => w.toLowerCase().trim()))]
    .filter((w) => w.length >= 3 && /^[a-z]+$/.test(w))
    .sort();
  const path = resolve(outDir, name);
  writeFileSync(path, `${unique.join("\n")}\n`, "utf8");
  console.log(`Wrote ${path} (${unique.length} words)`);
}

function writeAtlasList(countries: string[], cities: string[]): void {
  const unique = [
    ...new Set([...countries, ...cities].map(normalizeAtlasWord)),
  ]
    .filter((w) => w.length >= 3 && /^[a-z]+(?: [a-z]+)*$/.test(w))
    .sort();
  const path = resolve(outDir, "atlas.txt");
  writeFileSync(path, `${unique.join("\n")}\n`, "utf8");
  const countrySet = new Set(countries.map(normalizeAtlasWord));
  const cityCount = unique.filter((w) => !countrySet.has(w)).length;
  console.log(
    `Wrote ${path} (${unique.length} entries: ${countries.length} countries + ${cityCount} cities)`,
  );
}

function resolveCities(): string[] {
  if (existsSync(CITIES_JSON_PATH)) {
    const cities = buildCitiesFromJson();
    writeCitiesTxt(cities);
    return cities;
  }
  if (existsSync(CITIES_TXT_PATH)) {
    console.log(
      `Using ${CITIES_TXT_PATH} (place json-cities.json locally to regenerate from source)`,
    );
    return loadCitiesTxt();
  }
  throw new Error(
    `Missing city data. Add ${CITIES_TXT_PATH} or download json-cities.json into server/src/wordlists/.`,
  );
}

function main(): void {
  writeList("pets.txt", PETS);
  writeList("coding.txt", CODING);

  const citiesFromTxt = resolveCities();
  writeAtlasList(COUNTRIES.map(normalizeAtlasWord), citiesFromTxt);
}

main();
