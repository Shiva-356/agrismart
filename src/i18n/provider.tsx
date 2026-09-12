import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { en, type Dictionary } from "./locales/en";
import { hi } from "./locales/hi";
import { te } from "./locales/te";

export type Language = "en" | "te" | "hi";

export const DEFAULT_LANGUAGE: Language = "en";

export const LANGUAGES: { code: Language; label: string; short: string }[] = [
  { code: "en", label: "English", short: "EN" },
  { code: "te", label: "తెలుగు", short: "TE" },
  { code: "hi", label: "हिन्दी", short: "HI" },
];

const DICTIONARIES: Record<Language, Dictionary> = { en, te, hi };

const STORAGE_KEY = "agrismart:language";

type I18nValue = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Dictionary;
};

const I18nContext = createContext<I18nValue | null>(null);

function isLanguage(value: unknown): value is Language {
  return value === "en" || value === "te" || value === "hi";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  // Always start from the default so SSR and hydration match; the stored
  // preference is applied after mount.
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (isLanguage(stored)) setLanguageState(stored);
    } catch {
      /* storage unavailable — keep the default */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<I18nValue>(
    () => ({ language, setLanguage, t: DICTIONARIES[language] }),
    [language, setLanguage],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Safe fallback so components can render outside the provider (tests, isolated stories).
    return { language: DEFAULT_LANGUAGE, setLanguage: () => {}, t: en };
  }
  return ctx;
}

export function useT(): Dictionary {
  return useI18n().t;
}
