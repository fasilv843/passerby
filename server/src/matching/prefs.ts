import { z } from "zod";

/** "*" means "anyone". */
export const ANY = "*";

export const matchPrefsSchema = z.object({
  mode: z.enum(["video", "text"]).default("video"),
  // ISO 639-1 language code, e.g. "ml"
  language: z.string().regex(/^([a-z]{2}|\*)$/).default(ANY),
  // ISO 3166-1 alpha-2 country code, e.g. "IN"
  country: z.string().regex(/^([A-Z]{2}|\*)$/).default(ANY),
});

export type MatchPrefs = z.infer<typeof matchPrefsSchema>;

/** How wide the current search is. Sent to the client so it can explain the wait. */
export type SearchScope = "exact" | "language" | "anyone";

export interface SearchStage {
  scope: SearchScope;
  /** Queues to search and wait in, most specific first. */
  queues: string[];
}

const queueKey = (mode: string, language: string, country: string) =>
  `q:${mode}:${language}:${country}`;

/**
 * The stages a search widens through:
 *   exact    - same language and same country
 *   language - same language, any country
 *   anyone   - anyone using the same mode (video or text)
 *
 * A user only sits in a queue once they accept everyone in it, and a searcher
 * only pops from queues they accept, so every match respects both people's
 * current preferences. Stages that add no new queue are skipped,
 * e.g. a user with no preferences starts at "anyone".
 */
export function searchStages(prefs: MatchPrefs): SearchStage[] {
  const levels: { scope: SearchScope; queue: string }[] = [
    { scope: "exact", queue: queueKey(prefs.mode, prefs.language, prefs.country) },
    { scope: "language", queue: queueKey(prefs.mode, prefs.language, ANY) },
    { scope: "anyone", queue: queueKey(prefs.mode, ANY, ANY) },
  ];

  const stages: SearchStage[] = [];
  const queues: string[] = [];
  for (const { scope, queue } of levels) {
    if (queues.includes(queue)) {
      // Same queue as the previous level: this level is already covered.
      if (stages.length) stages[stages.length - 1].scope = scope;
      continue;
    }
    queues.push(queue);
    stages.push({ scope, queues: [...queues] });
  }
  return stages;
}

export function parsePrefs(raw: unknown): MatchPrefs {
  const parsed = matchPrefsSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : matchPrefsSchema.parse({});
}
