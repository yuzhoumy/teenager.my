"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, LoaderCircle, ZoomIn, ZoomOut } from "lucide-react";
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
const minViewerZoom = 0.75;
const maxViewerZoom = 3;
const viewerZoomStep = 0.15;

function clampViewerZoom(value: number) {
  return Math.min(maxViewerZoom, Math.max(minViewerZoom, Number(value.toFixed(2))));
}

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
  const [renderedPageNumber, setRenderedPageNumber] = useState<number | null>(null);
  const [pageWidth, setPageWidth] = useState(0);
  const [pageAspectRatio, setPageAspectRatio] = useState(4 / 3);
  const [zoom, setZoom] = useState(1);
  const [devicePixelRatio, setDevicePixelRatio] = useState(1);
  const canvasSize = useRef({ width: 0, height: 0 });
  const canvasInstanceRef = useRef<FabricCanvas | null>(null);
  const pageWidthRef = useRef(0);
  const pageAspectRatioRef = useRef(4 / 3);
  const [pageMeasureElement, setPageMeasureElement] = useState<HTMLDivElement | null>(null);

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
    setDevicePixelRatio(window.devicePixelRatio || 1);
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
      const width = pageWrapper.offsetWidth;
      const height = pageWrapper.offsetHeight;
      if (width === 0 || height === 0) {
        return;
      }

      const widthRatio = width / (canvasSize.current.width || width);
      const heightRatio = height / (canvasSize.current.height || height);
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

      canvas.setWidth(width);
      canvas.setHeight(height);
      canvasSize.current = { width, height };
      canvas.renderAll();
    };

    const observer = new ResizeObserver(() => resize());
    observer.observe(pageWrapper);
    resize();

    return () => observer.disconnect();
  }, [pageNumber, renderedPageNumber, pageWrapperElement]);

  useEffect(() => {
    const pageMeasure = pageMeasureElement;
    if (!pageMeasure) {
      return;
    }

    const updatePageWidth = () => {
      const viewportWidth = document.documentElement.clientWidth || window.innerWidth || pageMeasure.offsetWidth;
      const nextWidth = Math.floor(Math.min(pageMeasure.offsetWidth, viewportWidth - 2));
      if (nextWidth > 0 && pageWidthRef.current !== nextWidth) {
        pageWidthRef.current = nextWidth;
        setPageWidth(nextWidth);
      }
    };

    const observer = new ResizeObserver(() => updatePageWidth());
    observer.observe(pageMeasure);
    updatePageWidth();

    return () => observer.disconnect();
  }, [pageMeasureElement]);

  useEffect(() => {
    const canvas = canvasInstanceRef.current;
    const pageWrapper = pageWrapperElement;
    if (!canvas || !pageWrapper || renderedPageNumber !== pageNumber) {
      return;
    }

    const width = pageWrapper.offsetWidth;
    const height = pageWrapper.offsetHeight;
    if (width === 0 || height === 0) {
      return;
    }

    canvas.setWidth(width);
    canvas.setHeight(height);
    canvasSize.current = { width, height };
    canvas.clear();
    const objects = annotationLayers?.[pageNumber] ?? [];
    if (objects.length === 0) {
      canvas.renderAll();
      return;
    }

    canvas.loadFromJSON({ objects }, () => {
      canvas.renderAll();
    });
  }, [annotationLayers, pageNumber, renderedPageNumber, pageWrapperElement, canvasElement, fabric]);

  function jumpToPage(nextPage: number) {
    if (numPages === 0) {
      return;
    }
    const targetPage = Math.min(numPages, Math.max(1, nextPage));
    setRenderedPageNumber(null);
    setPageNumber(targetPage);
    setPageInput(`${targetPage}`);
  }

  function changeZoom(delta: number) {
    setZoom((currentZoom) => clampViewerZoom(currentZoom + delta));
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

  const zoomedPageWidth = pageWidth > 0 ? Math.round(pageWidth * zoom) : 0;
  const zoomedPageHeight = pageWidth > 0 ? Math.round(pageWidth * pageAspectRatio * zoom) : undefined;
  const viewerPixelRatio = Math.min(3, Math.max(devicePixelRatio, 2));

  return (
    <div className="min-w-0 max-w-full overflow-hidden bg-[#09101b] p-0 sm:rounded-[28px] sm:border sm:border-white/10 sm:p-4">
      <div className="mb-2 flex min-w-0 max-w-full flex-col gap-3 sm:mb-4 lg:flex-row lg:items-center lg:justify-between">
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
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-9 w-9 p-0"
            onClick={() => changeZoom(-viewerZoomStep)}
            disabled={zoom <= minViewerZoom}
            aria-label="Zoom out"
            title="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="min-w-12 text-center">{Math.round(zoom * 100)}%</span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-9 w-9 p-0"
            onClick={() => changeZoom(viewerZoomStep)}
            disabled={zoom >= maxViewerZoom}
            aria-label="Zoom in"
            title="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
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

      <div ref={setPageMeasureElement} className="h-0 w-full min-w-0 max-w-full overflow-hidden" aria-hidden="true" />

      <div
        className="relative w-full min-w-0 max-w-full overflow-auto border border-[#172033] bg-[#0b1421] sm:rounded-[24px]"
        style={{ contain: "layout paint", maxHeight: "78vh" }}
      >
        {loadingFile ? (
          <div className="flex h-72 items-center justify-center text-white/60">
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            Loading PDF...
          </div>
        ) : resolvedFile && pageWidth > 0 ? (
          <div
            className="relative"
            style={{ width: zoomedPageWidth, height: zoomedPageHeight, minWidth: "100%" }}
          >
            <div
              ref={setPageWrapperElement}
              className="relative"
              style={{
                width: pageWidth,
                transform: `scale(${zoom})`,
                transformOrigin: "top left",
                willChange: "transform",
              }}
            >
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
                  width={pageWidth}
                  devicePixelRatio={viewerPixelRatio}
                  renderAnnotationLayer={false}
                  renderTextLayer
                  onLoadSuccess={(page) => {
                    const nextAspectRatio = page.originalHeight / page.originalWidth;
                    if (Number.isFinite(nextAspectRatio) && nextAspectRatio > 0 && pageAspectRatioRef.current !== nextAspectRatio) {
                      pageAspectRatioRef.current = nextAspectRatio;
                      setPageAspectRatio(nextAspectRatio);
                    }
                  }}
                  onRenderSuccess={() => setRenderedPageNumber(pageNumber)}
                />
              </Document>
              <canvas
                ref={setCanvasElement}
                className="absolute inset-0 pointer-events-none"
                style={{ touchAction: "none" }}
              />
            </div>
          </div>
        ) : resolvedFile ? (
          <div className="flex h-72 items-center justify-center text-white/60">
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            Preparing PDF...
          </div>
        ) : (
          <div className="flex h-72 items-center justify-center px-6 text-center text-sm text-white/60">
            Preview unavailable for this PDF.
          </div>
        )}
      </div>
    </div>
  );
}
