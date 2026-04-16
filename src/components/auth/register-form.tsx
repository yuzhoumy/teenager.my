"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { getMoeEmailError } from "@/lib/validators";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { usePreferences } from "@/components/preferences/preferences-provider";

export function RegisterForm() {
  const [displayName, setDisplayName] = useState("");
  const [school, setSchool] = useState("");
  const [formLevel, setFormLevel] = useState("1");
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

    const emailError = getMoeEmailError(email);
    if (emailError) {
      setError(emailError);
      return;
    }

    setLoading(true);
    if (!isSupabaseConfigured) {
      setError(t("auth.configError"));
      setLoading(false);
      return;
    }

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          school,
          form: Number(formLevel),
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    setStatus(t("auth.statusRegisterSuccess"));
    setLoading(false);
  }

  return (
    <Card className="mx-auto w-full max-w-md rounded-[32px]">
      <p className="mb-3 text-sm uppercase tracking-[0.18em] text-text-soft">Account</p>
      <h1 className="mb-1 text-4xl text-foreground">{t("auth.createAccount")}</h1>
      <p className="mb-6 text-sm text-text-muted">{t("auth.registerSubtitle")}</p>
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          placeholder={t("auth.displayNamePlaceholder")}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
        />
        <Input placeholder={t("auth.schoolPlaceholder")} value={school} onChange={(e) => setSchool(e.target.value)} required />
        <Select value={formLevel} onChange={(e) => setFormLevel(e.target.value)} required>
          {[1, 2, 3, 4, 5].map((value) => (
            <option key={value} value={value}>
              {t("auth.formPrefix", { form: value })}
            </option>
          ))}
        </Select>
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
        {error ? <p className="text-sm text-[#b53333]">{error}</p> : null}
        {status ? <p className="text-sm text-brand">{status}</p> : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? t("auth.creatingAccount") : t("auth.registerButton")}
        </Button>
      </form>
      <p className="mt-5 text-sm text-text-muted">
        {t("auth.alreadyHaveAccount")}{" "}
        <Link href="/login" className="font-semibold text-brand hover:text-brand-soft">
          {t("auth.loginLink")}
        </Link>
      </p>
    </Card>
  );
}
