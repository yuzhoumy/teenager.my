"use client";

import Image from "next/image";
import Link from "next/link";
import { Crown, LoaderCircle, Medal, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

type LeaderboardPeriod = "weekly" | "monthly" | "all-time";

type LeaderboardEntry = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  totalContributions: number;
  uploads: number;
  forks: number;
};

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type MaterialContributionRow = Pick<Database["public"]["Tables"]["materials"]["Row"], "id" | "uploaded_by" | "created_at">;
type ForkContributionRow = Pick<Database["public"]["Tables"]["user_forks"]["Row"], "id" | "user_id" | "created_at">;

const periodOptions: Array<{ id: LeaderboardPeriod; label: string }> = [
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "all-time", label: "All time" },
];

function getPeriodStart(period: LeaderboardPeriod) {
  if (period === "all-time") {
    return null;
  }

  const now = new Date();
  const start = new Date(now);
  const daysBack = period === "weekly" ? 7 : 30;
  start.setDate(start.getDate() - (daysBack - 1));
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

function getMedalColor(rank: number) {
  if (rank === 1) return "text-amber-300";
  if (rank === 2) return "text-slate-300";
  if (rank === 3) return "text-orange-300";
  return "text-text-muted";
}

export function LeaderboardPageClient() {
  const [period, setPeriod] = useState<LeaderboardPeriod>("weekly");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadLeaderboard() {
      setLoading(true);
      setError("");

      if (!isSupabaseConfigured) {
        if (!cancelled) {
          setError("Supabase is not configured. Add env vars and restart the dev server.");
          setLoading(false);
        }
        return;
      }

      const periodStart = getPeriodStart(period);
      let materialsQuery = supabase
        .from("materials")
        .select("id, uploaded_by, created_at")
        .not("uploaded_by", "is", null);
      let forksQuery = supabase
        .from("user_forks")
        .select("id, user_id, created_at");

      if (periodStart) {
        materialsQuery = materialsQuery.gte("created_at", periodStart);
        forksQuery = forksQuery.gte("created_at", periodStart);
      }

      const [
        { data: materialsData, error: materialsError },
        { data: forksData, error: forksError },
      ] = await Promise.all([materialsQuery, forksQuery]);

      if (materialsError || forksError) {
        if (!cancelled) {
          setError(materialsError?.message ?? forksError?.message ?? "Unable to load leaderboard.");
          setLoading(false);
        }
        return;
      }

      const contributionMap = new Map<string, { uploads: number; forks: number }>();
      const typedMaterials = (materialsData ?? []) as MaterialContributionRow[];
      const typedForks = (forksData ?? []) as ForkContributionRow[];

      for (const material of typedMaterials) {
        const userId = material.uploaded_by;
        if (!userId) continue;
        const current = contributionMap.get(userId) ?? { uploads: 0, forks: 0 };
        contributionMap.set(userId, {
          uploads: current.uploads + 1,
          forks: current.forks,
        });
      }

      for (const fork of typedForks) {
        const userId = fork.user_id;
        if (!userId) continue;
        const current = contributionMap.get(userId) ?? { uploads: 0, forks: 0 };
        contributionMap.set(userId, {
          uploads: current.uploads,
          forks: current.forks + 1,
        });
      }

      const userIds = Array.from(contributionMap.keys());
      if (userIds.length === 0) {
        if (!cancelled) {
          setEntries([]);
          setLoading(false);
        }
        return;
      }

      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", userIds);

      if (profilesError) {
        if (!cancelled) {
          setError(profilesError.message);
          setLoading(false);
        }
        return;
      }

      const profileMap = new Map(
        ((profilesData ?? []) as Array<Pick<ProfileRow, "user_id" | "display_name" | "avatar_url">>)
          .map((profile) => [profile.user_id, profile]),
      );

      const nextEntries = userIds
        .map((userId) => {
          const totals = contributionMap.get(userId) ?? { uploads: 0, forks: 0 };
          const profile = profileMap.get(userId);
          return {
            userId,
            displayName: profile?.display_name?.trim() || "Anonymous user",
            avatarUrl: profile?.avatar_url ?? null,
            uploads: totals.uploads,
            forks: totals.forks,
            totalContributions: totals.uploads + totals.forks,
          };
        })
        .sort((left, right) => {
          if (right.totalContributions !== left.totalContributions) {
            return right.totalContributions - left.totalContributions;
          }
          if (right.uploads !== left.uploads) {
            return right.uploads - left.uploads;
          }
          return left.displayName.localeCompare(right.displayName);
        });

      if (!cancelled) {
        setEntries(nextEntries);
        setLoading(false);
      }
    }

    void loadLeaderboard();
    return () => {
      cancelled = true;
    };
  }, [period]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Contribution Leaderboard</h1>
          <p className="mt-1 text-sm text-text-muted">
            Ranked by uploads and forks contributions.
          </p>
        </div>
        <div className="inline-flex rounded-xl border border-border bg-surface p-1">
          {periodOptions.map((option) => (
            <Button
              key={option.id}
              type="button"
              variant={period === option.id ? "default" : "ghost"}
              size="sm"
              onClick={() => setPeriod(option.id)}
              className={cn("rounded-lg mx-1", period === option.id ? "" : "text-text-muted")}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <Card className="flex items-center justify-center gap-2 rounded-[28px] p-8 text-text-muted">
          <LoaderCircle className="h-5 w-5 animate-spin" />
          Loading leaderboard...
        </Card>
      ) : error ? (
        <Card className="rounded-[28px] border border-rose-400/30 bg-rose-400/10 p-6 text-rose-200">
          {error}
        </Card>
      ) : entries.length === 0 ? (
        <Card className="rounded-[28px] p-6 text-text-muted">
          No contributions yet for this period.
        </Card>
      ) : (
        <>
          <Card className="rounded-[32px] border-border-strong bg-surface-strong p-6">
            <div className="mb-6 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-300" />
              <h2 className="text-xl text-foreground">Top 3</h2>
            </div>

            <div className="grid grid-cols-3 items-end gap-2 sm:gap-3">
              {[entries[1], entries[0], entries[2]].map((entry, index) => {
                if (!entry) return <div key={`podium-empty-${index}`} />;
                const rank = index === 0 ? 2 : index === 1 ? 1 : 3;
                const podiumHeight = rank === 1 ? "h-44" : rank === 2 ? "h-36" : "h-32";

                return (
                  <div key={entry.userId} className={cn("flex w-full flex-col items-center gap-2 sm:gap-3", rank === 1 ? "sm:-mt-4" : "")}>
                    <div className="relative">
                      {entry.avatarUrl ? (
                        <Image
                          src={entry.avatarUrl}
                          alt={entry.displayName}
                          width={56}
                          height={56}
                          className="h-14 w-14 rounded-full border border-border object-cover sm:h-[72px] sm:w-[72px]"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-background text-base font-semibold text-foreground/80 sm:h-[72px] sm:w-[72px] sm:text-xl">
                          {entry.displayName.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      {rank === 1 ? (
                        <span className="absolute -right-2 -top-2 rounded-full bg-amber-300 p-1 text-background">
                          <Crown className="h-3.5 w-3.5" />
                        </span>
                      ) : null}
                    </div>

                    <p className="max-w-[5rem] truncate text-center text-xs font-semibold text-foreground sm:max-w-[12rem] sm:text-sm">{entry.displayName}</p>

                    <div className={cn("flex w-full max-w-[6.25rem] flex-col items-center justify-end rounded-t-2xl border border-border bg-background sm:max-w-[14rem]", podiumHeight)}>
                      <span className={cn("mb-1 text-xs font-semibold uppercase tracking-wide", getMedalColor(rank))}>
                        #{rank}
                      </span>
                      <Medal className={cn("mb-2 h-5 w-5", getMedalColor(rank))} />
                      <p className="text-2xl font-bold text-foreground">{entry.totalContributions}</p>
                      <p className="mb-4 text-xs text-text-muted">contributions</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="rounded-[28px] p-0">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-lg font-semibold text-foreground">All Rankings</h2>
            </div>
            <ol className="divide-y divide-border">
              {entries.map((entry, index) => (
                <li key={entry.userId} className="flex items-center justify-between gap-3 px-5 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={cn("w-8 text-sm font-semibold", getMedalColor(index + 1))}>#{index + 1}</span>
                    {entry.avatarUrl ? (
                      <Image
                        src={entry.avatarUrl}
                        alt={entry.displayName}
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-full border border-border object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-sm font-semibold text-foreground/80">
                        {entry.displayName.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <Link
                        href={`/users?userId=${encodeURIComponent(entry.userId)}`}
                        className="truncate font-medium text-foreground hover:text-brand"
                      >
                        {entry.displayName}
                      </Link>
                      <p className="text-xs text-text-muted">
                        Uploads: {entry.uploads} · Forks: {entry.forks}
                      </p>
                    </div>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-foreground">
                    {entry.totalContributions}
                  </p>
                </li>
              ))}
            </ol>
          </Card>
        </>
      )}
    </section>
  );
}
