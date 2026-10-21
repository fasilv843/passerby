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
