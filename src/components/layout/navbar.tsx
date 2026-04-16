"use client";

import Link from "next/link";
import { BookOpen, Moon, Sun, UserCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { usePreferences } from "@/components/preferences/preferences-provider";
import { languageOptions, type Language } from "@/lib/i18n/messages";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { Select } from "@/components/ui/select";

const futureModuleKeys = [
  "nav.studyRoom",
  "nav.studyBuddy",
  "nav.flashcards",
  "nav.quiz",
  "nav.rewardsStreaks",
] as const;

export function Navbar() {
  const { t, theme, toggleTheme, language, setLanguage } = usePreferences();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

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
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3 text-foreground">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border-strong bg-surface shadow-[0_4px_18px_var(--shadow)]">
            <BookOpen className="h-5 w-5 text-brand" />
          </span>
          <span className="flex flex-col">
            <span className="font-serif text-xl leading-none">teenager.my</span>
            <span className="text-[0.7rem] uppercase tracking-[0.18em] text-text-soft">
              Malaysian study commons
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-5 lg:flex">
          <Link href="/" className="text-sm text-text-muted hover:text-foreground">
            {t("nav.home")}
          </Link>
          <Link href="/resources" className="text-sm text-text-muted hover:text-foreground">
            {t("nav.resources")}
          </Link>

          {futureModuleKeys.map((featureKey) => (
            <span key={featureKey} className="text-sm text-text-soft">
              {t(featureKey)}
            </span>
          ))}

          <div className="ml-2 flex items-center gap-2 rounded-full border border-border bg-surface px-2 py-1 shadow-[0_0_0_1px_var(--border)]">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              aria-label={themeAriaLabel}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              aria-label={t("nav.language")}
              className="h-9 w-auto min-w-20 cursor-pointer border-0 bg-transparent py-1 font-medium shadow-none"
            >
              {languageOptions.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.short}
                </option>
              ))}
            </Select>
          </div>

          <Button asChild variant="secondary" size="sm">
            <Link href={isLoggedIn ? "/profile" : "/login"}>
              <UserCircle2 className="h-4 w-4" />
              {isLoggedIn ? t("nav.profile") : t("nav.login")}
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
