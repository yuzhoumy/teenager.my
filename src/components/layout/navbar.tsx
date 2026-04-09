"use client";

import Link from "next/link";
import { BookOpen, Moon, Sun, UserCircle2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
            <Select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              aria-label={t("nav.language")}
              className="h-9 w-auto border-foreground/20 py-1 cursor-pointer font-semibold"
            >
              {languageOptions.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.short}
                </option>
              ))}
            </Select>
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
