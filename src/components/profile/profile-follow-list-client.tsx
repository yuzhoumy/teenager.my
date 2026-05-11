"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, LoaderCircle, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getEducationLevelLabel } from "@/lib/education-levels";
import { getSupabaseUser, isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

type FollowListKind = "following" | "followers";
type ProfileRow = Pick<Database["public"]["Tables"]["profiles"]["Row"], "user_id" | "display_name" | "form" | "avatar_url">;
type FollowRow = Pick<Database["public"]["Tables"]["profile_follows"]["Row"], "follower_id" | "followed_id" | "created_at">;

function uniqueValues(values: string[]) {
  return Array.from(new Set(values));
}

export function ProfileFollowListClient({
  kind,
  source,
}: {
  kind: FollowListKind;
  source: "current-user" | "query-user";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryUserId = searchParams.get("userId");
  const [profileUserId, setProfileUserId] = useState<string | null>(source === "query-user" ? queryUserId : null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState("");
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const title = kind === "following" ? "Following" : "Followed by";
  const emptyText = kind === "following" ? "Not following anyone yet." : "No followers yet.";
  const backHref = source === "current-user" ? "/profile" : profileUserId ? `/users?userId=${profileUserId}` : "/users";
  const subtitle = useMemo(() => {
    if (!profileName) return "Student connections";
    return kind === "following" ? `People ${profileName} follows` : `People following ${profileName}`;
  }, [kind, profileName]);

  useEffect(() => {
    let cancelled = false;

    async function loadFollowList() {
      setLoading(true);
      setError("");

      if (!isSupabaseConfigured) {
        setError("Supabase is not configured.");
        setLoading(false);
        return;
      }

      const currentUser = await getSupabaseUser();
      if (cancelled) return;

      setCurrentUserId(currentUser?.id ?? null);

      const targetUserId = source === "current-user" ? currentUser?.id ?? null : queryUserId;
      setProfileUserId(targetUserId);

      if (!targetUserId) {
        if (source === "current-user") {
          router.replace("/login");
          return;
        }

        setError("Profile not found.");
        setLoading(false);
        return;
      }

      const { data: ownerProfileData, error: ownerError } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (cancelled) return;

      if (ownerError) {
        setError(ownerError.message);
        setLoading(false);
        return;
      }

      const ownerProfile = ownerProfileData as Pick<ProfileRow, "display_name"> | null;
      setProfileName(ownerProfile?.display_name ?? "this student");

      const followQuery =
        kind === "following"
          ? supabase
              .from("profile_follows")
              .select("follower_id, followed_id, created_at")
              .eq("follower_id", targetUserId)
              .order("created_at", { ascending: false })
          : supabase
              .from("profile_follows")
              .select("follower_id, followed_id, created_at")
              .eq("followed_id", targetUserId)
              .order("created_at", { ascending: false });

      const { data: followsData, error: followsError } = await followQuery;

      if (cancelled) return;

      if (followsError) {
        setError(followsError.message);
        setLoading(false);
        return;
      }

      const follows = (followsData ?? []) as FollowRow[];
      const connectedUserIds = uniqueValues(
        follows.map((follow) => (kind === "following" ? follow.followed_id : follow.follower_id)),
      );

      if (connectedUserIds.length === 0) {
        setUsers([]);
        setLoading(false);
        return;
      }

      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, display_name, form, avatar_url")
        .in("user_id", connectedUserIds);

      if (cancelled) return;

      if (profilesError) {
        setError(profilesError.message);
        setLoading(false);
        return;
      }

      const profileMap = new Map(((profilesData ?? []) as ProfileRow[]).map((profile) => [profile.user_id, profile]));
      setUsers(connectedUserIds.map((userId) => profileMap.get(userId)).filter((profile): profile is ProfileRow => Boolean(profile)));
      setLoading(false);
    }

    void loadFollowList();

    return () => {
      cancelled = true;
    };
  }, [kind, queryUserId, router, source]);

  return (
    <section className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href={backHref}>
          <ArrowLeft className="h-4 w-4" />
          Back to profile
        </Link>
      </Button>

      <Card className="rounded-[32px] border-border-strong bg-surface-strong p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Profile network</p>
            <h1 className="mt-2 text-3xl text-foreground sm:text-4xl">{title}</h1>
            <p className="mt-2 text-sm text-text-muted">{subtitle}</p>
          </div>
          <span className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-text-muted">
            <span className="block text-lg font-semibold text-foreground">{users.length}</span>
            {users.length === 1 ? "student" : "students"}
          </span>
        </div>

        {loading ? (
          <div className="mt-6 flex min-h-40 items-center justify-center text-text-muted">
            <LoaderCircle className="mr-2 h-5 w-5 animate-spin" />
            Loading users...
          </div>
        ) : error ? (
          <p className="mt-6 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p>
        ) : users.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-border bg-background px-4 py-4 text-sm text-text-muted">{emptyText}</p>
        ) : (
          <div className="mt-6 divide-y divide-border overflow-hidden rounded-[24px] border border-border bg-background">
            {users.map((user) => {
              const href = user.user_id === currentUserId ? "/profile" : `/users?userId=${user.user_id}`;

              return (
                <Link
                  key={user.user_id}
                  href={href}
                  className="flex items-center gap-4 px-4 py-4 transition hover:bg-surface sm:px-5"
                >
                  {user.avatar_url ? (
                    <Image
                      src={user.avatar_url}
                      alt={user.display_name}
                      width={56}
                      height={56}
                      className="h-14 w-14 shrink-0 rounded-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-border bg-surface">
                      <UserRound className="h-6 w-6 text-text-muted" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">{user.display_name}</p>
                    <p className="mt-1 text-sm text-text-muted">{getEducationLevelLabel(user.form)}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>
    </section>
  );
}
