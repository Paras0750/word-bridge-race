/**
 * Regenerates curated pets.txt, atlas.txt, and coding.txt under src/wordlists/.
 * Run: bun run scripts/build-wordlists.ts
 */

import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "../src/wordlists");

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
  "afghanistan", "albania", "algeria", "andorra", "angola", "argentina",
  "armenia", "australia", "austria", "azerbaijan", "bahamas", "bahrain",
  "bangladesh", "barbados", "belarus", "belgium", "belize", "benin", "bhutan",
  "bolivia", "botswana", "brazil", "brunei", "bulgaria", "burkina", "burundi",
  "cambodia", "cameroon", "canada", "chad", "chile", "china", "colombia",
  "comoros", "congo", "croatia", "cuba", "cyprus", "denmark", "djibouti",
  "dominica", "ecuador", "egypt", "eritrea", "estonia", "eswatini", "ethiopia",
  "fiji", "finland", "france", "gabon", "gambia", "georgia", "germany", "ghana",
  "greece", "grenada", "guatemala", "guinea", "guyana", "haiti", "honduras",
  "hungary", "iceland", "india", "indonesia", "iran", "iraq", "ireland", "israel",
  "italy", "jamaica", "japan", "jordan", "kazakhstan", "kenya", "kiribati",
  "kosovo", "kuwait", "kyrgyzstan", "laos", "latvia", "lebanon", "lesotho",
  "liberia", "libya", "liechtenstein", "lithuania", "luxembourg", "madagascar",
  "malawi", "malaysia", "maldives", "mali", "malta", "mauritania", "mauritius",
  "mexico", "micronesia", "moldova", "monaco", "mongolia", "montenegro",
  "morocco", "mozambique", "myanmar", "namibia", "nauru", "nepal", "nicaragua",
  "niger", "nigeria", "norway", "oman", "pakistan", "palau", "panama", "paraguay",
  "peru", "philippines", "poland", "portugal", "qatar", "romania", "russia",
  "rwanda", "samoa", "senegal", "serbia", "seychelles", "singapore", "slovakia",
  "slovenia", "somalia", "spain", "sudan", "suriname", "sweden", "switzerland",
  "syria", "taiwan", "tajikistan", "tanzania", "thailand", "togo", "tonga",
  "tunisia", "turkey", "turkmenistan", "tuvalu", "uganda", "ukraine", "uruguay",
  "uzbekistan", "vanuatu", "venezuela", "vietnam", "yemen", "zambia", "zimbabwe",
];

const CITIES = [
  "aberdeen", "adelaide", "albany", "amsterdam", "ankara", "antwerp", "athens",
  "atlanta", "auckland", "austin", "baltimore", "bangkok", "barcelona", "basel",
  "beijing", "beirut", "belfast", "berlin", "bern", "birmingham", "bogota",
  "bologna", "bonn", "boston", "boulder", "bournemouth", "bradford", "brasilia",
  "bremen", "bristol", "brussels", "bucharest", "budapest", "buffalo",
  "burlington", "cairo", "calgary", "cambridge", "canberra", "cardiff", "casablanca",
  "charlotte", "chennai", "chicago", "cincinnati", "cleveland", "cologne",
  "columbus", "copenhagen", "dallas", "darwin", "delhi", "denver", "detroit",
  "doha", "dresden", "dubai", "dublin", "dunedin", "durban", "edinburgh",
  "edmonton", "exeter", "florence", "frankfurt", "fresno", "geneva", "glasgow",
  "gothenburg", "halifax", "hamburg", "hamilton", "hartford", "helsinki",
  "houston", "indianapolis", "inverness", "istanbul", "jakarta", "johannesburg",
  "kabul", "karachi", "kiev", "kingston", "kolkata", "lagos", "leeds",
  "leicester", "leipzig", "lima", "lisbon", "liverpool", "london",
  "louisville", "lyon", "madrid", "manchester", "manila", "marseille", "melbourne",
  "memphis", "mexico", "miami", "milan", "milwaukee", "minneapolis", "monaco",
  "montreal", "moscow", "mumbai", "munich", "nagoya", "nairobi", "naples",
  "nashville", "newark", "nice", "nottingham", "oakland", "osaka", "oslo",
  "ottawa", "oxford", "paris", "perth", "philadelphia", "phoenix", "pittsburgh",
  "plymouth", "portland", "portsmouth", "prague", "providence", "quebec", "quito",
  "raleigh", "reading", "regina", "reykjavik", "richmond", "rio", "riyadh",
  "rochester", "rome", "rotterdam", "sacramento", "santiago", "sapporo", "seattle",
  "seoul", "seville", "shanghai", "sheffield", "singapore", "sofia", "southampton",
  "stockholm", "stuttgart", "sydney", "syracuse", "taipei", "tampa", "tehran",
  "tokyo", "toledo", "toronto", "toulouse", "tucson", "tulsa", "turin", "utrecht",
  "valencia", "vancouver", "venice", "vienna", "warsaw", "washington", "wellington",
  "winnipeg", "yokohama", "york", "zurich",
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

function writeList(name: string, words: string[]): void {
  const unique = [...new Set(words.map((w) => w.toLowerCase().trim()))]
    .filter((w) => w.length >= 3 && /^[a-z]+$/.test(w))
    .sort();
  const path = resolve(outDir, name);
  writeFileSync(path, `${unique.join("\n")}\n`, "utf8");
  console.log(`Wrote ${path} (${unique.length} words)`);
}

writeList("pets.txt", PETS);
writeList("atlas.txt", [...COUNTRIES, ...CITIES]);
writeList("coding.txt", CODING);
