import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { PreferencesProvider } from "@/components/preferences/preferences-provider";

export const metadata: Metadata = {
  title: "teenager.my",
  description: "A warm, focused study portal for Malaysian secondary school students.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="editorial-shell min-h-full">
        <PreferencesProvider>
          <AppShell>{children}</AppShell>
        </PreferencesProvider>
      </body>
    </html>
  );
}
