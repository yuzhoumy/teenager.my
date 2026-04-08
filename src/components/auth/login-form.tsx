"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { usePreferences } from "@/components/preferences/preferences-provider";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const { t } = usePreferences();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("");
    setLoading(true);

    if (!isSupabaseConfigured) {
      setError(t("auth.configError"));
      setLoading(false);
      return;
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    setStatus(t("auth.statusLoginSuccess"));
    setLoading(false);
    router.replace("/profile");
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <h1 className="mb-1 text-2xl font-bold">{t("auth.welcomeBack")}</h1>
      <p className="mb-5 text-sm text-foreground/70">{t("auth.loginSubtitle")}</p>
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          type="email"
          placeholder={t("auth.emailPlaceholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          type="password"
          placeholder={t("auth.passwordPlaceholder")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {status ? <p className="text-sm text-emerald-600">{status}</p> : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? t("auth.signingIn") : t("auth.loginButton")}
        </Button>
      </form>
      <p className="mt-4 text-sm text-foreground/70">
        {t("auth.noAccountYet")}{" "}
        <Link href="/register" className="font-semibold text-sky-600 hover:text-sky-500">
          {t("auth.registerLink")}
        </Link>
      </p>
    </Card>
  );
}
