import { useMemo } from "react";
import type { MatchMode, MatchPrefs } from "../types/signaling";
import { ANY, countryName, languageName, sortedCountries, sortedLanguages } from "../utils/locales";

interface MatchPreferencesProps {
  prefs: MatchPrefs;
  onChange: (prefs: MatchPrefs) => void;
}

const MODES: { value: MatchMode; label: string }[] = [
  { value: "video", label: "Video + chat" },
  { value: "text", label: "Text only" },
];

export default function MatchPreferences({ prefs, onChange }: MatchPreferencesProps) {
  const languages = useMemo(sortedLanguages, []);
  const countries = useMemo(sortedCountries, []);

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-gray-700 mb-2">How do you want to talk?</legend>
        <div className="inline-flex rounded-md border p-1 gap-1 w-fit">
          {MODES.map((mode) => (
            <label
              key={mode.value}
              className={`cursor-pointer rounded px-3 py-1.5 text-sm font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand ${
                prefs.mode === mode.value ? "bg-brand text-white" : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <input
                type="radio"
                name="mode"
                value={mode.value}
                checked={prefs.mode === mode.value}
                onChange={() => onChange({ ...prefs, mode: mode.value })}
                className="sr-only"
              />
              {mode.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Language</span>
          <select
            id="pref-language"
            value={prefs.language}
            onChange={(e) => onChange({ ...prefs, language: e.target.value })}
            className="rounded-md border px-3 py-2 bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <option value={ANY}>{languageName(ANY)}</option>
            {languages.map((code) => (
              <option key={code} value={code}>{languageName(code)}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Country</span>
          <select
            id="pref-country"
            value={prefs.country}
            onChange={(e) => onChange({ ...prefs, country: e.target.value })}
            className="rounded-md border px-3 py-2 bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <option value={ANY}>{countryName(ANY)}</option>
            {countries.map((code) => (
              <option key={code} value={code}>{countryName(code)}</option>
            ))}
          </select>
        </label>
      </div>
      {(prefs.language !== ANY || prefs.country !== ANY) && (
        <p className="text-xs text-gray-500">
          If nobody matches within a few seconds, we'll widen the search, first to any country, then to anyone.
        </p>
      )}
    </div>
  );
}
