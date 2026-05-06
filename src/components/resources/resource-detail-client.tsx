"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, GraduationCap, MessageSquare, Tag, UserRound } from "lucide-react";
import {
  getMaterialCoreTypeLabel,
  getMaterialGradeLabel,
  getMaterialTagLabel,
} from "@/lib/materials";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { PinnedFork, ResourcePdfLink, StudyMaterial, UserFork } from "@/types/resource";
import { ResourceDiscussionThread } from "@/components/resources/resource-discussion-thread";
import { ResourceSidebar } from "@/components/resources/resource-sidebar";
import { PdfForkEditor } from "@/components/resources/resource-pdf-fork-editor";
import { MarkdownRenderer } from "@/components/resources/markdown-renderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const EmbeddedPdfViewer = dynamic(
  () => import("@/components/resources/embedded-pdf-viewer").then((module) => module.EmbeddedPdfViewer),
  { ssr: false },
);

type TabKey = "resource" | "fork" | "discussion";

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
  const [currentTab, setCurrentTab] = useState<TabKey>("resource");
  const [pinnedForks, setPinnedForks] = useState<PinnedFork[]>([]);
  const [loadingPinnedForks, setLoadingPinnedForks] = useState(false);
  const [pinnedForksError, setPinnedForksError] = useState("");

  const pdfLinks = useMemo(() => extractPdfLinks(material.content_markdown), [material.content_markdown]);
  const primaryPdf = pdfLinks[0] ?? null;

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

        if (profileError) {
          throw profileError;
        }

        const profileMap = new Map(
          ((profileRows ?? []) as Array<{ user_id: string; display_name: string }>).map((profile) => [profile.user_id, profile.display_name]),
        );

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

  const renderEmbeddedPdfLink = (href: string, label: string, index: number, prefix: string) => (
    <div key={`${prefix}-pdf-${index}`} className="space-y-4 rounded-[28px] border border-border bg-[#08131f] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="text-sm text-text-muted">PDF attachment embedded inside the resource.</p>
        </div>
        <Button asChild size="sm" variant="outline">
          <a href={href} target="_blank" rel="noreferrer" download>
            Download
          </a>
        </Button>
      </div>
      <EmbeddedPdfViewer file={href} />
    </div>
  );

  return (
    <section className="space-y-6">
      <Link href="/resources" className="inline-flex items-center gap-2 text-sm font-medium text-text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Back to resources
      </Link>

      <Card className="overflow-hidden rounded-[32px] border-border-strong bg-surface-strong p-0 lg:overflow-visible">
        <div className="border-b border-border bg-gradient-to-br from-surface via-background to-surface-muted px-6 py-6 sm:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-4xl">
              <p className="text-sm uppercase tracking-[0.18em] text-text-soft">README-style resource</p>
              <h1 className="mt-3 text-4xl text-foreground sm:text-5xl">{material.title}</h1>
              <p className="mt-4 max-w-3xl text-base text-text-muted">
                Read the markdown like a project README, then view or fork the document inside a tabbed workspace.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Badge className="bg-[#f3ebe4] text-brand">{getMaterialCoreTypeLabel(material.core_type)}</Badge>
              <Button type="button" size="sm" variant="default" onClick={() => setCurrentTab("fork")}>Fork</Button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 border-t border-border pt-5 text-sm text-text-muted sm:grid-cols-2 xl:grid-cols-5">
            <span className="inline-flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-brand" />
              {getMaterialGradeLabel(material.grade)}
            </span>
            <span className="inline-flex items-center gap-2">
              <Tag className="h-4 w-4 text-brand" />
              {material.subject}
            </span>
            <span className="inline-flex items-center gap-2">
              <UserRound className="h-4 w-4 text-brand" />
              {material.uploaded_by ? (
                <Link href={`/users?userId=${material.uploaded_by}`} className="hover:text-foreground">
                  {material.author_name}
                </Link>
              ) : (
                material.author_name
              )}
            </span>
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-brand" />
              {material.year}
            </span>
            <span className="inline-flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-brand" />
              {pdfLinks.length} PDF attachment{pdfLinks.length === 1 ? "" : "s"}
            </span>
          </div>

          {material.category_tags.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {material.category_tags.map((tag) => (
                <Badge key={tag}>{getMaterialTagLabel(tag)}</Badge>
              ))}
            </div>
          ) : null}
        </div>

        <div className="border-b border-border px-6 py-5 sm:px-8">
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

        <div className="px-2 py-3 sm:px-8 sm:py-6">
          {currentTab === "resource" ? (
            <div className="grid gap-0 lg:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)] lg:items-start">
              <article className="border-b border-border pb-6 lg:border-b-0 lg:border-r lg:pr-8">
                <div className="mx-auto max-w-none">
                  <div className="prose-reset markdown-readme">
                    <MarkdownRenderer
                      markdown={material.content_markdown}
                      renderPdfLink={(href, label, index) => renderEmbeddedPdfLink(href, label, index, "resource")}
                    />
                  </div>

                  {loadingPinnedForks ? (
                    <div className="mt-8 rounded-[24px] border border-border bg-surface p-5 text-sm text-text-muted">
                      Loading pinned forks...
                    </div>
                  ) : null}

                  {pinnedForksError ? (
                    <div className="mt-8 rounded-[24px] border border-rose-400/30 bg-rose-400/10 p-5 text-sm text-rose-200">
                      {pinnedForksError}
                    </div>
                  ) : null}

                  {pinnedForks.map((fork, index) => (
                    <section
                      key={fork.id}
                      id={`pinned-fork-${fork.id}`}
                      className="mt-8 rounded-[28px] border border-border bg-background p-6 scroll-mt-24"
                    >
                      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
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
                        renderPdfLink={(href, label, pdfIndex) => renderEmbeddedPdfLink(href, label, pdfIndex, `pinned-${fork.id}`)}
                      />
                    </section>
                  ))}
                </div>
              </article>

              <aside className="px-6 py-6 lg:sticky lg:top-10 lg:mt-4 lg:max-h-[calc(100vh-4rem)] lg:self-start lg:overflow-y-auto lg:px-6">
                <ResourceSidebar material={material} pinnedForks={pinnedForks} />
              </aside>
            </div>
          ) : currentTab === "fork" ? (
            <PdfForkEditor
              materialId={material.id}
              materialSlug={material.slug}
              sourceUrl={primaryPdf?.href ?? ""}
              initialMarkdown={material.content_markdown}
            />
          ) : (
            <ResourceDiscussionThread materialId={material.id} />
          )}
        </div>
      </Card>
    </section>
  );
}
