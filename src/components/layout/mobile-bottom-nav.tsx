"use client";

import Link from "next/link";
import { BookOpen, Home, Layers2, Moon, Sun, User } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { Select } from "@/components/ui/select";

export function MobileBottomNav() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const themeAriaLabel = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

  useEffect(() => {
    // Load theme from localStorage or system preference
    const stored = window.localStorage.getItem("app.theme");
    const initialTheme = stored === "light" || stored === "dark" 
      ? stored 
      : (window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light");
    setTheme(initialTheme);
    document.documentElement.dataset.theme = initialTheme;
  }, []);

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
            Home
          </Link>
          <Link href="/search" className="flex flex-col items-center gap-1 rounded-2xl py-2 text-xs text-text-muted">
            <BookOpen className="h-4 w-4" />
            Resources
          </Link>
          <div className="flex flex-col items-center gap-1 rounded-2xl py-2 text-xs text-text-soft">
            <Layers2 className="h-4 w-4" />
            Study Room
          </div>
          <Link
            href={isLoggedIn ? "/profile" : "/login"}
            className="flex flex-col items-center gap-1 rounded-2xl py-2 text-xs text-text-muted"
          >
            <User className="h-4 w-4" />
            {isLoggedIn ? "Profile" : "Login"}
          </Link>
        </div>
        <div className="flex items-center justify-center gap-2">
          <Button variant="ghost" size="sm" onClick={toggleTheme} aria-label={themeAriaLabel}>
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </nav>
  );
}
