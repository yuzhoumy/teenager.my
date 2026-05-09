"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type PulseState =
  | { status: "loading" }
  | { status: "ready"; materialCount: number; forkCount: number }
  | { status: "error"; message: string };

function formatCompact(value: number) {
  return value.toLocaleString(undefined, { notation: "compact", maximumFractionDigits: 1 });
}

export function LivePulse() {
  const [state, setState] = useState<PulseState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!isSupabaseConfigured) {
        setState({ status: "error", message: "Supabase is not configured." });
        return;
      }

      try {
        const [{ count: materials, error: materialsError }, { count: forks, error: forksError }] = await Promise.all([
          supabase.from("materials").select("*", { count: "exact", head: true }),
          supabase.from("user_forks").select("*", { count: "exact", head: true }),
        ]);

        if (materialsError) throw materialsError;
        if (forksError) throw forksError;

        if (!cancelled) {
          setState({
            status: "ready",
            materialCount: materials ?? 0,
            forkCount: forks ?? 0,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "Unable to load live stats.",
          });
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card className="rounded-[36px] border-border bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-background/40 px-3 py-2 text-text-muted">
            <Activity className="h-4 w-4 text-brand" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em]">Live pulse</span>
          </div>
          <h2 className="text-3xl text-foreground sm:text-4xl">A shared library that keeps moving.</h2>
          <p className="mt-3 max-w-2xl text-sm text-text-muted sm:text-base">
            Every upload can be forked, annotated, and improved—so students build on each other instead of starting from scratch.
          </p>
        </div>
        {state.status === "ready" ? (
          <Badge className="bg-[color:rgba(201,100,66,0.12)] text-brand">Updated just now</Badge>
        ) : null}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-[28px] border border-border bg-background/50 p-6">
          <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Resources uploaded</p>
          <p className="mt-3 text-4xl font-semibold text-foreground sm:text-5xl">
            {state.status === "ready" ? formatCompact(state.materialCount) : state.status === "loading" ? "…" : "—"}
          </p>
          <p className="mt-2 text-sm text-text-muted">Notes, trial papers, past-year papers, and more.</p>
        </div>
        <div className="rounded-[28px] border border-border bg-background/50 p-6">
          <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Forks created</p>
          <p className="mt-3 text-4xl font-semibold text-foreground sm:text-5xl">
            {state.status === "ready" ? formatCompact(state.forkCount) : state.status === "loading" ? "…" : "—"}
          </p>
          <p className="mt-2 text-sm text-text-muted">Community improvements, annotations, and remixes.</p>
        </div>
      </div>

      {state.status === "error" ? (
        <p className="mt-5 text-sm text-rose-600">{state.message}</p>
      ) : null}
    </Card>
  );
}

