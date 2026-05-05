"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import { BookmarkPlus, Eraser, LoaderCircle, PenTool, TextCursorInput } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { UserFork } from "@/types/resource";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownRenderer } from "@/components/resources/markdown-renderer";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs`;

type AnnotationLayerMap = Record<number, unknown[]>;

type Tool = "pan" | "pen" | "text";

type ForkSummary = {
  id: string;
  created_at: string;
};

function isPdfLink(url: string) {
  return /\.pdf($|[?#])/i.test(url);
}

async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export function PdfForkEditor({
  materialId,
  sourceUrl,
  initialMarkdown,
}: {
  materialId: string;
  sourceUrl: string;
  initialMarkdown: string;
}) {
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [fork, setFork] = useState<UserFork | null>(null);
  const [annotationLayers, setAnnotationLayers] = useState<AnnotationLayerMap>({});
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const [error, setError] = useState("");
  const [loadingFork, setLoadingFork] = useState(true);
  const [savingMarkdown, setSavingMarkdown] = useState(false);
  const [savingLayer, setSavingLayer] = useState(false);
  const [tool, setTool] = useState<Tool>("pan");
  const [fabric, setFabric] = useState<any>(null);
  const [canvas, setCanvas] = useState<any>(null);
  const [showEditor, setShowEditor] = useState(false);
  const pdfLinks = useMemo(() => {
    const pattern = /\[([^\]]+)\]\(([^)]+)\)/g;
    const found: string[] = [];
    for (const match of markdown.matchAll(pattern)) {
      const href = match[2]?.trim() ?? "";
      if (isPdfLink(href)) {
        found.push(href);
      }
    }
    return found;
  }, [markdown]);
  const [otherForks, setOtherForks] = useState<ForkSummary[] | null>(null);
  const [loadingOtherForks, setLoadingOtherForks] = useState(true);
  const [otherForksError, setOtherForksError] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pageWrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasSize = useRef({ width: 0, height: 0 });
  const [activeSelection, setActiveSelection] = useState(false);

  async function loadOtherForks(userId: string | null) {
    setLoadingOtherForks(true);
    setOtherForksError("");

    try {
      const params = new URLSearchParams({ materialId, sourceUrl });
      if (userId) {
        params.set("excludeUserId", userId);
      }

      const response = await fetch(`/api/forks/other?${params.toString()}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Unable to load other forks.");
      }

      const payload = (await response.json()) as ForkSummary[];
      setOtherForks(payload);
    } catch (loadError) {
      setOtherForks([]);
      setOtherForksError(loadError instanceof Error ? loadError.message : "Unable to load other forks.");
    } finally {
      setLoadingOtherForks(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      if (!isSupabaseConfigured) {
        if (!cancelled) {
          setCurrentUserId(null);
          setOtherForks([]);
          setLoadingOtherForks(false);
        }
        return;
      }

      try {
        const user = await getCurrentUser();
        if (cancelled) return;

        setCurrentUserId(user?.id ?? null);
        await loadOtherForks(user?.id ?? null);
      } catch (loadError) {
        if (!cancelled) {
          setCurrentUserId(null);
          setOtherForks([]);
          setOtherForksError(loadError instanceof Error ? loadError.message : "Unable to load other forks.");
          setLoadingOtherForks(false);
        }
      }
    }

    void loadUser();

    return () => {
      cancelled = true;
    };
  }, [materialId, sourceUrl]);

  useEffect(() => {
    let cancelled = false;

    async function loadFabric() {
      const module = (await import("fabric")) as any;
      if (cancelled) return;
      const loadedFabric = module.fabric ?? module;
      setFabric(loadedFabric);
    }

    void loadFabric();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!fabric || !canvasRef.current) {
      return;
    }

    const instance = new fabric.Canvas(canvasRef.current, {
      backgroundColor: "transparent",
      isDrawingMode: false,
      selection: true,
    });

    instance.freeDrawingBrush.width = 3;
    instance.freeDrawingBrush.color = "#f59e0b";
    instance.freeDrawingBrush.shadow = new fabric.Shadow({ color: "rgba(245,158,11,0.25)", blur: 8, offsetX: 0, offsetY: 0 });

    instance.on("selection:created", () => setActiveSelection(true));
    instance.on("selection:updated", () => setActiveSelection(true));
    instance.on("selection:cleared", () => setActiveSelection(false));

    setCanvas(instance);

    return () => {
      try {
        instance.dispose();
      } catch {
        // Fabric may already have detached DOM nodes during React unmount.
      }
      setCanvas(null);
    };
  }, [fabric]);

  useEffect(() => {
    let cancelled = false;

    async function loadFork() {
      if (!isSupabaseConfigured) {
        setLoadingFork(false);
        return;
      }

      try {
        const user = await getCurrentUser();
        if (!user) {
          setFork(null);
          setLoadingFork(false);
          return;
        }

        const { data, error: queryError } = await supabase
          .from("user_forks")
          .select("*")
          .eq("user_id", user.id)
          .eq("material_id", materialId)
          .eq("source_url", sourceUrl)
          .maybeSingle();

        if (queryError) {
          throw queryError;
        }

        if (data && !cancelled) {
          const typedFork = data as UserFork & { annotation_layers: AnnotationLayerMap | null; markdown_content: string };
          setFork(typedFork);
          setMarkdown(typedFork.markdown_content || initialMarkdown);
          setAnnotationLayers(typedFork.annotation_layers ?? {});
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load fork data.");
        }
      } finally {
        if (!cancelled) {
          setLoadingFork(false);
        }
      }
    }

    void loadFork();

    return () => {
      cancelled = true;
    };
  }, [materialId, sourceUrl, initialMarkdown]);

  useEffect(() => {
    if (!fabric || !canvasRef.current) {
      return;
    }

    const instance = new fabric.Canvas(canvasRef.current, {
      backgroundColor: "transparent",
      isDrawingMode: false,
      selection: true,
    });

    instance.freeDrawingBrush.width = 3;
    instance.freeDrawingBrush.color = "#f59e0b";
    instance.freeDrawingBrush.shadow = new fabric.Shadow({ color: "rgba(245,158,11,0.25)", blur: 8, offsetX: 0, offsetY: 0 });

    instance.on("selection:created", () => setActiveSelection(true));
    instance.on("selection:updated", () => setActiveSelection(true));
    instance.on("selection:cleared", () => setActiveSelection(false));

    setCanvas(instance);

    return () => {
      try {
        instance.dispose();
      } catch {
        // Fabric may already have detached DOM nodes during React unmount.
      }
      setCanvas(null);
    };
  }, [fabric]);

  useEffect(() => {
    const resize = () => {
      const pageWrapper = pageWrapperRef.current;
      if (!pageWrapper || !canvas) return;

      const rect = pageWrapper.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        return;
      }

      const widthRatio = rect.width / (canvasSize.current.width || rect.width);
      const heightRatio = rect.height / (canvasSize.current.height || rect.height);
      const scale = Math.min(widthRatio || 1, heightRatio || 1);
      if (canvasSize.current.width > 0 && scale !== 1) {
        canvas.getObjects().forEach((obj: any) => {
          obj.scaleX *= scale;
          obj.scaleY *= scale;
          obj.left *= scale;
          obj.top *= scale;
          obj.setCoords();
        });
      }

      canvas.setWidth(rect.width);
      canvas.setHeight(rect.height);
      canvasSize.current = { width: rect.width, height: rect.height };
      canvas.renderAll();
    };

    const observer = new ResizeObserver(() => resize());
    if (pageWrapperRef.current) {
      observer.observe(pageWrapperRef.current);
      resize();
    }

    return () => observer.disconnect();
  }, [pageNumber, canvas]);

  const loadPageLayer = async (pageIndex: number) => {
    if (!canvas) return;

    canvas.clear();
    const objects = annotationLayers[pageIndex] ?? [];
    if (objects.length === 0) {
      canvas.renderAll();
      return;
    }

    canvas.loadFromJSON({ objects }, () => {
      canvas.renderAll();
    });
  };

  useEffect(() => {
    void loadPageLayer(pageNumber);
  }, [pageNumber, annotationLayers, canvas]);

  const handleCreateFork = async () => {
    setShowEditor(true);
    setError("");

    try {
      await ensureFork();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to start your fork.");
    }
  };

  const ensureFork = async () => {
    if (!isSupabaseConfigured) {
      throw new Error("Supabase is not configured.");
    }

    const user = await getCurrentUser();
    if (!user) {
      throw new Error("Please log in to create a fork.");
    }

    if (fork) {
      return fork;
    }

    setLoadingFork(true);
    setError("");

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
        const typedFork = existingFork as UserFork & { annotation_layers: AnnotationLayerMap | null; markdown_content: string };
        setFork(typedFork);
        setMarkdown(typedFork.markdown_content || initialMarkdown);
        setAnnotationLayers(typedFork.annotation_layers ?? {});
        return typedFork;
      }

      const payload = {
        user_id: user.id,
        material_id: materialId,
        source_url: sourceUrl,
        markdown_content: markdown,
        annotation_layers: {},
      };

      const { data: createdFork, error: insertError } = await supabase
        .from("user_forks")
        .insert(payload as never)
        .select("*")
        .single();

      if (insertError) {
        throw insertError;
      }

      const typedFork = createdFork as UserFork & { annotation_layers: AnnotationLayerMap | null; markdown_content: string };
      setFork(typedFork);
      setAnnotationLayers(typedFork.annotation_layers ?? {});
      return typedFork;
    } finally {
      setLoadingFork(false);
    }
  };

  const handleSaveMarkdown = async () => {
    setError("");
    setSavingMarkdown(true);

    try {
      const activeFork = await ensureFork();
      const payload = {
        markdown_content: markdown,
      };

      const { data: updatedFork, error: updateError } = await supabase
        .from("user_forks")
        .update(payload as never)
        .eq("id", activeFork.id)
        .select("*")
        .single();

      if (updateError) {
        throw updateError;
      }

      setFork(updatedFork as UserFork & { annotation_layers: AnnotationLayerMap | null; markdown_content: string });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save fork markdown.");
    } finally {
      setSavingMarkdown(false);
    }
  };

  const renderPdfLink = (href: string, label: string, index: number) => {
    if (!showEditor) {
      return (
        <a
          key={`pdf-link-${index}`}
          href={href}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-brand underline decoration-brand/35 underline-offset-4 hover:text-brand-soft"
        >
          {label}
        </a>
      );
    }

    return (
      <div key={`pdf-editor-${index}`} className="mb-6 rounded-[28px] border border-border bg-[#08131f] p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">{label}</p>
            <p className="text-sm text-text-muted">PDF attachment rendered inline where this link appears.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant={tool === "pan" ? "secondary" : "default"} onClick={() => setTool("pan")}>Pan</Button>
            <Button type="button" size="sm" variant={tool === "pen" ? "secondary" : "default"} onClick={() => setTool("pen")}> 
              <PenTool className="mr-2 h-4 w-4" />
              Pen
            </Button>
            <Button type="button" size="sm" variant="default" onClick={() => { setTool("text"); insertText(); }}>
              <TextCursorInput className="mr-2 h-4 w-4" />
              Text
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={removeSelection} disabled={!activeSelection}>
              <Eraser className="mr-2 h-4 w-4" />
              Erase
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={handleSaveLayer} disabled={savingLayer || loadingFork}>
              <BookmarkPlus className="mr-2 h-4 w-4" />
              Save layer
            </Button>
            <Button type="button" size="icon" variant="ghost" onClick={() => setPageNumber(Math.max(1, pageNumber - 1))} disabled={pageNumber === 1}>
              ←
            </Button>
            <span className="text-sm text-text-muted">{pageNumber} / {numPages || "—"}</span>
            <Button type="button" size="icon" variant="ghost" onClick={() => setPageNumber(Math.min(numPages, pageNumber + 1))} disabled={pageNumber === numPages}>
              →
            </Button>
          </div>
        </div>

        <div className="relative rounded-[28px] border border-white/10 bg-[#09101b] p-4">
          <div ref={pageWrapperRef} className="relative rounded-[24px] overflow-hidden bg-[#0b1421]">
            <Document
              file={href}
              loading={
                <div className="flex h-72 items-center justify-center text-white/60">
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  Loading PDF…
                </div>
              }
              onLoadSuccess={({ numPages: pages }) => {
                setNumPages(pages);
              }}
              onLoadError={(pdfError) => {
                const message = `Failed to load PDF: ${pdfError.message}`;
                setError(message);
              }}
            >
              <Page
                pageNumber={pageNumber}
                width={pageWrapperRef.current?.clientWidth ?? 760}
                renderAnnotationLayer={false}
                renderTextLayer={true}
              />
            </Document>
            <canvas
              ref={canvasRef}
              className="pointer-events-none absolute inset-0"
              style={{ touchAction: "none" }}
            />
          </div>
        </div>
      </div>
    );
  };

  const handleSaveLayer = async () => {
    setError("");
    setSavingLayer(true);

    try {
      const activeFork = await ensureFork();
      if (!canvas) {
        throw new Error("Canvas is not ready.");
      }

      const json = canvas.toJSON();
      const objects = Array.isArray(json.objects) ? json.objects : [];
      const updatedLayers = { ...annotationLayers, [pageNumber]: objects };

      const { error: updateError } = await supabase
        .from("user_forks")
        .update({ annotation_layers: updatedLayers } as never)
        .eq("id", activeFork.id);

      if (updateError) {
        throw updateError;
      }

      setAnnotationLayers(updatedLayers);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save annotation layer.");
    } finally {
      setSavingLayer(false);
    }
  };

  const insertText = () => {
    if (!fabric || !canvas) return;

    const width = canvas.getWidth();
    const height = canvas.getHeight();
    const text = new fabric.IText("New note", {
      left: width / 2 - 80,
      top: height / 2 - 20,
      fill: "#111827",
      fontSize: 22,
      backgroundColor: "rgba(255,255,255,0.85)",
      padding: 8,
      editable: true,
    });

    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
  };

  const removeSelection = () => {
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (active) {
      canvas.remove(active);
      canvas.discardActiveObject();
      canvas.renderAll();
      setActiveSelection(false);
    }
  };

  const handlePageSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const requested = Number(pageInput);
    if (!Number.isInteger(requested) || requested < 1 || requested > numPages) {
      return;
    }
    setPageNumber(requested);
  };

  return (
    <div className="rounded-[32px] border border-border bg-surface p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Fork workspace</p>
          <h2 className="mt-2 text-2xl text-foreground">Live markdown fork editor</h2>
        </div>
        <Button type="button" size="sm" variant="default" onClick={handleCreateFork} disabled={loadingFork || savingMarkdown}>
          {showEditor ? "Open fork editor" : "Create new fork"}
        </Button>
      </div>

      {error ? <p className="mb-4 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}

      <div className="grid gap-6 lg:grid-cols-[2.2fr_0.8fr]">
        <main className="space-y-6">
          <div className="rounded-[32px] border border-border bg-background p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Preview</p>
                <p className="mt-1 text-sm text-text-muted">Rendered markdown updates instantly with inline PDF editing where PDF links appear.</p>
              </div>
              <span className="rounded-full bg-surface-strong px-3 py-1 text-xs font-semibold text-text-muted">
                {pdfLinks.length} PDF link{pdfLinks.length === 1 ? "" : "s"}
              </span>
            </div>
            <MarkdownRenderer markdown={markdown} renderPdfLink={renderPdfLink} />
          </div>

          {!showEditor ? (
            <div className="rounded-[24px] border border-border bg-background p-4">
              <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Start editing</p>
              <p className="mt-2 text-sm text-text-muted">Click “Create new fork” to enable inline PDF editing inside the markdown preview.</p>
            </div>
          ) : null}
        </main>

        <aside className="space-y-6">
          <div className="rounded-[24px] border border-border bg-background p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Markdown source</p>
                <p className="mt-2 text-sm text-text-muted">Edit markdown and save your fork in one place.</p>
              </div>
              <Button type="button" variant="default" onClick={handleSaveMarkdown} disabled={savingMarkdown || loadingFork}>
                {savingMarkdown ? "Saving draft..." : "Save markdown"}
              </Button>
            </div>
            <Textarea
              className="mt-4 min-h-[320px] border border-border bg-[#0e1118] text-white"
              value={markdown}
              onChange={(event) => setMarkdown(event.target.value)}
              placeholder="Write your fork notes or edits in markdown..."
            />
          </div>

          <div className="rounded-[24px] border border-border bg-background p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Other people’s forks</p>
                <p className="mt-2 text-sm text-text-muted">See forks from other learners below.</p>
              </div>
              <span className="rounded-full bg-surface-strong px-3 py-1 text-xs font-semibold text-text-muted">
                {loadingOtherForks ? "…" : `${otherForks?.length ?? 0} forks`}
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {loadingOtherForks ? (
                <p className="text-sm text-text-muted">Loading other forks…</p>
              ) : otherForksError ? (
                <p className="text-sm text-rose-200">{otherForksError}</p>
              ) : otherForks && otherForks.length > 0 ? (
                otherForks.map((otherFork) => (
                  <div key={otherFork.id} className="rounded-2xl border border-border px-4 py-3 bg-surface-strong">
                    <p className="text-sm font-semibold text-foreground">Fork by another student</p>
                    <p className="mt-1 text-sm text-text-muted">Created on {new Date(otherFork.created_at).toLocaleDateString()}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-text-muted">No other forks have been created for this resource yet.</p>
              )}
            </div>
          </div>

          <div className="rounded-[24px] border border-border bg-background p-4">
            <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Fork status</p>
            <p className="mt-3 text-sm text-text-muted">
              {loadingFork
                ? "Checking fork status…"
                : fork
                ? "Fork draft loaded. Your markdown and PDF annotations will be stored in your fork."
                : "No fork yet. Create a new fork to save edits and annotations."
              }
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
