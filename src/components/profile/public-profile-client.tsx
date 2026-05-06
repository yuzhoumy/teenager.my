"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, BookOpen, LoaderCircle, Star, UserRound } from "lucide-react";
import { getMaterialHref } from "@/lib/materials";
import { getSupabaseUser, isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";
import type { ForkStar, StudyMaterial, UserFork } from "@/types/resource";
import { Card } from "@/components/ui/card";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export function PublicProfileClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId");

  const [profile, setProfile] = useState<Pick<ProfileRow, "display_name" | "form" | "avatar_url"> | null>(null);
  const [resources, setResources] = useState<StudyMaterial[]>([]);
  const [forks, setForks] = useState<UserFork[]>([]);
  const [forkStarCount, setForkStarCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (!userId || !isSupabaseConfigured) {
        setLoading(false);
        return;
      }

      try {
        const currentUser = await getSupabaseUser();

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

        const [{ data: materialsData, error: materialsError }, { data: forksData, error: forksError }] = await Promise.all([
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
        ]);

        const activityErrors = [materialsError, forksError].filter(Boolean);
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
              <p className="mt-2 text-sm text-text-muted">Form {profile.form}</p>
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
          </div>
        </div>

        {error ? <p className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}

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
