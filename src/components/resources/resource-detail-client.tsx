"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, CheckCircle2, GraduationCap, MessageSquare, Tag, UserRound } from "lucide-react";
import {
  getMaterialGradeLabel,
  getMaterialTagLabel,
} from "@/lib/materials";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { createProfileNameMap, type ProfileNameRow } from "@/lib/profile-names";
import type { PinnedFork, ResourcePdfLink, SavedAnnotationLayer, StudyMaterial, UserFork } from "@/types/resource";
import { ResourceDiscussionThread } from "@/components/resources/resource-discussion-thread";
import { ResourceSidebar } from "@/components/resources/resource-sidebar";
import { PdfForkEditor } from "@/components/resources/resource-pdf-fork-editor";
import { MarkdownRenderer } from "@/components/resources/markdown-renderer";
import { ResourceStarButton } from "@/components/resources/resource-star-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const EmbeddedPdfViewer = dynamic(
  () => import("@/components/resources/embedded-pdf-viewer").then((module) => module.EmbeddedPdfViewer),
  { ssr: false },
);

type TabKey = "resource" | "fork" | "discussion";

function getAnnotatedPdfFileName(label: string) {
  const baseName = (label || "fork").trim().replace(/\.pdf$/i, "");
  return `${baseName || "fork"}-annotated.pdf`;
}

