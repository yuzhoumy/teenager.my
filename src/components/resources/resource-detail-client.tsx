"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, BookCopy, CalendarDays, GraduationCap, MessageSquare, Tag, UserRound } from "lucide-react";
import {
  getMaterialCoreTypeLabel,
  getMaterialGradeLabel,
  getMaterialTagLabel,
} from "@/lib/materials";
import type { ResourcePdfLink, StudyMaterial } from "@/types/resource";
import { ResourceDiscussionThread } from "@/components/resources/resource-discussion-thread";
import { ResourcePdfModal } from "@/components/resources/resource-pdf-modal";
import { ResourceSidebar } from "@/components/resources/resource-sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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
  const [activePdf, setActivePdf] = useState<ResourcePdfLink | null>(null);
  const pdfLinks = useMemo(() => extractPdfLinks(material.content_markdown), [material.content_markdown]);
  const primaryPdf = pdfLinks[0] ?? null;

  return (
    <>
      <section className="space-y-6">
        <Link
          href="/resources"
          className="inline-flex items-center gap-2 text-sm font-medium text-text-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to resources
        </Link>

        <Card className="overflow-hidden rounded-[32px] border-border-strong bg-surface-strong p-0">
          <div className="border-b border-border bg-[linear-gradient(135deg,rgba(20,20,19,0.04),transparent_45%),linear-gradient(180deg,#fffdf8,#faf8f1)] px-6 py-6 sm:px-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-4xl">
                <p className="text-sm uppercase tracking-[0.18em] text-text-soft">README-style resource</p>
                <h1 className="mt-3 text-4xl text-foreground sm:text-5xl">{material.title}</h1>
                <p className="mt-4 max-w-3xl text-base text-text-muted">
                  Read the markdown like a project README, then open attached PDFs in an overlay viewer or fork them
                  into your own annotated layer.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Badge className="bg-[#f3ebe4] text-brand">{getMaterialCoreTypeLabel(material.core_type)}</Badge>
                <Button
                  type="button"
                  size="sm"
                  variant={primaryPdf ? "default" : "outline"}
                  disabled={!primaryPdf}
                  onClick={() => primaryPdf && setActivePdf(primaryPdf)}
                >
                  <BookCopy className="h-4 w-4" />
                  Fork
                </Button>
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

          <div className="grid gap-0 lg:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)]">
            <article className="border-b border-border px-6 py-6 lg:border-b-0 lg:border-r lg:px-8">
              <div className="mx-auto max-w-none">
                <div className="prose-reset markdown-readme">
                  <ReactMarkdown
                    components={{
                      h1: ({ children }) => <h1 className="mt-0 border-b border-border pb-4 text-4xl text-foreground">{children}</h1>,
                      h2: ({ children }) => <h2 className="mt-10 border-b border-border pb-3 text-2xl text-foreground">{children}</h2>,
                      h3: ({ children }) => <h3 className="mt-8 text-xl text-foreground">{children}</h3>,
                      p: ({ children }) => <p className="mt-4 text-[15px] leading-7 text-text-muted">{children}</p>,
                      ul: ({ children }) => <ul className="mt-4 list-disc space-y-2 pl-6 text-[15px] leading-7 text-text-muted">{children}</ul>,
                      ol: ({ children }) => <ol className="mt-4 list-decimal space-y-2 pl-6 text-[15px] leading-7 text-text-muted">{children}</ol>,
                      li: ({ children }) => <li>{children}</li>,
                      code: ({ children }) => (
                        <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[0.95em] text-foreground">
                          {children}
                        </code>
                      ),
                      pre: ({ children }) => (
                        <pre className="mt-5 overflow-x-auto rounded-2xl border border-border bg-[#171717] px-4 py-4 text-sm text-[#f8f8f2]">
                          {children}
                        </pre>
                      ),
                      blockquote: ({ children }) => (
                        <blockquote className="mt-5 border-l-4 border-brand/45 bg-surface px-4 py-3 text-sm italic text-text-muted">
                          {children}
                        </blockquote>
                      ),
                      a: ({ href, children }) => {
                        const url = href ?? "";
                        if (/\.pdf($|[?#])/i.test(url)) {
                          const label = typeof children === "string" ? children : "Open PDF";
                          return (
                            <button
                              type="button"
                              onClick={() => setActivePdf({ href: url, label: `${label}` })}
                              className="font-medium text-brand underline decoration-brand/35 underline-offset-4 hover:text-brand-soft"
                            >
                              {children}
                            </button>
                          );
                        }

                        return (
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-brand underline decoration-brand/35 underline-offset-4 hover:text-brand-soft"
                          >
                            {children}
                          </a>
                        );
                      },
                    }}
                  >
                    {material.content_markdown}
                  </ReactMarkdown>
                </div>
              </div>
            </article>

            <aside className="bg-[#fbfaf5] px-6 py-6 lg:px-6">
              <ResourceSidebar material={material} pdfLinks={pdfLinks} onOpenPdf={setActivePdf} />
            </aside>
          </div>
        </Card>

        <ResourceDiscussionThread materialId={material.id} />
      </section>

      {activePdf ? (
        <ResourcePdfModal
          material={material}
          pdfLink={activePdf}
          open={Boolean(activePdf)}
          onClose={() => setActivePdf(null)}
        />
      ) : null}
    </>
  );
}
