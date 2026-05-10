"use client";

import Image from "next/image";
import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, BookOpen, Flag, LoaderCircle, Star, UserCheck, UserPlus, UserRound, X } from "lucide-react";
import { getEducationLevelLabel } from "@/lib/education-levels";
import { getMaterialHref } from "@/lib/materials";
import { getSupabaseUser, isSupabaseConfigured, supabase } from "@/lib/supabase";
import { ContributionGraph } from "@/components/profile/contribution-graph";
import type { ContributionActivity } from "@/lib/profile-contributions";
import type { Database } from "@/types/database";
import type { ForkStar, StudyMaterial, UserFork } from "@/types/resource";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export function PublicProfileClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId");

  const [profile, setProfile] = useState<Pick<ProfileRow, "display_name" | "form" | "avatar_url"> | null>(null);
  const [resources, setResources] = useState<StudyMaterial[]>([]);
  const [forks, setForks] = useState<UserFork[]>([]);
  const [forkStarCount, setForkStarCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [updatingFollow, setUpdatingFollow] = useState(false);
  const [followingCount, setFollowingCount] = useState(0);
  const [followerCount, setFollowerCount] = useState(0);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportMessage, setReportMessage] = useState("");
  const [reportMessageType, setReportMessageType] = useState<"success" | "error">("success");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const contributionActivity = useMemo<ContributionActivity[]>(
    () => [
      ...resources.map((resource) => ({
        id: `upload-${resource.id}`,
        type: "upload" as const,
        title: resource.title,
        href: getMaterialHref(resource),
        createdAt: resource.created_at,
      })),
      ...forks.map((fork) => ({
        id: `fork-${fork.id}`,
        type: "fork" as const,
        title: fork.pinned_title?.trim() || "Community fork",
        href: `/forks?forkId=${fork.id}`,
        createdAt: fork.created_at,
      })),
    ],
    [forks, resources],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (!userId || !isSupabaseConfigured) {
        setLoading(false);
        return;
      }

      try {
        const currentUser = await getSupabaseUser();
        setCurrentUserId(currentUser?.id ?? null);

        if (currentUser?.id === userId) {
          router.replace("/profile");
          return;
        }

        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("display_name, form, avatar_url")
          .eq("user_id", userId)
          .maybeSingle();

        if (profileError) {
          throw profileError;
        }

        if (!profileData) {
          if (!cancelled) {
            setProfile(null);
          }
          return;
        }

        if (!cancelled) {
          setProfile(profileData as Pick<ProfileRow, "display_name" | "form" | "avatar_url">);
        }

        const [
          { data: materialsData, error: materialsError },
          { data: forksData, error: forksError },
          followingResult,
          followerResult,
          followStateResult,
        ] = await Promise.all([
          supabase
            .from("materials")
            .select("*")
            .eq("uploaded_by", userId)
            .order("created_at", { ascending: false }),
          supabase
            .from("user_forks")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(6),
          supabase
            .from("profile_follows")
            .select("id", { count: "exact", head: true })
            .eq("follower_id", userId),
          supabase
            .from("profile_follows")
            .select("id", { count: "exact", head: true })
            .eq("followed_id", userId),
          currentUser
            ? supabase
                .from("profile_follows")
                .select("id")
                .eq("follower_id", currentUser.id)
                .eq("followed_id", userId)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        ]);

        const activityErrors = [materialsError, forksError, followingResult.error, followerResult.error].filter(Boolean);
        const typedMaterials = materialsError ? [] : ((materialsData ?? []) as StudyMaterial[]);
        const typedForks = forksError ? [] : ((forksData ?? []) as UserFork[]);
        let stars: ForkStar[] = [];

        if (typedForks.length > 0) {
          const { data: starsData, error: starsError } = await supabase
            .from("fork_stars")
            .select("id, fork_id, user_id, created_at")
            .in("fork_id", typedForks.map((fork) => fork.id));

          if (starsError) {
            activityErrors.push(starsError);
          } else {
            stars = (starsData ?? []) as ForkStar[];
          }
        }

        if (!cancelled) {
          setResources(typedMaterials);
          setForks(typedForks);
          setForkStarCount(stars.length);
          setFollowingCount(followingResult.count ?? 0);
          setFollowerCount(followerResult.count ?? 0);
          setIsFollowing(Boolean(followStateResult.data) && !followStateResult.error);
          setError(activityErrors.length > 0 ? "Some profile activity could not be loaded." : "");
        }
      } catch (loadError) {
        if (!cancelled) {
          const message =
            loadError instanceof Error
              ? loadError.message
              : typeof loadError === "object" && loadError && "message" in loadError && typeof loadError.message === "string"
                ? loadError.message
                : "Unable to load this profile.";
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [router, userId]);

  useEffect(() => {
    if (!userId || !isSupabaseConfigured) {
      return;
    }

    const channel = supabase
      .channel(`public-profile-contribution-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "materials", filter: `uploaded_by=eq.${userId}` },
        (payload) => {
          const material = payload.new as StudyMaterial;
          setResources((current) => {
            if (current.some((item) => item.id === material.id)) {
              return current;
            }
            return [material, ...current];
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "user_forks", filter: `user_id=eq.${userId}` },
        (payload) => {
          const fork = payload.new as UserFork;
          setForks((current) => {
            if (current.some((item) => item.id === fork.id)) {
              return current;
            }
            return [fork, ...current];
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  async function toggleFollow() {
    if (!userId || !currentUserId || updatingFollow) {
      return;
    }

    setError("");
    setUpdatingFollow(true);

    if (isFollowing) {
      const { error: deleteError } = await supabase
        .from("profile_follows")
        .delete()
        .eq("follower_id", currentUserId)
        .eq("followed_id", userId);

      setUpdatingFollow(false);

      if (deleteError) {
        setError(deleteError.message);
        return;
      }

      setIsFollowing(false);
      setFollowerCount((current) => Math.max(0, current - 1));
      return;
    }

    const payload: Database["public"]["Tables"]["profile_follows"]["Insert"] = {
      follower_id: currentUserId,
      followed_id: userId,
    };
    const { error: insertError } = await supabase
      .from("profile_follows")
      .upsert(payload as never, { onConflict: "follower_id,followed_id", ignoreDuplicates: true });

    setUpdatingFollow(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setIsFollowing(true);
    setFollowerCount((current) => current + 1);
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId || !currentUserId || reportSubmitting) {
      return;
    }

    const reason = reportReason.trim();

    if (reason.length < 10) {
      setReportMessageType("error");
      setReportMessage("Please add a little more detail before sending the report.");
      return;
    }

    setReportSubmitting(true);
    setReportMessage("");

    const payload: Database["public"]["Tables"]["profile_reports"]["Insert"] = {
      reported_user_id: userId,
      reporter_id: currentUserId,
      reason,
    };
    const { error: reportError } = await supabase.from("profile_reports").insert(payload as never);

    setReportSubmitting(false);

    if (reportError) {
      setReportMessageType("error");
      setReportMessage(reportError.message);
      return;
    }

    setReportMessageType("success");
    setReportMessage("Thanks. Your report has been saved for review.");
    setReportReason("");
    setIsReportOpen(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-text-muted">
        <LoaderCircle className="mr-2 h-5 w-5 animate-spin" />
        Loading profile...
      </div>
    );
  }

  if (!userId || !profile) {
    return (
      <section className="space-y-4">
        <Link href="/resources" className="inline-flex items-center gap-2 text-sm font-medium text-text-muted hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to resources
        </Link>
        <Card className="rounded-[28px] p-6">
          <p className="text-sm text-rose-200">{error || "Profile not found."}</p>
        </Card>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <Link href="/resources" className="inline-flex items-center gap-2 text-sm font-medium text-text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Back to resources
      </Link>

      <Card className="rounded-[32px] border-border-strong bg-surface-strong p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            {profile.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={profile.display_name}
                width={72}
                height={72}
                className="h-[72px] w-[72px] rounded-full object-cover"
                unoptimized
              />
            ) : (
              <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full border border-border bg-surface">
                <UserRound className="h-8 w-8 text-text-muted" />
              </div>
            )}

            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Public profile</p>
              <h1 className="mt-2 text-3xl text-foreground">{profile.display_name}</h1>
              <p className="mt-2 text-sm text-text-muted">{getEducationLevelLabel(profile.form)}</p>
              {currentUserId ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant={isFollowing ? "secondary" : "default"} onClick={toggleFollow} disabled={updatingFollow}>
                    {isFollowing ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                    {updatingFollow ? "Updating..." : isFollowing ? "Following" : "Follow"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsReportOpen((current) => !current);
                      setReportMessage("");
                    }}
                  >
                    {isReportOpen ? <X className="h-4 w-4" /> : <Flag className="h-4 w-4" />}
                    {isReportOpen ? "Cancel report" : "Report"}
                  </Button>
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href="/login">
                      <UserPlus className="h-4 w-4" />
                      Log in to follow
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/login">
                      <Flag className="h-4 w-4" />
                      Log in to report
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-text-muted">
              <span className="block text-lg font-semibold text-foreground">{resources.length}</span>
              Resources
            </div>
            <div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-text-muted">
              <span className="block text-lg font-semibold text-foreground">{forks.length}</span>
              Forks
            </div>
            <div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-text-muted">
              <span className="block text-lg font-semibold text-foreground">{forkStarCount}</span>
              Fork stars
            </div>
            <div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-text-muted">
              <span className="block text-lg font-semibold text-foreground">{followingCount}</span>
              Following
            </div>
            <div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-text-muted">
              <span className="block text-lg font-semibold text-foreground">{followerCount}</span>
              Followed by
            </div>
          </div>
        </div>

        {error ? <p className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}
        {isReportOpen ? (
          <form onSubmit={submitReport} className="mt-4 rounded-2xl border border-border bg-background p-4">
            <label htmlFor="profile-report-reason" className="text-sm font-medium text-foreground">
              Reason for report
            </label>
            <Textarea
              id="profile-report-reason"
              value={reportReason}
              onChange={(event) => setReportReason(event.target.value)}
              minLength={10}
              maxLength={1000}
              required
              rows={4}
              className="mt-2"
              placeholder="Tell us what seems unsafe, inappropriate, or misleading."
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button type="submit" size="sm" disabled={reportSubmitting}>
                <Flag className="h-4 w-4" />
                {reportSubmitting ? "Sending..." : "Submit report"}
              </Button>
              <p className="text-xs text-text-muted">{reportReason.trim().length}/1000 characters</p>
            </div>
          </form>
        ) : null}
        {reportMessage ? (
          <p
            className={
              reportMessageType === "success"
                ? "mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200"
                : "mt-4 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200"
            }
          >
            {reportMessage}
          </p>
        ) : null}

        <div className="mt-6 rounded-[24px] border border-border bg-background p-5">
          <h2 className="mb-2 text-xl text-foreground">Contributions</h2>
          <ContributionGraph activity={contributionActivity} />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-[24px] border border-border bg-background p-5">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-brand" />
              <h2 className="text-xl text-foreground">Uploaded resources</h2>
            </div>

            <div className="mt-4 space-y-3">
              {resources.length > 0 ? (
                resources.map((resource) => (
                  <Link
                    key={resource.id}
                    href={getMaterialHref(resource)}
                    className="block rounded-2xl border border-border bg-surface px-4 py-3 transition hover:border-foreground"
                  >
                    <p className="font-semibold text-foreground">{resource.title}</p>
                    <p className="mt-1 text-sm text-text-muted">
                      {resource.subject} • {resource.year}
                    </p>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-text-muted">No uploaded resources yet.</p>
              )}
            </div>
          </div>

          <div className="rounded-[24px] border border-border bg-background p-5">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-brand" />
              <h2 className="text-xl text-foreground">Recent forks</h2>
            </div>

            <div className="mt-4 space-y-3">
              {forks.length > 0 ? (
                forks.map((fork) => (
                  <Link
                    key={fork.id}
                    href={`/forks?forkId=${fork.id}`}
                    className="block rounded-2xl border border-border bg-surface px-4 py-3 transition hover:border-foreground"
                  >
                    <p className="font-semibold text-foreground">{fork.pinned_title?.trim() || "Community fork"}</p>
                    <p className="mt-1 text-sm text-text-muted">
                      Saved on {new Date(fork.created_at).toLocaleDateString()}
                    </p>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-text-muted">No public forks yet.</p>
              )}
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
}
