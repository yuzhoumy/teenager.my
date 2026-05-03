"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { getMoeEmailError } from "@/lib/validators";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { isValidSchool, schoolOptions } from "@/lib/schools";

export function RegisterForm() {
  const [displayName, setDisplayName] = useState("");
  const [school, setSchool] = useState("");
  const [formLevel, setFormLevel] = useState("1");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("");

    if (!isValidSchool(school)) {
      setError("Please select a school from the list.");
      return;
    }

    const emailError = getMoeEmailError(email);
    if (emailError) {
      setError(emailError);
      return;
    }

    setLoading(true);
    if (!isSupabaseConfigured) {
      setError("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart dev server.");
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

    setStatus("Registration successful. Check your email to confirm your account.");
    setLoading(false);
  }

  return (
    <Card className="mx-auto w-full max-w-md rounded-[32px]">
      <p className="mb-3 text-sm uppercase tracking-[0.18em] text-text-soft">Account</p>
      <h1 className="mb-1 text-4xl text-foreground">Create your account</h1>
      <p className="mb-6 text-sm text-text-muted">Only MOE school emails can register.</p>
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          placeholder="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
        />
        <Input
          list="school-options"
          placeholder="School"
          value={school}
          onChange={(e) => setSchool(e.target.value)}
          required
        />
        <datalist id="school-options">
          {schoolOptions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
        <Select value={formLevel} onChange={(e) => setFormLevel(e.target.value)} required>
          {[1, 2, 3, 4, 5].map((value) => (
            <option key={value} value={value}>
              Form {value}
            </option>
          ))}
        </Select>
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
          {loading ? "Creating account..." : "Register"}
        </Button>
      </form>
      <p className="mt-5 text-sm text-text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brand hover:text-brand-soft">
          Login
        </Link>
      </p>
    </Card>
  );
}
