"use client";

import { useEffect, useState, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import { BookmarkPlus, Eraser, LoaderCircle, PenTool, TextCursorInput } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { UserFork } from "@/types/resource";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs`;

type AnnotationLayerMap = Record<number, unknown[]>;

type Tool = "pan" | "pen" | "text";

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

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pageWrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasSize = useRef({ width: 0, height: 0 });
  const [activeSelection, setActiveSelection] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadFabric() {
      const module = await import("fabric");
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
          <p className="text-sm uppercase tracking-[0.18em] text-text-soft">PDF annotation workspace</p>
          <h2 className="mt-2 text-2xl text-foreground">Fork Editor</h2>
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
          <Button type="button" size="sm" variant="destructive" onClick={removeSelection} disabled={!activeSelection}>
            <Eraser className="mr-2 h-4 w-4" />
            Erase
          </Button>
          <Button type="button" size="sm" variant="default" onClick={handleSaveLayer} disabled={savingLayer || loadingFork}>
            <BookmarkPlus className="mr-2 h-4 w-4" />
            {savingLayer ? "Saving layer..." : "Save layer"}
          </Button>
        </div>
      </div>

      {error ? <p className="mb-4 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}

      <div className="space-y-6">
        <div className="rounded-[24px] border border-border bg-background p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Fork markdown</p>
              <p className="mt-2 text-sm text-text-muted">Edit your forked markdown and save it to your personal record.</p>
            </div>
            <Button type="button" variant="default" onClick={handleSaveMarkdown} disabled={savingMarkdown || loadingFork}>
              {savingMarkdown ? "Saving draft..." : "Save markdown"}
            </Button>
          </div>

          <Textarea
            className="mt-4 min-h-[240px] border border-border bg-[#0e1118] text-white"
            value={markdown}
            onChange={(event) => setMarkdown(event.target.value)}
            placeholder="Write your fork notes or edits in markdown..."
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-4">
          <div className="rounded-[24px] border border-border bg-background p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-text-soft">Page</p>
                <p className="mt-1 text-lg text-foreground">{pageNumber} / {numPages || "—"}</p>
              </div>
              <form className="flex items-center gap-2" onSubmit={handlePageSubmit}>
                <Input
                  value={pageInput}
                  onChange={(event) => setPageInput(event.target.value)}
                  type="number"
                  min={1}
                  max={numPages || 1}
                  aria-label="Jump to page"
                  className="w-24"
                  placeholder="Page"
                />
                <Button type="submit" size="sm">Go</Button>
              </form>
            </div>
          </div>

          <div className="overflow-hidden rounded-[32px] border border-border bg-[#111827] p-4">
            <div className="relative rounded-[24px] bg-[#0f172a]" ref={pageWrapperRef}>
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent to-black/10" />
              {sourceUrl ? (
                <>
                  <Document
                    file={sourceUrl}
                    loading={
                      <div className="flex h-72 items-center justify-center text-white/60">
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        Loading PDF…
                      </div>
                    }
                    onLoadSuccess={({ numPages: pages }) => {
                      setNumPages(pages);
                      setPageInput(String(pageNumber));
                    }}
                    onLoadError={(pdfError) => setError(`Failed to load PDF: ${pdfError.message}`)}
                  >
                    <Page
                      pageNumber={pageNumber}
                      width={pageWrapperRef.current?.clientWidth ?? 800}
                      renderAnnotationLayer={false}
                      renderTextLayer={true}
                    />
                  </Document>
                  <canvas
                    ref={canvasRef}
                    className="pointer-events-none absolute inset-0"
                    style={{ touchAction: "none" }}
                  />
                </>
              ) : (
                <div className="flex min-h-[260px] items-center justify-center px-4 py-6 text-sm text-text-muted">
                  No PDF attachment is available for this resource.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[24px] border border-border bg-background p-4">
            <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Fork status</p>
            <div className="mt-3 text-sm text-text-muted">
              {loadingFork
                ? "Checking fork status…"
                : fork
                ? "Fork draft loaded. All edits will be saved to your personal fork record."
                : "No fork yet. Save markdown or layer content to create your personal fork."}
            </div>
          </div>

          <div className="rounded-[24px] border border-border bg-background p-4">
            <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Layer persistence</p>
            <p className="mt-2 text-sm text-text-muted">
              Each page’s annotation layer is stored as JSON per page in your fork record. Use the toolbar to save the current page layer.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
