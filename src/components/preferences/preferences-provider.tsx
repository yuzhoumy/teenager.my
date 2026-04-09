"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  interpolate,
  languageOptions,
  messages,
  type Language,
  type TranslationKey,
} from "@/lib/i18n/messages";

type Theme = "light" | "dark";

type PreferencesContextValue = {
  language: Language;
  setLanguage: (next: Language) => void;
  theme: Theme;
  toggleTheme: () => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function readStoredTheme(): Theme {
  const stored = window.localStorage.getItem("app.theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
}

function readStoredLanguage(): Language {
  const stored = window.localStorage.getItem("app.language");
  if (stored === "en" || stored === "ms" || stored === "zh-Hans") return stored;
  return "en";
}

export function usePreferences() {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error("usePreferences must be used within PreferencesProvider");
  return value;
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  // IMPORTANT: Keep initial render deterministic between server + client to avoid hydration mismatch.
  // We'll load saved preferences in a useEffect after mount.
  const [language, setLanguageState] = useState<Language>("en");
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const storedLanguage = readStoredLanguage();
    const storedTheme = readStoredTheme();
    setLanguageState(storedLanguage);
    setThemeState(storedTheme);
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    const opt = languageOptions.find((l) => l.code === language);
    html.lang = opt?.htmlLang ?? "en";
    html.dataset.theme = theme;
  }, [language, theme]);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    window.localStorage.setItem("app.language", next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      window.localStorage.setItem("app.theme", next);
      return next;
    });
  }, []);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => {
      return interpolate(messages[language][key], vars);
    },
    [language],
  );



  const value = useMemo<PreferencesContextValue>(
    () => ({
      language,
      setLanguage,
      theme,
      toggleTheme,
      t,
    }),
    [language, setLanguage, theme, toggleTheme, t],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

