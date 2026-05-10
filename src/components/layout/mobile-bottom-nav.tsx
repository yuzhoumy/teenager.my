"use client";

import Link from "next/link";
import { BookOpen, Home, MapPinned, MessageSquare, User } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabaseUser, isSupabaseConfigured, supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export function MobileBottomNav() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const pathname = usePathname();
  const currentPath = pathname.replace(/\/$/, "") || "/";

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

  const navItems = [
    { href: "/", label: "Home", icon: Home, active: currentPath === "/" },
    {
      href: "/resources",
      label: "Resources",
      icon: BookOpen,
      active: currentPath === "/search" || currentPath === "/resources" || (currentPath.startsWith("/resources") && currentPath !== "/resources/upload"),
    },
    {
      href: "/study-zone",
      label: "Study Zone",
      icon: MapPinned,
      active: currentPath === "/study-zone" || currentPath.startsWith("/study-zone/"),
    },
    {
      href: "/forum",
      label: "Forum",
      icon: MessageSquare,
      active: currentPath === "/forum",
    },
    {
      href: isLoggedIn ? "/profile" : "/login",
      label: isLoggedIn ? "Profile" : "Login",
      icon: User,
      active: isLoggedIn
        ? currentPath === "/profile"
        : currentPath === "/login" || currentPath === "/register",
    },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden">
      <div className="mx-auto max-w-md rounded-[22px] border border-border bg-surface px-2 py-2 shadow-[0_12px_40px_var(--shadow)]">
        <div className="grid grid-cols-5 gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.label}
                href={item.href}
                aria-current={item.active ? "page" : undefined}
                className={cn(
                  "flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-xs transition",
                  item.active
                    ? "border border-border-strong bg-foreground text-background shadow-[0_4px_18px_var(--shadow)]"
                    : "text-text-muted hover:bg-background hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="block w-full truncate whitespace-nowrap text-center text-[0.68rem] leading-none">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
