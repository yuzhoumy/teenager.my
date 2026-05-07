"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, LoaderCircle, Star } from "lucide-react";
import { getSupabaseUser, isSupabaseConfigured, supabase } from "@/lib/supabase";
import { getProfileDisplayName, type ProfileNameRow } from "@/lib/profile-names";
import type { Database } from "@/types/database";
import type { ForkCardData, ForkStar, SavedAnnotationLayer, StudyMaterial, UserFork } from "@/types/resource";
import { MarkdownRenderer } from "@/components/resources/markdown-renderer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const EmbeddedPdfViewer = dynamic(
  () => import("@/components/resources/embedded-pdf-viewer").then((module) => module.EmbeddedPdfViewer),
  { ssr: false },
);

function isPdfLink(url: string) {
  return /\.pdf($|[?#])/i.test(url);
}

function isImageLink(url: string) {
  return /\.(png|jpe?g|gif|webp|svg|avif)($|[?#])/i.test(url);
}

function getAnnotatedPdfFileName(label: string) {
  const baseName = (label || "fork").trim().replace(/\.pdf$/i, "");
  return `${baseName || "fork"}-annotated.pdf`;
}

export function ForkViewerClient() {
  const searchParams = useSearchParams();
  const forkId = searchParams.get("forkId");
  const materialSlug = searchParams.get("materialSlug");

  const [fork, setFork] = useState<ForkCardData | null>(null);
  const [material, setMaterial] = useState<StudyMaterial | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [starring, setStarring] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadFork() {
      if (!forkId || !isSupabaseConfigured) {
        setLoading(false);
        return;
      }

      try {
        const user = await getSupabaseUser();
        if (cancelled) return;
        setCurrentUserId(user?.id ?? null);

        const { data: forkData, error: forkError } = await supabase
          .from("user_forks")
          .select("*")
          .eq("id", forkId)
          .maybeSingle();

        if (forkError) {
          throw forkError;
        }

        if (!forkData) {
          throw new Error("Fork not found.");
        }

        const typedFork = forkData as UserFork;

        const [{ data: materialData, error: materialError }, { data: profileData, error: profileError }, { data: starsData, error: starsError }] = await Promise.all([
          supabase.from("materials").select("*").eq("id", typedFork.material_id).maybeSingle(),
          supabase.from("profiles").select("display_name").eq("user_id", typedFork.user_id).maybeSingle(),
          supabase.from("fork_stars").select("*").eq("fork_id", typedFork.id),
        ]);

        if (materialError) {
          throw materialError;
        }

        if (starsError) {
          throw starsError;
        }

        if (cancelled) return;

        const stars = (starsData ?? []) as ForkStar[];
        const typedProfile = profileError ? null : (profileData as ProfileNameRow | null);
        setFork({
          ...typedFork,
          author_name: getProfileDisplayName(typedProfile, "Anonymous student"),
          star_count: stars.length,
          has_starred: Boolean(user?.id && stars.some((star) => star.user_id === user.id)),
        });
        setMaterial((materialData ?? null) as StudyMaterial | null);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load this fork.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadFork();

    return () => {
      cancelled = true;
    };
  }, [forkId]);

  const backHref = useMemo(() => {
    if (material?.slug) {
      return `/resources/${material.slug}`;
    }

    if (materialSlug) {
      return `/resources/${materialSlug}`;
    }

    return "/resources";
  }, [material?.slug, materialSlug]);

  const toggleStar = async () => {
    if (!fork || !currentUserId || starring) {
      if (!currentUserId) {
        setError("Please log in to star this fork.");
      }
      return;
    }

    setError("");
    setStarring(true);

    try {
      if (fork.has_starred) {
        const { error: deleteError } = await supabase
          .from("fork_stars")
          .delete()
          .eq("fork_id", fork.id)
          .eq("user_id", currentUserId);

        if (deleteError) {
          throw deleteError;
        }
      } else {
        const payload: Database["public"]["Tables"]["fork_stars"]["Insert"] = {
          fork_id: fork.id,
          user_id: currentUserId,
        };

        const { error: insertError } = await supabase
          .from("fork_stars")
          .insert(payload as never);

        if (insertError) {
          throw insertError;
        }
      }

      setFork((current) =>
        current
          ? {
              ...current,
              has_starred: !current.has_starred,
              star_count: current.has_starred ? Math.max(0, current.star_count - 1) : current.star_count + 1,
            }
          : current,
      );
    } catch (starError) {
      setError(starError instanceof Error ? starError.message : "Unable to update fork star.");
    } finally {
      setStarring(false);
    }
  };

  const renderPdfLink = (href: string, label: string, index: number) => (
    <EmbeddedPdfViewer
      key={`fork-pdf-${index}`}
      file={href}
      title={label}
      annotationLayers={(fork?.annotation_layers ?? {}) as Record<number, SavedAnnotationLayer>}
      enableAnnotatedDownload
      downloadFileName={getAnnotatedPdfFileName(label)}
      className="relative left-1/2 w-[calc(100vw-10px)] max-w-[calc(100vw-10px)] -translate-x-1/2 sm:left-auto sm:w-auto sm:max-w-full sm:translate-x-0"
    />
  );

  const renderImageLink = (href: string, label: string, index: number) => (
    <div key={`fork-image-${index}`} className="mb-6 rounded-[28px] border border-border bg-[#08131f] p-5">
      <p className="mb-4 text-sm font-semibold text-foreground">{label}</p>
      <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#09101b]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={href} alt={label} className="h-auto max-h-[720px] w-full object-contain bg-[#0b1421]" />
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-text-muted">
        <LoaderCircle className="mr-2 h-5 w-5 animate-spin" />
        Loading fork...
      </div>
    );
  }

  if (!fork) {
    return (
      <div className="space-y-4">
        <Link href={backHref} className="inline-flex items-center gap-2 text-sm font-medium text-text-muted hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to resource
        </Link>
        <Card className="rounded-[28px] p-6">
          <p className="text-sm text-rose-200">{error || "Fork not found."}</p>
        </Card>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <Link href={backHref} className="inline-flex items-center gap-2 text-sm font-medium text-text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Back to resource
      </Link>

      <div className="min-w-0 max-w-full overflow-visible p-0 sm:overflow-hidden sm:rounded-[32px] sm:border sm:border-border-strong sm:bg-surface-strong sm:p-6 sm:shadow-[0_4px_24px_var(--shadow)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Fork viewer</p>
            <h1 className="mt-2 text-3xl text-foreground">{material?.title ?? "Community fork"}</h1>
            <p className="mt-3 text-sm text-text-muted">
              By{" "}
              <Link href={`/users?userId=${fork.user_id}`} className="hover:text-foreground">
                {fork.author_name}
              </Link>
              {" "}• Saved on {new Date(fork.created_at).toLocaleDateString()}
            </p>
          </div>

          <Button type="button" variant={fork.has_starred ? "secondary" : "outline"} onClick={() => void toggleStar()} disabled={starring}>
            <Star className={`h-4 w-4 ${fork.has_starred ? "fill-current" : ""}`} />
            {fork.star_count}
          </Button>
        </div>

        {error ? <p className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}

        {fork.description?.trim() ? (
          <div className="mt-[5px] min-w-0 max-w-full bg-transparent p-0 sm:mt-6 sm:rounded-[24px] sm:border sm:border-border sm:bg-background sm:p-5">
            <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Fork description</p>
            <p className="mt-3 text-sm leading-7 text-text-muted">{fork.description}</p>
          </div>
        ) : null}

        <div className="mt-[5px] min-w-0 max-w-full overflow-visible bg-transparent p-0 sm:mt-6 sm:overflow-hidden sm:rounded-[24px] sm:border sm:border-border sm:bg-background sm:p-5">
          <MarkdownRenderer
            markdown={fork.markdown_content}
            renderPdfLink={(href, label, index) => (isPdfLink(href) ? renderPdfLink(href, label, index) : null)}
            renderImageLink={(href, label, index) => (isImageLink(href) ? renderImageLink(href, label, index) : null)}
          />
        </div>
      </div>
    </section>
  );
}
