"use client";

import Link from "next/link";
import { Bell, Moon, Sun, Upload, UserCircle2 } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { getSupabaseUser, isSupabaseConfigured, supabase } from "@/lib/supabase";

const futureModules = [] as const;

export function Navbar() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [themeVersion, setThemeVersion] = useState(0);
  const hasMounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  const theme =
    hasMounted &&
    (window.localStorage.getItem("app.theme") === "light" || window.localStorage.getItem("app.theme") === "dark")
      ? (window.localStorage.getItem("app.theme") as "light" | "dark")
      : hasMounted && window.matchMedia?.("(prefers-color-scheme: dark)")?.matches
        ? "dark"
        : "light";
  const themeAriaLabel = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme, hasMounted, themeVersion]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    window.localStorage.setItem("app.theme", next);
    document.documentElement.dataset.theme = next;
    setThemeVersion((current) => current + 1);
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

  useEffect(() => {
    if (!isSupabaseConfigured || !isLoggedIn) {
      return;
    }

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function setup() {
      const user = await getSupabaseUser();
      if (!user || cancelled) {
        return;
      }

      async function refreshUnread() {
        const { count, error } = await supabase
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .is("read_at", null);

        if (!cancelled) {
          setUnreadNotifications(error ? 0 : count ?? 0);
        }
      }

      await refreshUnread();

      channel = supabase
        .channel(`navbar-notifications:${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${user.id}` },
          () => void refreshUnread(),
        )
        .subscribe();
    }

    void setup();

    return () => {
      cancelled = true;
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [isLoggedIn]);

  const unreadBadgeCount = isLoggedIn ? unreadNotifications : 0;

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3 text-foreground">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border-strong bg-surface shadow-[0_4px_18px_var(--shadow)]">
            <img src="/favicon.png" alt="icon" className="h-5 w-5" />
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
          <Link href="/forum" className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-foreground">
            Forum
          </Link>
          <Link
            href="/notifications"
            className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-foreground"
          >
            Notifications
          </Link>
          <Link href={isLoggedIn ? "/resources/upload" : "/login"} className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:text-brand-soft">
            <Upload className="h-4 w-4" />
            Upload resource
          </Link>

          {futureModules.map((module) => (
            <span key={module} className="text-sm text-text-soft">
              {module}
            </span>
          ))}

          <Button
            variant="ghost"
            size="sm"
            className="ml-2 rounded-full border border-border bg-surface shadow-[0_0_0_1px_var(--border)]"
            onClick={toggleTheme}
            aria-label={themeAriaLabel}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          <Button asChild variant="secondary" size="sm">
            <Link href={isLoggedIn ? "/profile" : "/login"}>
              <UserCircle2 className="h-4 w-4" />
              {isLoggedIn ? "Profile" : "Login"}
            </Link>
          </Button>
        </nav>

        <div className="flex items-center gap-2 lg:hidden">
          {isLoggedIn ? (
            <Button variant="ghost" size="sm" className="relative rounded-full border border-border bg-surface shadow-[0_0_0_1px_var(--border)]" asChild>
              <Link href="/notifications" aria-label="Notifications">
                <Bell className="h-4 w-4" strokeWidth={2} />
                {unreadBadgeCount > 0 ? (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-brand ring-2 ring-[var(--background)]" />
                ) : null}
              </Link>
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full border border-border bg-surface shadow-[0_0_0_1px_var(--border)]"
            onClick={toggleTheme}
            aria-label={themeAriaLabel}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </header>
  );
}
