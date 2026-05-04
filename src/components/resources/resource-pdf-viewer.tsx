"use client";

import { useEffect, useMemo, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { BookmarkPlus, Highlighter, LoaderCircle } from "lucide-react";
import type { AnnotationRect } from "@/types/database";
import type { ForkAnnotation, UserFork } from "@/types/resource";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// Import react-pdf CSS for text layer support
import "react-pdf/dist/Page/TextLayer.css";

// Use CDN for PDF.js worker to avoid issues with import.meta.url in Next.js
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs`;

type DragState = {
  pageNumber: number;
  pageHeight: number;
  pageWidth: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
};

type DraftSelection = {
  pageNumber: number;
  rect: AnnotationRect;
};

async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

function normalizeRect(drag: DragState): AnnotationRect {
  const left = Math.min(drag.startX, drag.currentX);
  const top = Math.min(drag.startY, drag.currentY);
  const width = Math.abs(drag.currentX - drag.startX);
  const height = Math.abs(drag.currentY - drag.startY);

  return {
    x: left / drag.pageWidth,
    y: top / drag.pageHeight,
    width: width / drag.pageWidth,
    height: height / drag.pageHeight,
  };
}

export function PdfAnnotationViewer({
  materialId,
  sourceUrl,
}: {
  materialId: string;
  sourceUrl: string;
}) {
  const [numPages, setNumPages] = useState(0);
  const [fork, setFork] = useState<UserFork | null>(null);
  const [annotations, setAnnotations] = useState<ForkAnnotation[]>([]);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [draftSelection, setDraftSelection] = useState<DraftSelection | null>(null);
  const [comment, setComment] = useState("");
  const [quote, setQuote] = useState("");
  const [loading, setLoading] = useState(true);
  const [creatingFork, setCreatingFork] = useState(false);
  const [savingAnnotation, setSavingAnnotation] = useState(false);
  const [error, setError] = useState("");

  const liveRect = useMemo(() => (dragState ? normalizeRect(dragState) : null), [dragState]);

  useEffect(() => {
    let cancelled = false;

    async function loadForkData() {
      if (!isSupabaseConfigured) {
        setLoading(false);
        return;
      }

      try {
        const user = await getCurrentUser();
        if (!user) {
          if (!cancelled) {
            setFork(null);
            setAnnotations([]);
            setLoading(false);
          }
          return;
        }

        const { data: forkData, error: forkError } = await supabase
          .from("user_forks")
          .select("*")
          .eq("user_id", user.id)
          .eq("material_id", materialId)
          .eq("source_url", sourceUrl)
          .maybeSingle();

        if (forkError) {
          throw forkError;
        }

        if (!forkData) {
          if (!cancelled) {
            setFork(null);
            setAnnotations([]);
            setLoading(false);
          }
          return;
        }

        const typedFork = forkData as UserFork;
        const { data: annotationData, error: annotationError } = await supabase
          .from("annotations")
          .select("*")
          .eq("fork_id", typedFork.id)
          .order("created_at", { ascending: false });

        if (annotationError) {
          throw annotationError;
        }

        if (!cancelled) {
          setFork(typedFork);
          setAnnotations((annotationData ?? []) as ForkAnnotation[]);
          setLoading(false);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? `Failed to load fork data: ${loadError.message}` : "Failed to load fork data.");
          setLoading(false);
        }
      }
    }

    void loadForkData();

    return () => {
      cancelled = true;
    };
  }, [materialId, sourceUrl]);

  async function ensureFork() {
    if (!isSupabaseConfigured) {
      throw new Error("Supabase is not configured.");
    }

    if (fork) {
      return fork;
    }

    const user = await getCurrentUser();
    if (!user) {
      throw new Error("Please log in to fork this PDF.");
    }

    setCreatingFork(true);

    try {
      const { data: existingFork, error: existingError } = await supabase
        .from("user_forks")
        .select("*")
        .eq("user_id", user.id)
        .eq("material_id", materialId)
        .eq("source_url", sourceUrl)
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      if (existingFork) {
        const typedExistingFork = existingFork as UserFork;
        setFork(typedExistingFork);
        return typedExistingFork;
      }

      const payload = {
        user_id: user.id,
        material_id: materialId,
        source_url: sourceUrl,
      };

      const { data, error: insertError } = await supabase
        .from("user_forks")
        .insert(payload as never)
        .select("*")
        .single();

      if (insertError) {
        throw insertError;
      }

      const createdFork = data as UserFork;
      setFork(createdFork);
      return createdFork;
    } finally {
      setCreatingFork(false);
    }
  }

  async function handleFork() {
    setError("");

    try {
      await ensureFork();
    } catch (forkError) {
      setError(forkError instanceof Error ? `Failed to fork PDF: ${forkError.message}` : "Failed to create PDF fork.");
    }
  }

  async function saveAnnotation() {
    if (!draftSelection || !comment.trim() || savingAnnotation) {
      return;
    }

    setSavingAnnotation(true);
    setError("");

    try {
      const user = await getCurrentUser();
      if (!user) {
        throw new Error("Please log in to save annotations.");
      }

      const activeFork = await ensureFork();
      const payload = {
        fork_id: activeFork.id,
        page_number: draftSelection.pageNumber,
        bounding_rect: draftSelection.rect,
        comment: comment.trim(),
        quote: quote.trim() || null,
        created_by: user.id,
      };

      const { data, error: insertError } = await supabase
        .from("annotations")
        .insert(payload as never)
        .select("*")
        .single();

      if (insertError) {
        throw insertError;
      }

      setAnnotations((current) => [data as ForkAnnotation, ...current]);
      setDraftSelection(null);
      setComment("");
      setQuote("");
    } catch (annotationError) {
      setError(annotationError instanceof Error ? `Failed to save annotation: ${annotationError.message}` : "Failed to save annotation.");
    } finally {
      setSavingAnnotation(false);
    }
  }

  function handlePointerDown(
    event: React.PointerEvent<HTMLDivElement>,
    pageNumber: number,
  ) {
    const rect = event.currentTarget.getBoundingClientRect();
    setDraftSelection(null);
    setDragState({
      pageNumber,
      pageHeight: rect.height,
      pageWidth: rect.width,
      startX: event.clientX - rect.left,
      startY: event.clientY - rect.top,
      currentX: event.clientX - rect.left,
      currentY: event.clientY - rect.top,
    });
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragState) return;
    const rect = event.currentTarget.getBoundingClientRect();

    setDragState((current) =>
      current
        ? {
            ...current,
            currentX: event.clientX - rect.left,
            currentY: event.clientY - rect.top,
          }
        : null,
    );
  }

  function handlePointerUp() {
    if (!dragState) return;

    const rect = normalizeRect(dragState);
    setDragState(null);

    if (rect.width < 0.02 || rect.height < 0.02) {
      return;
    }

    setDraftSelection({
      pageNumber: dragState.pageNumber,
      rect,
    });
  }

  function renderAnnotationRect(rect: AnnotationRect) {
    return {
      left: `${rect.x * 100}%`,
      top: `${rect.y * 100}%`,
      width: `${rect.width * 100}%`,
      height: `${rect.height * 100}%`,
    };
  }

  return (
    <div className="grid h-full min-h-0 gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-h-0 overflow-auto bg-[#191c22] px-4 py-5">
        <div className="mx-auto w-full max-w-4xl space-y-5">
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75">
            <span>Draw a box anywhere on the PDF to create an annotation layer.</span>
            <Button
              type="button"
              size="sm"
              variant={fork ? "secondary" : "default"}
              className={fork ? "bg-white/10 text-white hover:bg-white/15" : ""}
              onClick={handleFork}
              disabled={creatingFork}
            >
              <BookmarkPlus className="h-4 w-4" />
              {creatingFork ? "Forking..." : fork ? "Forked" : "Fork Base PDF"}
            </Button>
          </div>

          <Document
            file={sourceUrl}
            loading={
              <div className="flex items-center justify-center rounded-[24px] border border-white/10 bg-white/5 px-6 py-16 text-white/70">
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                Loading PDF…
              </div>
            }
            onLoadSuccess={({ numPages: loadedPages }) => setNumPages(loadedPages)}
            onLoadError={(pdfError) => setError(`Failed to load PDF: ${pdfError.message}`)}
          >
            {Array.from({ length: numPages }, (_, index) => {
              const pageNumber = index + 1;
              const pageAnnotations = annotations.filter((annotation) => annotation.page_number === pageNumber);

              return (
                <div
                  key={pageNumber}
                  className="relative overflow-hidden rounded-[24px] border border-white/10 bg-white shadow-[0_24px_60px_rgba(0,0,0,0.24)]"
                >
                  <div
                    className="relative cursor-crosshair"
                    onPointerDown={(event) => handlePointerDown(event, pageNumber)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                  >
                    <Page
                      pageNumber={pageNumber}
                      width={960}
                      renderAnnotationLayer={false}
                      renderTextLayer={true}
                    />

                    <div className="pointer-events-none absolute inset-0">
                      {pageAnnotations.map((annotation) => (
                        <div
                          key={annotation.id}
                          className="absolute rounded-md border border-[#f59e0b] bg-[#f59e0b]/25 shadow-[0_0_0_1px_rgba(245,158,11,0.35)]"
                          style={renderAnnotationRect(annotation.bounding_rect)}
                          title={annotation.comment}
                        />
                      ))}

                      {dragState && dragState.pageNumber === pageNumber && liveRect ? (
                        <div
                          className="absolute rounded-md border border-sky-400 bg-sky-400/20"
                          style={renderAnnotationRect(liveRect)}
                        />
                      ) : null}

                      {draftSelection?.pageNumber === pageNumber ? (
                        <div
                          className="absolute rounded-md border-2 border-emerald-400 bg-emerald-400/20"
                          style={renderAnnotationRect(draftSelection.rect)}
                        />
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </Document>
        </div>
      </div>

      <div className="border-t border-white/10 bg-[#101319] px-4 py-5 text-white lg:border-l lg:border-t-0">
        <div className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">Layer Fork</p>
            <h3 className="mt-2 text-2xl text-white">Save Annotation</h3>
            <p className="mt-2 text-sm leading-6 text-white/65">
              Each highlight stores `pageNumber` and normalized `boundingRect` coordinates in Supabase. Your fork only
              stores the overlay, never a duplicated PDF file.
            </p>
          </div>

          {loading ? <p className="text-sm text-white/60">Checking your fork state…</p> : null}
          {error ? <p className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">{error}</p> : null}

          <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-sm text-white/80">
              <Highlighter className="h-4 w-4 text-emerald-300" />
              {draftSelection
                ? `Ready to annotate page ${draftSelection.pageNumber}`
                : "Draw a box on the PDF to start an annotation."}
            </div>

            <div className="mt-4 space-y-3">
              <Textarea
                rows={5}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="What should this highlight remember?"
                className="border-white/10 bg-[#0f1115] text-white placeholder:text-white/35"
              />
              <Textarea
                rows={3}
                value={quote}
                onChange={(event) => setQuote(event.target.value)}
                placeholder="Optional quoted text from the PDF"
                className="border-white/10 bg-[#0f1115] text-white placeholder:text-white/35"
              />
              <Button type="button" onClick={saveAnnotation} disabled={!draftSelection || !comment.trim() || savingAnnotation}>
                {savingAnnotation ? "Saving..." : "Save Annotation"}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-lg text-white">Saved Layers</h4>
            {annotations.length === 0 ? (
              <p className="text-sm text-white/60">No annotations yet on this fork.</p>
            ) : (
              annotations.map((annotation) => (
                <div key={annotation.id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-sm text-white">{annotation.comment}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-white/45">
                    Page {annotation.page_number} · {new Date(annotation.created_at).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
