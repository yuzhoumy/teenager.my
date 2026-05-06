"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, LoaderCircle } from "lucide-react";
import { downloadAnnotatedPdf } from "@/lib/export-annotated-pdf";
import { Button } from "@/components/ui/button";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs`;

type AnnotationLayerMap = Record<number, unknown[]>;
type FabricObject = {
  scaleX: number;
  scaleY: number;
  left: number;
  top: number;
  setCoords: () => void;
};
type FabricCanvas = {
  lowerCanvasEl?: HTMLCanvasElement;
  clear: () => void;
  renderAll: () => void;
  loadFromJSON: (json: { objects: unknown[] }, callback: () => void) => void;
  getObjects: () => FabricObject[];
  setWidth: (width: number) => void;
  setHeight: (height: number) => void;
  dispose: () => void;
};
type FabricModule = {
  StaticCanvas?: new (element: HTMLCanvasElement, options?: { backgroundColor?: string }) => FabricCanvas;
  Canvas?: new (
    element: HTMLCanvasElement,
    options: { backgroundColor: string; isDrawingMode: boolean; selection: boolean }
  ) => FabricCanvas;
};

export function EmbeddedPdfViewer({
  file,
  annotationLayers,
  downloadFileName,
  enableAnnotatedDownload = false,
}: {
  file: string;
  annotationLayers?: AnnotationLayerMap | null;
  downloadFileName?: string;
  enableAnnotatedDownload?: boolean;
}) {
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [resolvedFile, setResolvedFile] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState(true);
  const [fabric, setFabric] = useState<FabricModule | null>(null);
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null);
  const [pageWrapperElement, setPageWrapperElement] = useState<HTMLDivElement | null>(null);
  const canvasSize = useRef({ width: 0, height: 0 });
  const canvasInstanceRef = useRef<FabricCanvas | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadFabric() {
      const fabricModule = (await import("fabric")) as { fabric?: FabricModule } & Partial<FabricModule>;
      if (cancelled) return;
      setFabric(fabricModule.fabric ?? (fabricModule as FabricModule));
    }

    void loadFabric();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    async function resolveFile() {
      setLoadingFile(true);
      setError("");
      setResolvedFile(null);

      try {
        if (!file) {
          throw new Error("Missing PDF file.");
        }

        if (file.startsWith("blob:") || file.startsWith("data:")) {
          if (!cancelled) {
            setResolvedFile(file);
          }
          return;
        }

        const response = await fetch(file);
        if (!response.ok) {
          throw new Error(`Failed to fetch PDF (${response.status}).`);
        }

        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);

        if (!cancelled) {
          setResolvedFile(objectUrl);
        }
      } catch {
        if (!cancelled) {
          setError("PDF preview is unavailable here. Open or download the file instead.");
        }
      } finally {
        if (!cancelled) {
          setLoadingFile(false);
        }
      }
    }

    void resolveFile();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [file]);

  useEffect(() => {
    if (!fabric || !canvasElement) {
      return;
    }

    const StaticCanvasClass = fabric.StaticCanvas;
    const CanvasClass = fabric.Canvas;
    if (!StaticCanvasClass && !CanvasClass) {
      return;
    }

    const instance = StaticCanvasClass
      ? new StaticCanvasClass(canvasElement, { backgroundColor: "transparent" })
      : new CanvasClass!(canvasElement, {
          backgroundColor: "transparent",
          isDrawingMode: false,
          selection: false,
        });
    const lowerCanvasElement = instance.lowerCanvasEl;

    if (lowerCanvasElement) {
      lowerCanvasElement.style.position = "absolute";
      lowerCanvasElement.style.inset = "0";
      lowerCanvasElement.style.width = "100%";
      lowerCanvasElement.style.height = "100%";
      lowerCanvasElement.style.background = "transparent";
      lowerCanvasElement.style.pointerEvents = "none";
      lowerCanvasElement.style.zIndex = "20";
    }

    canvasInstanceRef.current = instance;

    return () => {
      try {
        instance.dispose();
      } catch {
        // Fabric cleanup may race with DOM teardown.
      }
      canvasInstanceRef.current = null;
    };
  }, [canvasElement, fabric]);

  useEffect(() => {
    const canvas = canvasInstanceRef.current;
    const pageWrapper = pageWrapperElement;
    if (!canvas || !pageWrapper) {
      return;
    }

    const resize = () => {
      const rect = pageWrapper.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        return;
      }

      const widthRatio = rect.width / (canvasSize.current.width || rect.width);
      const heightRatio = rect.height / (canvasSize.current.height || rect.height);
      const scale = Math.min(widthRatio || 1, heightRatio || 1);
      if (canvasSize.current.width > 0 && scale !== 1) {
        canvas.getObjects().forEach((obj) => {
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
    observer.observe(pageWrapper);
    resize();

    return () => observer.disconnect();
  }, [pageNumber, pageWrapperElement]);

  useEffect(() => {
    const canvas = canvasInstanceRef.current;
    if (!canvas) {
      return;
    }

    canvas.clear();
    const objects = annotationLayers?.[pageNumber] ?? [];
    if (objects.length === 0) {
      canvas.renderAll();
      return;
    }

    canvas.loadFromJSON({ objects }, () => {
      canvas.renderAll();
    });
  }, [annotationLayers, pageNumber, canvasElement, fabric]);

  function jumpToPage(nextPage: number) {
    if (numPages === 0) {
      return;
    }
    const targetPage = Math.min(numPages, Math.max(1, nextPage));
    setPageNumber(targetPage);
    setPageInput(`${targetPage}`);
  }

  async function handleDownload() {
    setError("");
    setDownloading(true);

    try {
      await downloadAnnotatedPdf({
        file,
        annotationLayers,
        fileName: downloadFileName ?? "annotated-fork.pdf",
        preferredWidth: pageWrapperElement?.clientWidth ?? 900,
      });
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Unable to download the annotated PDF.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="rounded-[28px] border border-white/10 bg-[#09101b] p-4">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="ghost" className="h-9 w-9 p-0" onClick={() => jumpToPage(1)} disabled={pageNumber <= 1}>
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-9 w-9 p-0" onClick={() => jumpToPage(pageNumber - 1)} disabled={pageNumber <= 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-9 w-9 p-0" onClick={() => jumpToPage(pageNumber + 1)} disabled={numPages === 0 || pageNumber >= numPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-9 w-9 p-0" onClick={() => jumpToPage(numPages)} disabled={numPages === 0 || pageNumber >= numPages}>
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm text-text-muted">
          <span>{pageNumber} / {numPages || "—"}</span>
          <label htmlFor={`pdf-page-${file}`} className="text-sm text-text-muted">Page</label>
          <input
            id={`pdf-page-${file}`}
            type="number"
            min={1}
            max={numPages || 1}
            value={pageInput}
            onChange={(event) => setPageInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                const requested = Number(pageInput);
                if (Number.isInteger(requested)) {
                  jumpToPage(requested);
                }
              }
            }}
            className="w-24 rounded-2xl border border-border-strong bg-surface px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              const requested = Number(pageInput);
              if (Number.isInteger(requested)) {
                jumpToPage(requested);
              }
            }}
          >
            Go
          </Button>
          {enableAnnotatedDownload ? (
            <Button type="button" size="sm" variant="outline" onClick={() => void handleDownload()} disabled={downloading}>
              {downloading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download
            </Button>
          ) : null}
        </div>
      </div>

      {error ? <p className="mb-4 rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">{error}</p> : null}

      <div ref={setPageWrapperElement} className="relative overflow-hidden rounded-[24px] bg-[#0b1421]">
        {loadingFile ? (
          <div className="flex h-72 items-center justify-center text-white/60">
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            Loading PDF...
          </div>
        ) : resolvedFile ? (
          <Document
            file={resolvedFile}
            loading={
              <div className="flex h-72 items-center justify-center text-white/60">
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                Loading PDF...
              </div>
            }
            onLoadSuccess={({ numPages: pages }) => {
              setNumPages(pages);
              setPageNumber((currentPage) => {
                const nextPage = Math.min(Math.max(1, currentPage), pages);
                setPageInput(`${nextPage}`);
                return nextPage;
              });
            }}
            onLoadError={() => {
              setError("PDF preview is unavailable here. Open or download the file instead.");
            }}
          >
            <Page
              pageNumber={pageNumber}
              width={pageWrapperElement?.clientWidth ?? 760}
              renderAnnotationLayer={false}
              renderTextLayer
            />
          </Document>
        ) : (
          <div className="flex h-72 items-center justify-center px-6 text-center text-sm text-white/60">
            Preview unavailable for this PDF.
          </div>
        )}
        <canvas
          ref={setCanvasElement}
          className="absolute inset-0 pointer-events-none"
          style={{ touchAction: "none" }}
        />
      </div>
    </div>
  );
}
