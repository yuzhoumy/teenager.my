import type { ReactNode } from "react";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { Navbar } from "@/components/layout/navbar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 md:pb-8">{children}</main>
      <MobileBottomNav />
    </div>
  );
}
