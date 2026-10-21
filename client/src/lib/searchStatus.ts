import type { MatchPrefs, SearchScope } from "../types/signaling";
import { ANY, countryName, languageName } from "./locales";

/** Explains who the server is currently looking for. */
export function describeSearch(prefs: MatchPrefs, scope: SearchScope | null) {
  const lang = prefs.language !== ANY ? languageName(prefs.language) : null;
  const country = prefs.country !== ANY ? countryName(prefs.country) : null;

  if (scope === "exact" && lang && country) return `Looking for ${lang} speakers in ${country}…`;
  if (scope === "exact" && country) return `Looking for someone in ${country}…`;
  if ((scope === "exact" || scope === "language") && lang) {
    return country
      ? `Nobody in ${country} yet. Looking for ${lang} speakers anywhere…`
      : `Looking for ${lang} speakers…`;
  }
  if (scope === "anyone" && (lang || country)) return "No exact match yet. Looking for anyone…";
  return "Looking for someone…";
}
