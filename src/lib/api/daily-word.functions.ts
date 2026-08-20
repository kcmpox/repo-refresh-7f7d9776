import { createServerFn } from "@tanstack/react-start";

function todayYMD(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const FALLBACK_WORDS = [
  "cigar",
  "rebut",
  "sissy",
  "humph",
  "stump",
  "altar",
  "again",
  "spite",
  "lathe",
  "blast",
  "faint",
  "blame",
  "shaft",
  "crane",
  "terse",
  "quiet",
  "flame",
  "baker",
  "snare",
  "grape",
  "horse",
  "stone",
  "brave",
  "shine",
  "nurse",
  "house",
  "price",
  "ocean",
  "voice",
  "sauce",
  "amber",
  "liver",
  "pride",
  "ridge",
  "yacht",
  "smile",
  "crisp",
  "mound",
  "thorn",
  "gloom",
  "cliff",
  "spicy",
  "dough",
  "sweep",
  "vivid",
  "trunk",
  "frost",
  "plumb",
  "hover",
];

function fallbackWord(date: string): string {
  let hash = 0;
  for (let i = 0; i < date.length; i++) {
    hash = (hash * 31 + date.charCodeAt(i)) >>> 0;
  }
  return FALLBACK_WORDS[hash % FALLBACK_WORDS.length];
}

export const getDailyWord = createServerFn({ method: "GET" }).handler(
  async () => {
    const date = todayYMD();

    try {
      const url = `https://www.nytimes.com/svc/wordle/v2/${date}.json`;
      console.log("Buscando:", url);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(url, {
        signal: controller.signal,
      });

      clearTimeout(timeout);

      console.log({
        status: res.status,
        ok: res.ok,
        type: res.type,
        url: res.url,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = (await res.json()) as { solution?: string };

      console.log(data);

      if (!data.solution) throw new Error("no solution");

      return {
        word: data.solution,
        source: "nyt" as const,
        date,
      };
    } catch (err) {
      console.error("getDailyWord:", err);

      return {
        word: fallbackWord(date),
        source: "fallback" as const,
        date,
      };
    }
  }
);
