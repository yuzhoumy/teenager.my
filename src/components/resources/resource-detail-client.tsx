"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, GraduationCap, MessageSquare, Tag, UserRound } from "lucide-react";
import {
  getMaterialCoreTypeLabel,
  getMaterialGradeLabel,
  getMaterialTagLabel,
} from "@/lib/materials";
import type { ResourcePdfLink, StudyMaterial } from "@/types/resource";
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

  const pdfLinks = useMemo(() => extractPdfLinks(material.content_markdown), [material.content_markdown]);
  const primaryPdf = pdfLinks[0] ?? null;

  return (
    <section className="space-y-6">
      <Link href="/resources" className="inline-flex items-center gap-2 text-sm font-medium text-text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Back to resources
      </Link>

      <Card className="overflow-hidden rounded-[32px] border-border-strong bg-surface-strong p-0">
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
              {material.author_name}
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

        <div className="px-6 py-6 sm:px-8">
          {currentTab === "resource" ? (
            <div className="grid gap-0 lg:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)]">
              <article className="border-b border-border pb-6 lg:border-b-0 lg:border-r lg:pr-8">
                <div className="mx-auto max-w-none">
                  <div className="prose-reset markdown-readme">
                    <MarkdownRenderer
                      markdown={material.content_markdown}
                      renderPdfLink={(href, label, index) => (
                        <div key={`resource-pdf-${index}`} className="space-y-4 rounded-[28px] border border-border bg-[#08131f] p-5">
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
                      )}
                    />
                  </div>
                </div>
              </article>

              <aside className="bg-[#fbfaf5] px-6 py-6 lg:px-6">
                <ResourceSidebar material={material} pdfLinks={pdfLinks} />
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
