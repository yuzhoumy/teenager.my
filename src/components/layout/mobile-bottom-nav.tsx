"use client";

import Link from "next/link";
import { BookOpen, Home, Upload, User } from "lucide-react";
import { useEffect, useState } from "react";
import { getSupabaseUser, isSupabaseConfigured, supabase } from "@/lib/supabase";

export function MobileBottomNav() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

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
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur xl:hidden">
      <div className="mx-auto max-w-md rounded-[22px] border border-border bg-surface px-2 py-2 shadow-[0_12px_40px_var(--shadow)]">
        <div className="grid grid-cols-4 gap-2">
          <Link href="/" className="flex flex-col items-center gap-1 rounded-2xl py-2 text-xs text-text-muted">
            <Home className="h-4 w-4" />
            Home
          </Link>
          <Link href="/search" className="flex flex-col items-center gap-1 rounded-2xl py-2 text-xs text-text-muted">
            <BookOpen className="h-4 w-4" />
            Resources
          </Link>
          <Link href={isLoggedIn ? "/resources/upload" : "/login"} className="flex flex-col items-center gap-1 rounded-2xl py-2 text-xs text-text-muted">
            <Upload className="h-4 w-4" />
            Upload
          </Link>
          <Link
            href={isLoggedIn ? "/profile" : "/login"}
            className="flex flex-col items-center gap-1 rounded-2xl py-2 text-xs text-text-muted"
          >
            <User className="h-4 w-4" />
            {isLoggedIn ? "Profile" : "Login"}
          </Link>
        </div>
      </div>
    </nav>
  );
}