function extractPdfLinks(markdown: string) {
  const links: ResourcePdfLink[] = [];
  const pattern = /\[([^\]]+)\]\(([^)]+)\)/g;

  for (const match of markdown.matchAll(pattern)) {
    const label = match[1]?.trim() ?? "Open PDF";
    const href = match[2]?.trim() ?? "";
    if (/\.pdf($|[?#])/i.test(href)) {
      links.push({ label, href });
    }
  }

  return links;
}

export function ResourceDetailClient({ material }: { material: StudyMaterial }) {
  const [currentUploaderName, setCurrentUploaderName] = useState<{ materialId: string; authorName: string } | null>(null);
  const [currentTab, setCurrentTab] = useState<TabKey>("resource");
  const [pinnedForks, setPinnedForks] = useState<PinnedFork[]>([]);
  const [loadingPinnedForks, setLoadingPinnedForks] = useState(false);
  const [pinnedForksError, setPinnedForksError] = useState("");

  const displayMaterial = useMemo(
    () =>
      currentUploaderName?.materialId === material.id
        ? { ...material, author_name: currentUploaderName.authorName }
        : material,
    [currentUploaderName, material],
  );
  const pdfLinks = useMemo(() => extractPdfLinks(displayMaterial.content_markdown), [displayMaterial.content_markdown]);
  const primaryPdf = pdfLinks[0] ?? null;

  useEffect(() => {
    let cancelled = false;

    async function loadCurrentUploaderName() {
      if (!isSupabaseConfigured || !material.uploaded_by) {
        return;
      }

      const { data: profileRow, error: profileError } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", material.uploaded_by)
        .maybeSingle();

      const typedProfile = profileError ? null : (profileRow as Pick<ProfileNameRow, "display_name"> | null);
      const displayName = typedProfile?.display_name?.trim() ?? "";
      if (!cancelled && displayName) {
        setCurrentUploaderName({ materialId: material.id, authorName: displayName });
      }
    }

    void loadCurrentUploaderName();

    return () => {
      cancelled = true;
    };
  }, [material.id, material.uploaded_by]);

  useEffect(() => {
    let cancelled = false;

    async function loadPinnedForks() {
      if (!isSupabaseConfigured) {
        return;
      }

      setLoadingPinnedForks(true);
      setPinnedForksError("");

      try {
        const { data: forkRows, error: forkError } = await supabase
          .from("user_forks")
          .select("*")
          .eq("material_id", material.id)
          .eq("is_pinned", true)
          .order("pinned_order", { ascending: true })
          .order("created_at", { ascending: false });

        if (forkError) {
          throw forkError;
        }

        const forks = (forkRows ?? []) as UserFork[];
        if (forks.length === 0) {
          if (!cancelled) {
            setPinnedForks([]);
          }
          return;
        }

        const userIds = Array.from(new Set(forks.map((fork) => fork.user_id)));
        const { data: profileRows, error: profileError } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", userIds);

        const profileMap = createProfileNameMap((profileError ? [] : (profileRows ?? [])) as ProfileNameRow[]);

        if (!cancelled) {
          setPinnedForks(
            forks.map((fork) => ({
              ...fork,
              author_name: profileMap.get(fork.user_id) ?? "Anonymous student",
            })),
          );
        }
      } catch (loadError) {
        if (!cancelled) {
          setPinnedForks([]);
          setPinnedForksError(loadError instanceof Error ? loadError.message : "Unable to load pinned forks.");
        }
      } finally {
        if (!cancelled) {
          setLoadingPinnedForks(false);
        }
      }
    }

    void loadPinnedForks();

    return () => {
      cancelled = true;
    };
  }, [material.id]);

  const renderEmbeddedPdfLink = (
    href: string,
    label: string,
    index: number,
    prefix: string,
    annotationLayers?: Record<number, SavedAnnotationLayer> | null,
  ) => (
    <EmbeddedPdfViewer
      key={`${prefix}-pdf-${index}`}
      file={href}
      title={label}
      downloadHref={href}
      annotationLayers={annotationLayers}
      enableAnnotatedDownload={annotationLayers !== undefined}
      downloadFileName={getAnnotatedPdfFileName(label)}
      className="relative left-1/2 w-[calc(100vw-10px)] max-w-[calc(100vw-10px)] -translate-x-1/2 sm:left-auto sm:w-auto sm:max-w-full sm:translate-x-0"
    />
  );

  return (
    <section className="space-y-6">
      <Link href="/resources" className="inline-flex items-center gap-2 text-sm font-medium text-text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Back to resources
      </Link>

      <div className="min-w-0 max-w-full overflow-visible p-0 sm:overflow-hidden sm:rounded-[32px] sm:border sm:border-border-strong sm:bg-surface-strong sm:shadow-[0_4px_24px_var(--shadow)] lg:overflow-visible">
        <div className="border-b border-border px-[5px] py-[5px] sm:bg-gradient-to-br sm:from-surface sm:via-background sm:to-surface-muted sm:px-8 sm:py-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-4xl">
              <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Resource viewer</p>
              <h1 className="mt-3 text-4xl text-foreground sm:text-5xl">{displayMaterial.title}</h1>
              <p className="mt-4 max-w-3xl text-base text-text-muted">
                Read the markdown like a project README, then view or fork the document inside a tabbed workspace.
              </p>
              {displayMaterial.has_solution ? (
                <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-sm font-semibold text-emerald-200">
                  <CheckCircle2 className="h-4 w-4" />
                  Solution provided
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-6 grid gap-3 border-t border-border pt-5 text-sm text-text-muted sm:grid-cols-2 xl:grid-cols-5">
            <span className="inline-flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-brand" />
              {getMaterialGradeLabel(displayMaterial.grade)}
            </span>
            <span className="inline-flex items-center gap-2">
              <Tag className="h-4 w-4 text-brand" />
              {displayMaterial.subject}
            </span>
            <span className="inline-flex items-center gap-2">
              <UserRound className="h-4 w-4 text-brand" />
              {displayMaterial.uploaded_by ? (
                <Link href={`/users?userId=${displayMaterial.uploaded_by}`} className="hover:text-foreground">
                  {displayMaterial.author_name}
                </Link>
              ) : (
                displayMaterial.author_name
              )}
            </span>
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-brand" />
              {displayMaterial.year}
            </span>
            <span className="inline-flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-brand" />
              {pdfLinks.length} PDF attachment{pdfLinks.length === 1 ? "" : "s"}
            </span>
          </div>

          {displayMaterial.category_tags.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {displayMaterial.category_tags.map((tag) => (
                <Badge key={tag}>{getMaterialTagLabel(tag)}</Badge>
              ))}
            </div>
          ) : null}
        </div>

        <div className="border-b border-border px-[5px] py-[5px] sm:px-8 sm:py-5">
          <div className="flex flex-wrap gap-2">
            {([
              { key: "resource" as const, label: "Resource" },
              { key: "fork" as const, label: "Fork" },
              { key: "discussion" as const, label: "Discussion" },
            ]).map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  currentTab === tab.key
                    ? "bg-foreground text-background"
                    : "border border-border bg-surface text-text-muted hover:border-foreground hover:text-foreground"
                }`}
                onClick={() => setCurrentTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-w-0 max-w-full px-[5px] py-[5px] sm:px-8 sm:py-6">
          {currentTab === "resource" ? (
            <div className="grid min-w-0 max-w-full gap-0 lg:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)] lg:items-start">
              <article className="min-w-0 border-b border-border pb-6 lg:border-b-0 lg:border-r lg:pr-8">
                <div className="mx-auto min-w-0 max-w-none">
                  <div className="prose-reset markdown-readme min-w-0 max-w-full">
                    <MarkdownRenderer
                      markdown={displayMaterial.content_markdown}
                      renderPdfLink={(href, label, index) => renderEmbeddedPdfLink(href, label, index, "resource")}
                    />
                  </div>

                  <div className="mt-[10px] lg:hidden">
                    <ResourceSidebar pinnedForks={pinnedForks} />
                  </div>

                  {loadingPinnedForks ? (
                    <div className="mt-[10px] border-y border-border py-[5px] text-sm text-text-muted sm:mt-8 sm:rounded-[24px] sm:border sm:bg-surface sm:p-5">
                      Loading pinned forks...
                    </div>
                  ) : null}

                  {pinnedForksError ? (
                    <div className="mt-[10px] border-y border-rose-400/30 bg-rose-400/10 py-[5px] text-sm text-rose-200 sm:mt-8 sm:rounded-[24px] sm:border sm:p-5">
                      {pinnedForksError}
                    </div>
                  ) : null}

                  {pinnedForks.map((fork, index) => (
                    <section
                      key={fork.id}
                      id={`pinned-fork-${fork.id}`}
                      className="mt-[10px] min-w-0 max-w-full border-t border-border bg-transparent pt-[10px] scroll-mt-24 sm:mt-8 sm:rounded-[28px] sm:border sm:border-border sm:bg-background sm:p-6"
                    >
                      <div className="mb-[5px] flex flex-wrap items-start justify-between gap-[5px] sm:mb-5 sm:gap-3">
                        <div>
                          <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Pinned fork</p>
                          <h2 className="mt-2 text-3xl text-foreground">
                            {fork.pinned_title?.trim() || `Pinned fork ${index + 1}`}
                          </h2>
                          <p className="mt-2 text-sm text-text-muted">
                            By{" "}
                            <Link href={`/users?userId=${fork.user_id}`} className="hover:text-foreground">
                              {fork.author_name}
                            </Link>
                          </p>
                        </div>
                      </div>

                      <MarkdownRenderer
                        markdown={fork.markdown_content}
                        renderPdfLink={(href, label, pdfIndex) =>
                          renderEmbeddedPdfLink(href, label, pdfIndex, `pinned-${fork.id}`, fork.annotation_layers)
                        }
                      />
                    </section>
                  ))}
                </div>
              </article>

              <aside className="hidden px-6 py-6 lg:sticky lg:top-10 lg:mt-4 lg:block lg:max-h-[calc(100vh-4rem)] lg:self-start lg:overflow-y-auto lg:px-6">
                <ResourceSidebar pinnedForks={pinnedForks} />
              </aside>
            </div>
          ) : currentTab === "fork" ? (
            <PdfForkEditor
              materialId={material.id}
              materialSlug={material.slug}
              sourceUrl={primaryPdf?.href ?? ""}
              initialMarkdown={displayMaterial.content_markdown}
            />
          ) : (
            <ResourceDiscussionThread materialId={material.id} />
          )}
        </div>
      </div>
    </section>
  );
}
