"use client";

import Link from "next/link";
import { BookOpen, Home, Layers2, Moon, Sun, User } from "lucide-react";
import { useEffect, useState } from "react";
import { usePreferences } from "@/components/preferences/preferences-provider";
import { Button } from "@/components/ui/button";
import { languageOptions, type Language } from "@/lib/i18n/messages";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { Select } from "@/components/ui/select";

export function MobileBottomNav() {
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
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-3 py-3 backdrop-blur xl:hidden">
      <div className="mx-auto flex max-w-md flex-col gap-3 rounded-[28px] border border-border bg-surface p-3 shadow-[0_12px_40px_var(--shadow)]">
        <div className="grid grid-cols-4 gap-2">
          <Link href="/" className="flex flex-col items-center gap-1 rounded-2xl py-2 text-xs text-text-muted">
            <Home className="h-4 w-4" />
            {t("nav.home")}
          </Link>
          <Link href="/resources" className="flex flex-col items-center gap-1 rounded-2xl py-2 text-xs text-text-muted">
            <BookOpen className="h-4 w-4" />
            {t("nav.resources")}
          </Link>
          <div className="flex flex-col items-center gap-1 rounded-2xl py-2 text-xs text-text-soft">
            <Layers2 className="h-4 w-4" />
            {t("nav.studyRoom")}
          </div>
          <Link
            href={isLoggedIn ? "/profile" : "/login"}
            className="flex flex-col items-center gap-1 rounded-2xl py-2 text-xs text-text-muted"
          >
            <User className="h-4 w-4" />
            {isLoggedIn ? t("nav.profile") : t("nav.login")}
          </Link>
        </div>
        <div className="flex items-center justify-center gap-2">
          <Button variant="ghost" size="sm" onClick={toggleTheme} aria-label={themeAriaLabel}>
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            aria-label={t("nav.language")}
            className="h-9 w-auto min-w-24 cursor-pointer py-1 font-medium"
          >
            {languageOptions.map((opt) => (
              <option key={opt.code} value={opt.code}>
                {opt.short}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </nav>
  );
}
