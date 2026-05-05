"use client";

import Link from "next/link";
import { BookOpen, Moon, Sun, UserCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getSupabaseUser, isSupabaseConfigured, supabase } from "@/lib/supabase";

const futureModules = [
  "Study Room",
  "Study Buddy", 
  "Flashcards",
  "Quiz",
  "Rewards/Streaks",
] as const;

export function Navbar() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") {
      return "light";
    }

    const stored = window.localStorage.getItem("app.theme");
    return stored === "light" || stored === "dark"
      ? stored
      : (window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light");
  });

  const themeAriaLabel = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      window.localStorage.setItem("app.theme", next);
      document.documentElement.dataset.theme = next;
      return next;
    });
  };

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    void getSupabaseUser().then((user) => {
      setIsLoggedIn(Boolean(user));
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
            Home
          </Link>
          <Link href="/search" className="text-sm text-text-muted hover:text-foreground">
            Resources
          </Link>

          {futureModules.map((module) => (
            <span key={module} className="text-sm text-text-soft">
              {module}
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
          </div>

          <Button asChild variant="secondary" size="sm">
            <Link href={isLoggedIn ? "/profile" : "/login"}>
              <UserCircle2 className="h-4 w-4" />
              {isLoggedIn ? "Profile" : "Login"}
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
