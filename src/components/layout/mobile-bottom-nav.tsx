"use client";

import Link from "next/link";
import { BookOpen, Home, Layers2, Moon, Sun, User } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { usePreferences } from "@/components/preferences/preferences-provider";
import { Button } from "@/components/ui/button";
import type { Language } from "@/lib/i18n/messages";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const languageOrder: Language[] = ["en", "ms", "zh-Hans"];

export function MobileBottomNav() {
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
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background p-2 md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-4 gap-2">
        <Link href="/" className="flex flex-col items-center gap-1 rounded-lg py-2 text-xs text-foreground/80">
          <Home className="h-4 w-4" />
          {t("nav.home")}
        </Link>
        <Link href="/resources" className="flex flex-col items-center gap-1 rounded-lg py-2 text-xs text-foreground/80">
          <BookOpen className="h-4 w-4" />
          {t("nav.resources")}
        </Link>
        {/* TODO: Hook real Study Room module navigation when feature launches */}
        <div className="flex flex-col items-center gap-1 rounded-lg py-2 text-xs text-foreground/60">
          <Layers2 className="h-4 w-4" />
          {t("nav.studyRoom")}
        </div>
        <Link
          href={isLoggedIn ? "/profile" : "/login"}
          className="flex flex-col items-center gap-1 rounded-lg py-2 text-xs text-foreground/80"
        >
          <User className="h-4 w-4" />
          {isLoggedIn ? t("nav.profile") : t("nav.login")}
        </Link>
      </div>
      <div className="mx-auto mt-2 flex max-w-md justify-center gap-2">
        <Button variant="outline" size="sm" onClick={toggleTheme} aria-label={themeAriaLabel}>
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button variant="outline" size="sm" onClick={cycleLanguage} aria-label={t("nav.language")}>
          {languageShortLabel}
        </Button>
      </div>
    </nav>
  );
}
