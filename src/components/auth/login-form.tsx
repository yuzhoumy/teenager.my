"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registrationConfirmed = searchParams.get("registered") === "success";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState(registrationConfirmed ? "Registration successful. You can now log in." : "");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("");
    setLoading(true);

    if (!isSupabaseConfigured) {
      setError("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart dev server.");
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

    setStatus("Login successful. Redirect logic will be added in Phase 2.");
    setLoading(false);
    router.replace("/profile");
  }

  return (
    <Card className="mx-auto w-full max-w-md rounded-[32px]">
      <p className="mb-3 text-sm uppercase tracking-[0.18em] text-text-soft">Account</p>
      <h1 className="mb-1 text-4xl text-foreground">Welcome back</h1>
      <p className="mb-6 text-sm text-text-muted">Login with your account to continue.</p>
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          type="email"
          placeholder="you@moe-dl.edu.my"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error ? <p className="text-sm text-[#b53333]">{error}</p> : null}
        {status ? <p className="text-sm text-brand">{status}</p> : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Signing in..." : "Login"}
        </Button>
      </form>
      <p className="mt-5 text-sm text-text-muted">
        No account yet?{" "}
        <Link href="/register" className="font-semibold text-brand hover:text-brand-soft">
          Register
        </Link>
      </p>
    </Card>
  );
}
