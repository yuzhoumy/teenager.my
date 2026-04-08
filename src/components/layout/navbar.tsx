"use client";

import Link from "next/link";
import { BookOpen, Moon, Sun, UserCircle2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { usePreferences } from "@/components/preferences/preferences-provider";
import type { Language } from "@/lib/i18n/messages";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const futureModuleKeys = [
  "nav.studyRoom",
  "nav.studyBuddy",
  "nav.flashcards",
  "nav.quiz",
  "nav.rewardsStreaks",
] as const;

const languageOrder: Language[] = ["en", "ms", "zh-Hans"];

export function Navbar() {
  const { t, theme, toggleTheme, language, setLanguage, languageShortLabel } = usePreferences();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const cycleLanguage = useCallback(() => {
    const idx = languageOrder.indexOf(language);
    const next = languageOrder[(idx + 1) % languageOrder.length];
    setLanguage(next);
  }, [language, setLanguage]);

  const themeAriaLabel = theme === "dark" ? t("theme.light") : t("theme.dark");

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    void supabase.auth.getUser().then(({ data }) => {
      setIsLoggedIn(Boolean(data.user));
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(Boolean(session?.user));
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold text-foreground">
          <BookOpen className="h-5 w-5 text-sky-600" />
          teenager.my
        </Link>

        <nav className="hidden items-center gap-4 md:flex">
          <Link href="/" className="text-sm text-foreground/80 hover:text-foreground">
            {t("nav.home")}
          </Link>
          <Link href="/resources" className="text-sm text-foreground/80 hover:text-foreground">
            {t("nav.resources")}
          </Link>

          {futureModuleKeys.map((featureKey) => (
            <span key={featureKey} className="text-sm text-foreground/60">
              {t(featureKey)}
            </span>
          ))}

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleTheme}
              aria-label={themeAriaLabel}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={cycleLanguage} aria-label={t("nav.language")}>
              {languageShortLabel}
            </Button>
          </div>

          {/* TODO: Replace with dynamic session avatar/profile menu */}
          <Button asChild variant="outline" size="sm">
            <Link href={isLoggedIn ? "/profile" : "/login"}>
              <UserCircle2 className="mr-1 h-4 w-4" />
              {isLoggedIn ? t("nav.profile") : t("nav.login")}
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
