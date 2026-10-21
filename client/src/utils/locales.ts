import type { MatchPrefs, SearchScope } from "../types/signaling";

export const ANY = "*";

/** Languages offered in the lobby (ISO 639-1). */
export const LANGUAGE_CODES = [
  "en", "hi", "ml", "ta", "te", "kn", "bn", "mr", "gu", "pa", "ur",
  "ar", "es", "fr", "de", "pt", "it", "ru", "tr", "id", "ja", "ko", "zh",
];

/** Countries offered in the lobby (ISO 3166-1 alpha-2). */
export const COUNTRY_CODES = [
  "IN", "US", "GB", "CA", "AU", "AE", "SA", "QA", "KW", "OM", "PK", "BD", "LK", "NP",
  "SG", "MY", "ID", "PH", "JP", "KR", "CN", "DE", "FR", "ES", "IT", "NL", "IE",
  "BR", "MX", "AR", "NG", "ZA", "EG", "TR", "RU",
];

const languageNames = safeDisplayNames("language");
const regionNames = safeDisplayNames("region");

function safeDisplayNames(type: "language" | "region") {
  try {
    return new Intl.DisplayNames(["en"], { type });
  } catch {
    return null;
  }
}

export function languageName(code: string) {
  if (code === ANY) return "Any language";
  return languageNames?.of(code) ?? code;
}

export function countryName(code: string) {
  if (code === ANY) return "Any country";
  return regionNames?.of(code) ?? code;
}

export const sortedLanguages = () =>
  [...LANGUAGE_CODES].sort((a, b) => languageName(a).localeCompare(languageName(b)));

export const sortedCountries = () =>
  [...COUNTRY_CODES].sort((a, b) => countryName(a).localeCompare(countryName(b)));

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

const PREFS_KEY = "passerby:prefs";

export function loadPrefs(): MatchPrefs {
  const fallback: MatchPrefs = { mode: "video", language: ANY, country: ANY };
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null");
    if (!saved || typeof saved !== "object") return fallback;
    return {
      mode: saved.mode === "text" ? "text" : "video",
      language: LANGUAGE_CODES.includes(saved.language) ? saved.language : ANY,
      country: COUNTRY_CODES.includes(saved.country) ? saved.country : ANY,
    };
  } catch {
    return fallback;
  }
}

export function savePrefs(prefs: MatchPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // storage unavailable (private mode); preferences just won't be remembered
  }
}
