"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type TouchEvent } from "react";
import { useRouter } from "next/navigation";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import { Eraser, Highlighter, LoaderCircle, MousePointer2, PenTool, Star, TextCursorInput, Upload, X, ZoomIn, ZoomOut } from "lucide-react";
import { getSupabaseUser, isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";
import type { ForkCardData, ForkStar, UserFork } from "@/types/resource";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownRenderer } from "@/components/resources/markdown-renderer";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs`;

type AnnotationLayerMap = Record<number, unknown[]>;
type Tool = "pan" | "pen" | "highlight" | "text";
type EditorMode = "edit" | "raw";
type CommunitySort = "latest" | "highest-star";
type PdfPreviewState =
  | { status: "loading" }
  | { status: "ready"; url: string }
  | { status: "error"; message: string };
const minPdfZoom = 0.75;
const maxPdfZoom = 2.5;
const pdfZoomStep = 0.15;
type FabricObject = {
  scaleX: number;
  scaleY: number;
  left: number;
  top: number;
  selectable?: boolean;
  evented?: boolean;
  setCoords: () => void;
};
type FabricCanvas = {
  backgroundColor: string;
  isDrawingMode: boolean;
  selection: boolean;
  wrapperEl?: HTMLDivElement;
  lowerCanvasEl?: HTMLCanvasElement;
  upperCanvasEl?: HTMLCanvasElement;
  freeDrawingBrush: {
    width: number;
    color: string;
    shadow: unknown;
  };
  on: (eventName: string, callback: () => void) => void;
  off: (eventName: string, callback: (event: FabricMouseEvent) => void) => void;
  dispose: () => void;
  clear: () => void;
  renderAll: () => void;
  loadFromJSON: (json: { objects: unknown[] }, callback: () => void) => void;
  toJSON: () => { objects?: unknown[] };
  getObjects: () => FabricObject[];
  setWidth: (width: number) => void;
  setHeight: (height: number) => void;
  getWidth: () => number;
  getHeight: () => number;
  add: (object: FabricObject) => void;
  setActiveObject: (object: FabricObject) => void;
  getActiveObject: () => FabricObject | null;
  getActiveObjects: () => FabricObject[];
  remove: (object: FabricObject) => void;
  discardActiveObject: () => void;
  forEachObject: (callback: (object: FabricObject) => void) => void;
  getPointer: (event: Event) => { x: number; y: number };
};
type FabricMouseEvent = {
  e: Event;
  target?: FabricObject | null;
};
type FabricModule = {
  Canvas: new (
    element: HTMLCanvasElement,
    options: { backgroundColor: string; isDrawingMode: boolean; selection: boolean }
  ) => FabricCanvas;
  IText: new (
    text: string,
    options: {
      left: number;
      top: number;
      fill: string;
      fontSize: number;
      backgroundColor: string;
      padding: number;
      editable: boolean;
    }
  ) => FabricObject;
  Shadow: new (options: { color: string; blur: number; offsetX: number; offsetY: number }) => unknown;
};

type ForkSummary = {
  id: string;
  user_id: string;
  material_id: string;
  source_url: string;
  description: string | null;
  markdown_content: string;
  annotation_layers: Record<number, unknown[]> | null;
  is_pinned: boolean;
  pinned_title: string | null;
  pinned_order: number;
  created_at: string;
};

const bucketName = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "resource-attachments";
const annotationColors = ["#111827", "#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#8b5cf6"] as const;

function hexToRgba(hex: string, alpha: number) {
  const normalizedHex = hex.replace("#", "");
  const red = Number.parseInt(normalizedHex.slice(0, 2), 16);
  const green = Number.parseInt(normalizedHex.slice(2, 4), 16);
  const blue = Number.parseInt(normalizedHex.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function clampPdfZoom(value: number) {
  return Math.min(maxPdfZoom, Math.max(minPdfZoom, Number(value.toFixed(2))));
}

function getTouchDistance(touches: { item: (index: number) => { clientX: number; clientY: number } | null }) {
  const firstTouch = touches.item(0);
  const secondTouch = touches.item(1);

  if (!firstTouch || !secondTouch) {
    return 0;
  }

  return Math.hypot(firstTouch.clientX - secondTouch.clientX, firstTouch.clientY - secondTouch.clientY);
}

function isPdfLink(url: string) {
  return /\.pdf($|[?#])/i.test(url);
}

async function blobLooksLikePdf(blob: Blob) {
  const header = await blob.slice(0, 1024).text();
  return header.includes("%PDF-");
}

function isImageLink(url: string) {
  return /\.(png|jpe?g|gif|webp|svg|avif)($|[?#])/i.test(url);
}

async function uploadForkAttachment(file: File, userId: string) {
  const safeFileName = file.name.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9_.-]/g, "");
  const filePath = `forks/${userId}/${Date.now()}-${safeFileName}`;
  const { error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(filePath, file, { cacheControl: "3600", upsert: false });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);
  return data.publicUrl;
}

function removePdfLinkByIndex(content: string, targetIndex: number) {
  const pattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let pdfIndex = 0;

  for (const match of content.matchAll(pattern)) {
    const href = match[2]?.trim() ?? "";
    if (!isPdfLink(href)) {
      continue;
    }

    if (pdfIndex === targetIndex) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      return `${content.slice(0, start)}${content.slice(end)}`
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    }

    pdfIndex += 1;
  }

  return content;
}

function removeImageLinkByIndex(content: string, targetIndex: number) {
  const pattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let imageIndex = 0;

  for (const match of content.matchAll(pattern)) {
    const href = match[2]?.trim() ?? "";
    if (!isImageLink(href)) {
      continue;
    }

    if (imageIndex === targetIndex) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      return `${content.slice(0, start)}${content.slice(end)}`
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    }

    imageIndex += 1;
  }

  return content;
}

export function PdfForkEditor({
  materialId,
  materialSlug,
  sourceUrl,
  initialMarkdown,
}: {
  materialId: string;
  materialSlug: string;
  sourceUrl: string;
  initialMarkdown: string;
}) {
  const router = useRouter();
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [fork, setFork] = useState<UserFork | null>(null);
  const [annotationLayers, setAnnotationLayers] = useState<AnnotationLayerMap>({});
  const [forkTitle, setForkTitle] = useState("");
  const [forkDescription, setForkDescription] = useState("");
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const [error, setError] = useState("");
  const [loadingFork, setLoadingFork] = useState(true);
  const [savingMarkdown, setSavingMarkdown] = useState(false);
  const [savingLayer, setSavingLayer] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [tool, setTool] = useState<Tool>("pan");
  const [annotationColor, setAnnotationColor] = useState<(typeof annotationColors)[number]>("#f59e0b");
  const [pdfZoom, setPdfZoom] = useState(1);
  const [pdfStageSize, setPdfStageSize] = useState({ width: 0, height: 0 });
  const [editorMode, setEditorMode] = useState<EditorMode>("edit");
  const [fabric, setFabric] = useState<FabricModule | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [forkCards, setForkCards] = useState<ForkCardData[]>([]);
  const [loadingForkCards, setLoadingForkCards] = useState(true);
  const [forkCardsError, setForkCardsError] = useState("");
  const [activeSelection, setActiveSelection] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [communitySort, setCommunitySort] = useState<CommunitySort>("latest");
  const [forkActionError, setForkActionError] = useState("");
  const [pdfPreviews, setPdfPreviews] = useState<Record<string, PdfPreviewState>>({});
  const loadingOtherForks = loadingForkCards;
  const otherForksError = forkCardsError;
  const otherForks = forkCards;

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
  const imageLinks = useMemo(() => {
    const pattern = /\[([^\]]+)\]\(([^)]+)\)/g;
    const found: string[] = [];
    for (const match of markdown.matchAll(pattern)) {
      const href = match[2]?.trim() ?? "";
      if (isImageLink(href)) {
        found.push(href);
      }
    }
    return found;
  }, [markdown]);

  const canvasInstanceRef = useRef<FabricCanvas | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasSize = useRef({ width: 0, height: 0 });
  const toolRef = useRef<Tool>("pan");
  const annotationColorRef = useRef<(typeof annotationColors)[number]>("#f59e0b");
  const annotationLayersRef = useRef<AnnotationLayerMap>({});
  const forkRef = useRef<UserFork | null>(null);
  const pageNumberRef = useRef(1);
  const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoringCanvasRef = useRef(false);
  const pinchDistanceRef = useRef(0);
  const pinchZoomRef = useRef(1);
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null);
  const [canvasHostElement, setCanvasHostElement] = useState<HTMLDivElement | null>(null);
  const [pageWrapperElement, setPageWrapperElement] = useState<HTMLDivElement | null>(null);
  const [pdfStageElement, setPdfStageElement] = useState<HTMLDivElement | null>(null);

  const myForks = useMemo(
    () => forkCards.filter((forkCard) => currentUserId && forkCard.user_id === currentUserId),
    [currentUserId, forkCards],
  );
  const communityForks = useMemo(() => {
    const sourceForks = forkCards.filter((forkCard) => !currentUserId || forkCard.user_id !== currentUserId);
    const sortedForks = [...sourceForks];

    if (communitySort === "highest-star") {
      sortedForks.sort((left, right) => {
        if (right.star_count !== left.star_count) {
          return right.star_count - left.star_count;
        }

        return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
      });
      return sortedForks;
    }

    sortedForks.sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
    return sortedForks;
  }, [communitySort, currentUserId, forkCards]);

  useEffect(() => {
    let cancelled = false;
    const objectUrls: string[] = [];
    const uniquePdfLinks = Array.from(new Set(pdfLinks));

    if (uniquePdfLinks.length === 0) {
      setPdfPreviews({});
      return;
    }

    setPdfPreviews(
      Object.fromEntries(uniquePdfLinks.map((href) => [href, { status: "loading" } satisfies PdfPreviewState])),
    );

    async function resolvePdfLinks() {
      const entries = await Promise.all(
        uniquePdfLinks.map(async (href): Promise<[string, PdfPreviewState]> => {
          try {
            if (!href) {
              throw new Error("Missing PDF URL.");
            }

            if (href.startsWith("blob:") || href.startsWith("data:")) {
              return [href, { status: "ready", url: href }];
            }

            const response = await fetch(href);
            if (!response.ok) {
              throw new Error(`Failed to fetch PDF (${response.status}).`);
            }

            const blob = await response.blob();
            if (blob.size === 0) {
              throw new Error("PDF file is empty.");
            }
            if (!(await blobLooksLikePdf(blob))) {
              throw new Error("Linked file is not a readable PDF.");
            }

            const objectUrl = URL.createObjectURL(blob);
            objectUrls.push(objectUrl);
            return [href, { status: "ready", url: objectUrl }];
          } catch {
            return [
              href,
              {
                status: "error",
                message: "PDF preview is unavailable. The file may have been moved, deleted, or blocked by the host.",
              },
            ];
          }
        }),
      );

      if (!cancelled) {
        setPdfPreviews(Object.fromEntries(entries));
      }
    }

    void resolvePdfLinks();

    return () => {
      cancelled = true;
      objectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
    };
  }, [pdfLinks]);

  const loadForkCards = useCallback(async (userId: string | null) => {
    setLoadingForkCards(true);
    setForkCardsError("");

    try {
      const { data: forksData, error: forksError } = await supabase
        .from("user_forks")
        .select("*")
        .eq("material_id", materialId)
        .order("created_at", { ascending: false });

      if (forksError) {
        throw forksError;
      }

      const forks = (forksData ?? []) as ForkSummary[];
      if (forks.length === 0) {
        setForkCards([]);
        return;
      }

      const userIds = Array.from(new Set(forks.map((forkEntry) => forkEntry.user_id)));
      const forkIds = forks.map((forkEntry) => forkEntry.id);

      const [{ data: profilesData, error: profilesError }, { data: starsData, error: starsError }] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name").in("user_id", userIds),
        supabase.from("fork_stars").select("*").in("fork_id", forkIds),
      ]);

      if (profilesError) {
        throw profilesError;
      }

      if (starsError) {
        throw starsError;
      }

      const profileRows = (profilesData ?? []) as Array<{ user_id: string; display_name: string }>;
      const profilesByUserId = new Map(
        profileRows.map((profile) => [profile.user_id, profile.display_name]),
      );
      const stars = (starsData ?? []) as ForkStar[];

      setForkCards(
        forks.map((forkEntry) => ({
          ...forkEntry,
          author_name: profilesByUserId.get(forkEntry.user_id) ?? "Anonymous student",
          star_count: stars.filter((star) => star.fork_id === forkEntry.id).length,
          has_starred: Boolean(userId && stars.some((star) => star.fork_id === forkEntry.id && star.user_id === userId)),
        })),
      );
    } catch (loadError) {
      setForkCards([]);
      setForkCardsError(loadError instanceof Error ? loadError.message : "Unable to load forks.");
    } finally {
      setLoadingForkCards(false);
    }
  }, [materialId]);

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      if (!isSupabaseConfigured) {
        if (!cancelled) {
          setForkCards([]);
          setLoadingForkCards(false);
        }
        return;
      }

      try {
        const user = await getSupabaseUser();
        if (cancelled) return;
        setCurrentUserId(user?.id ?? null);
        await loadForkCards(user?.id ?? null);
      } catch (loadError) {
        if (!cancelled) {
          setCurrentUserId(null);
          setForkCards([]);
          setForkCardsError(loadError instanceof Error ? loadError.message : "Unable to load forks.");
          setLoadingForkCards(false);
        }
      }
    }

    void loadUser();

    return () => {
      cancelled = true;
    };
  }, [loadForkCards]);

  useEffect(() => {
    let cancelled = false;

    async function loadFabric() {
      const fabricModule = (await import("fabric")) as { fabric?: FabricModule } & Partial<FabricModule>;
      if (cancelled) return;
      const loadedFabric = fabricModule.fabric ?? (fabricModule as FabricModule);
      setFabric(loadedFabric);
    }

    void loadFabric();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadFork() {
      if (!isSupabaseConfigured) {
        setLoadingFork(false);
        return;
      }

      try {
        const user = await getSupabaseUser();
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
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (queryError) {
          throw queryError;
        }

        if (data && !cancelled) {
          const typedFork = data as UserFork & { annotation_layers: AnnotationLayerMap | null; markdown_content: string };
          setFork(typedFork);
          setForkTitle(typedFork.pinned_title ?? "");
          setForkDescription(typedFork.description ?? "");
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
    toolRef.current = tool;
  }, [tool]);

  useEffect(() => {
    annotationColorRef.current = annotationColor;
  }, [annotationColor]);

  useEffect(() => {
    annotationLayersRef.current = annotationLayers;
  }, [annotationLayers]);

  useEffect(() => {
    forkRef.current = fork;
  }, [fork]);

  useEffect(() => {
    pageNumberRef.current = pageNumber;
  }, [pageNumber]);

  useEffect(() => {
    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, []);

  const scheduleAnnotationAutosave = useCallback((nextLayers: AnnotationLayerMap) => {
    const activeFork = forkRef.current;
    if (!activeFork) {
      return;
    }
    const activeForkId = activeFork.id;

    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    autosaveTimeoutRef.current = setTimeout(() => {
      async function saveAnnotationLayers() {
        setSavingLayer(true);

        try {
          const { error: updateError } = await supabase
            .from("user_forks")
            .update({ annotation_layers: nextLayers } as never)
            .eq("id", activeForkId);

          if (updateError) {
            throw updateError;
          }
        } catch (saveError) {
          setError(saveError instanceof Error ? saveError.message : "Unable to save annotation layer.");
        } finally {
          setSavingLayer(false);
        }
      }

      void saveAnnotationLayers();
    }, 800);
  }, []);

  const captureCurrentPageLayer = useCallback((options: { autosave?: boolean } = {}) => {
    const canvas = canvasInstanceRef.current;
    if (!canvas || restoringCanvasRef.current) {
      return;
    }

    const json = canvas.toJSON();
    const objects = Array.isArray(json.objects) ? json.objects : [];
    const currentPage = pageNumberRef.current;
    const nextLayers = {
      ...annotationLayersRef.current,
      [currentPage]: objects,
    };

    annotationLayersRef.current = nextLayers;
    setAnnotationLayers(nextLayers);

    if (options.autosave) {
      scheduleAnnotationAutosave(nextLayers);
    }
  }, [scheduleAnnotationAutosave]);

  useEffect(() => {
    if (!canvasHostElement) {
      setCanvasElement(null);
      return;
    }

    const nextCanvas = document.createElement("canvas");
    nextCanvas.style.position = "absolute";
    nextCanvas.style.inset = "0";
    nextCanvas.style.touchAction = "none";
    nextCanvas.style.userSelect = "none";
    nextCanvas.style.pointerEvents = "auto";
    canvasHostElement.replaceChildren(nextCanvas);
    setCanvasElement(nextCanvas);

    return () => {
      setCanvasElement(null);
      canvasHostElement.replaceChildren();
    };
  }, [canvasHostElement]);

  useEffect(() => {
    if (!fabric || !canvasElement) {
      return;
    }

    const instance = new fabric.Canvas(canvasElement, {
      backgroundColor: "transparent",
      isDrawingMode: false,
      selection: true,
    });

    instance.freeDrawingBrush.width = 3;
    instance.freeDrawingBrush.color = "#f59e0b";
    instance.freeDrawingBrush.shadow = new fabric.Shadow({
      color: "rgba(245,158,11,0.25)",
      blur: 8,
      offsetX: 0,
      offsetY: 0,
    });

    instance.on("selection:created", () => setActiveSelection(true));
    instance.on("selection:updated", () => setActiveSelection(true));
    instance.on("selection:cleared", () => setActiveSelection(false));

    const wrapperElement = instance.wrapperEl;
    const lowerCanvasElement = instance.lowerCanvasEl;
    const upperCanvasElement = instance.upperCanvasEl;

    if (wrapperElement) {
      wrapperElement.style.position = "absolute";
      wrapperElement.style.inset = "0";
      wrapperElement.style.width = "100%";
      wrapperElement.style.height = "100%";
      wrapperElement.style.zIndex = "20";
      wrapperElement.style.pointerEvents = "auto";
    }

    if (lowerCanvasElement) {
      lowerCanvasElement.style.position = "absolute";
      lowerCanvasElement.style.inset = "0";
      lowerCanvasElement.style.width = "100%";
      lowerCanvasElement.style.height = "100%";
      lowerCanvasElement.style.background = "transparent";
    }

    if (upperCanvasElement) {
      upperCanvasElement.style.position = "absolute";
      upperCanvasElement.style.inset = "0";
      upperCanvasElement.style.width = "100%";
      upperCanvasElement.style.height = "100%";
      upperCanvasElement.style.background = "transparent";
      upperCanvasElement.style.cursor = toolRef.current === "pen" || toolRef.current === "highlight" ? "crosshair" : "text";
    }

    const handleMouseDown = (event: FabricMouseEvent) => {
      if (toolRef.current !== "text" || event.target || !event.e) {
        return;
      }

      const pointer = instance.getPointer(event.e);
      const text = new fabric.IText("New note", {
        left: Math.max(pointer.x - 60, 16),
        top: Math.max(pointer.y - 16, 16),
        fill: annotationColorRef.current,
        fontSize: 22,
        backgroundColor: "rgba(255,255,255,0.85)",
        padding: 8,
        editable: true,
      });

      instance.add(text);
      instance.setActiveObject(text);
      instance.renderAll();
    };

    instance.on("mouse:down", handleMouseDown as () => void);
    const handleCanvasChanged = () => {
      captureCurrentPageLayer({ autosave: true });
    };
    instance.on("object:added", handleCanvasChanged);
    instance.on("object:modified", handleCanvasChanged);
    instance.on("object:removed", handleCanvasChanged);
    instance.on("path:created", handleCanvasChanged);
    instance.on("text:changed", handleCanvasChanged);

    canvasInstanceRef.current = instance;

    return () => {
      try {
        instance.off("mouse:down", handleMouseDown);
        instance.off("object:added", handleCanvasChanged);
        instance.off("object:modified", handleCanvasChanged);
        instance.off("object:removed", handleCanvasChanged);
        instance.off("path:created", handleCanvasChanged);
        instance.off("text:changed", handleCanvasChanged);
        instance.dispose();
      } catch {
        // Fabric may already have detached DOM nodes during React unmount.
      }
      canvasInstanceRef.current = null;
      setActiveSelection(false);
    };
  }, [canvasElement, captureCurrentPageLayer, fabric]);

  useEffect(() => {
    const canvas = canvasInstanceRef.current;
    if (!canvas || !fabric) {
      return;
    }

    canvas.isDrawingMode = tool === "pen" || tool === "highlight";
    canvas.selection = tool === "pan";
    canvas.forEachObject((object) => {
      object.selectable = tool === "pan" || tool === "text";
      object.evented = tool === "pan" || tool === "text";
    });

    canvas.freeDrawingBrush.width = tool === "highlight" ? 18 : 3;
    canvas.freeDrawingBrush.color = tool === "highlight" ? hexToRgba(annotationColor, 0.35) : annotationColor;
    canvas.freeDrawingBrush.shadow = tool === "highlight"
      ? null
      : new fabric.Shadow({
          color: hexToRgba(annotationColor, 0.25),
          blur: 8,
          offsetX: 0,
          offsetY: 0,
        });

    if (canvas.upperCanvasEl) {
      canvas.upperCanvasEl.style.cursor =
        tool === "pen" || tool === "highlight" ? "crosshair" : tool === "text" ? "text" : "move";
    }

    canvas.renderAll();
  }, [annotationColor, canvasElement, fabric, tool]);

  useEffect(() => {
    const resize = () => {
      const pdfStage = pdfStageElement;
      const canvas = canvasInstanceRef.current;
      if (!pdfStage || !canvas) return;

      const width = pdfStage.offsetWidth;
      const height = pdfStage.offsetHeight;
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
    if (pdfStageElement) {
      observer.observe(pdfStageElement);
      resize();
    }

    return () => observer.disconnect();
  }, [canvasElement, pageNumber, pdfStageElement]);

  useEffect(() => {
    if (!pdfStageElement) {
      setPdfStageSize({ width: 0, height: 0 });
      return;
    }

    const resize = () => {
      setPdfStageSize({ width: pdfStageElement.offsetWidth, height: pdfStageElement.offsetHeight });
    };

    const observer = new ResizeObserver(() => resize());
    observer.observe(pdfStageElement);
    resize();

    return () => observer.disconnect();
  }, [pdfStageElement, pageNumber]);

  useEffect(() => {
    const canvas = canvasInstanceRef.current;
    if (!canvas) return;

    restoringCanvasRef.current = true;
    canvas.clear();
    const objects = annotationLayersRef.current[pageNumber] ?? [];
    if (objects.length === 0) {
      canvas.renderAll();
      restoringCanvasRef.current = false;
      return;
    }

    canvas.loadFromJSON({ objects }, () => {
      canvas.renderAll();
      restoringCanvasRef.current = false;
    });
  }, [canvasElement, fork?.id, pageNumber]);

  const goToPdfPage = useCallback((nextPage: number) => {
    if (numPages === 0) {
      return;
    }

    const targetPage = Math.min(numPages, Math.max(1, nextPage));
    if (targetPage === pageNumber) {
      return;
    }

    captureCurrentPageLayer({ autosave: true });
    setPageNumber(targetPage);
    setActiveSelection(false);
  }, [captureCurrentPageLayer, numPages, pageNumber]);

  const changePdfZoom = useCallback((delta: number) => {
    setPdfZoom((currentZoom) => clampPdfZoom(currentZoom + delta));
  }, []);

  const handlePdfTouchStart = useCallback((event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 2) {
      pinchDistanceRef.current = 0;
      return;
    }

    pinchDistanceRef.current = getTouchDistance(event.touches);
    pinchZoomRef.current = pdfZoom;
  }, [pdfZoom]);

  const handlePdfTouchMove = useCallback((event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 2 || pinchDistanceRef.current <= 0) {
      return;
    }

    event.preventDefault();
    const nextDistance = getTouchDistance(event.touches);
    setPdfZoom(clampPdfZoom(pinchZoomRef.current * (nextDistance / pinchDistanceRef.current)));
  }, []);

  const handlePdfTouchEnd = useCallback((event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length < 2) {
      pinchDistanceRef.current = 0;
    }
  }, []);

  const ensureFork = async () => {
    if (!isSupabaseConfigured) {
      throw new Error("Supabase is not configured.");
    }

    const user = await getSupabaseUser();
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
        setForkTitle(typedFork.pinned_title ?? "");
        setForkDescription(typedFork.description ?? "");
        setMarkdown(typedFork.markdown_content || initialMarkdown);
        setAnnotationLayers(typedFork.annotation_layers ?? {});
        return typedFork;
      }

      const payload = {
        user_id: user.id,
        material_id: materialId,
        source_url: sourceUrl,
        pinned_title: forkTitle.trim() || null,
        description: forkDescription.trim() || null,
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

  const makeUniqueSourceUrl = (baseUrl: string) => {
    if (baseUrl.includes("#")) {
      return `${baseUrl}&fork=${Date.now()}`;
    }

    return `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}fork=${Date.now()}`;
  };

  const createNewFork = async () => {
    setLoadingFork(true);

    try {
      const user = await getSupabaseUser();
      if (!user) {
        throw new Error("Please log in to create a fork.");
      }

      const payload = {
        user_id: user.id,
        material_id: materialId,
        source_url: makeUniqueSourceUrl(sourceUrl),
        description: null,
        markdown_content: initialMarkdown,
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
      setForkTitle(typedFork.pinned_title ?? "");
      setForkDescription(typedFork.description ?? "");
      setMarkdown(typedFork.markdown_content || initialMarkdown);
      setAnnotationLayers(typedFork.annotation_layers ?? {});
      setForkCards((current) => [
        {
          ...typedFork,
          author_name: "Your fork",
          star_count: 0,
          has_starred: false,
          is_pinned: typedFork.is_pinned,
          pinned_title: typedFork.pinned_title,
          pinned_order: typedFork.pinned_order,
        },
        ...current,
      ]);
      return typedFork;
    } finally {
      setLoadingFork(false);
    }
  };

  const handleCreateFork = async () => {
    setShowEditor(true);
    setEditorMode("edit");
    setError("");
    setFork(null);
    setForkTitle("");
    setForkDescription("");
    setMarkdown(initialMarkdown);
    setAnnotationLayers({});
    setPageNumber(1);

    try {
      await createNewFork();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to start your fork.");
    }
  };

  const handleSaveMarkdown = async () => {
    setError("");

    const trimmedTitle = forkTitle.trim();
    if (!trimmedTitle) {
      setError("Please add a title before saving this fork.");
      return;
    }

    setSavingMarkdown(true);

    try {
      const activeFork = fork ?? (await createNewFork());
      const { data: updatedFork, error: updateError } = await supabase
        .from("user_forks")
        .update({
          pinned_title: trimmedTitle,
          description: forkDescription.trim() || null,
          markdown_content: markdown,
        } as never)
        .eq("id", activeFork.id)
        .select("*")
        .single();

      if (updateError) {
        throw updateError;
      }

      const typedFork = updatedFork as UserFork & { annotation_layers: AnnotationLayerMap | null; markdown_content: string };
      setFork(typedFork);
      setForkTitle(typedFork.pinned_title ?? "");
      setForkDescription(typedFork.description ?? "");
      setForkCards((current) => {
        const nextFork: ForkCardData = {
          ...typedFork,
          author_name: current.find((forkCard) => forkCard.id === typedFork.id)?.author_name ?? "Your fork",
          star_count: current.find((forkCard) => forkCard.id === typedFork.id)?.star_count ?? 0,
          has_starred: current.find((forkCard) => forkCard.id === typedFork.id)?.has_starred ?? false,
          is_pinned: typedFork.is_pinned,
          pinned_title: typedFork.pinned_title,
          pinned_order: typedFork.pinned_order,
        };
        const rest = current.filter((existingFork) => existingFork.id !== typedFork.id);
        return [nextFork, ...rest];
      });
      setShowEditor(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save fork markdown.");
    } finally {
      setSavingMarkdown(false);
    }
  };

  const handleEditFork = (forkCard: ForkCardData) => {
    setError("");
    setFork(forkCard);
    setForkTitle(forkCard.pinned_title ?? "");
    setForkDescription(forkCard.description ?? "");
    setMarkdown(forkCard.markdown_content || initialMarkdown);
    setAnnotationLayers(forkCard.annotation_layers ?? {});
    setShowEditor(true);
    setEditorMode("edit");
  };

  const removeSelection = () => {
    const canvas = canvasInstanceRef.current;
    if (!canvas) return;
    const activeObjects = canvas.getActiveObjects();
    if (activeObjects.length > 0) {
      activeObjects.forEach((activeObject) => {
        canvas.remove(activeObject);
      });
      canvas.discardActiveObject();
      canvas.renderAll();
      setActiveSelection(false);
      captureCurrentPageLayer({ autosave: true });
    }
  };

  const handleRemovePdf = (index: number) => {
    setMarkdown((current) => removePdfLinkByIndex(current, index));
  };

  const handleRemoveImage = (index: number) => {
    setMarkdown((current) => removeImageLinkByIndex(current, index));
  };

  const handleUploadFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setError("");
    setUploadingFile(true);

    try {
      if (!isSupabaseConfigured) {
        throw new Error("Supabase is not configured.");
      }

      const user = await getSupabaseUser();
      if (!user) {
        throw new Error("Please log in to upload attachments.");
      }

      await ensureFork();
      const uploadedUrl = await uploadForkAttachment(file, user.id);
      const nextLink = `[${file.name}](${uploadedUrl})`;
      setMarkdown((current) => {
        const trimmed = current.trim();
        return trimmed ? `${trimmed}\n\n${nextLink}` : nextLink;
      });
      setShowEditor(true);
      setEditorMode("edit");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload attachment.");
    } finally {
      setUploadingFile(false);
    }
  };

  const renderForkCard = (forkCard: ForkCardData) => (
    <div
      key={forkCard.id}
      className="flex min-h-48 cursor-pointer flex-col rounded-2xl border border-border bg-surface-strong p-4 transition hover:border-foreground/30 hover:bg-surface"
      onClick={() => router.push(`/forks?forkId=${forkCard.id}&materialSlug=${materialSlug}`)}
    >
      <h3 className="text-2xl leading-tight text-foreground">
        {forkCard.pinned_title?.trim() || "Community fork"}
      </h3>

      <p className="mt-3 min-h-12 text-sm leading-6 text-text-muted">
        {forkCard.description?.trim() || ""}
      </p>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {currentUserId && forkCard.user_id === currentUserId ? (
              "Your fork"
            ) : (
              <Link
                href={`/users?userId=${forkCard.user_id}`}
                className="hover:text-brand"
                onClick={(event) => event.stopPropagation()}
              >
                {forkCard.author_name}
              </Link>
            )}
          </p>
          <p className="mt-1 text-xs text-text-muted">Saved on {new Date(forkCard.created_at).toLocaleDateString()}</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-text-muted">
          <Star className={`h-4 w-4 ${forkCard.has_starred ? "fill-current text-brand" : ""}`} />
          {forkCard.star_count}
        </span>
        {currentUserId && forkCard.user_id === currentUserId ? (
          <Button
            type="button"
            size="sm"
            variant="default"
            onClick={(event) => {
              event.stopPropagation();
              handleEditFork(forkCard);
            }}
          >
            Edit
          </Button>
        ) : null}
      </div>
    </div>
  );

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

    const pdfPreview = pdfPreviews[href] ?? { status: "loading" };
    const lockPdfInteractions = tool !== "pan";
    const pageBaseWidth = pageWrapperElement?.clientWidth ?? 760;
    const zoomedStageWidth = pdfStageSize.width > 0 ? pdfStageSize.width * pdfZoom : "100%";
    const zoomedStageHeight = pdfStageSize.height > 0 ? pdfStageSize.height * pdfZoom : undefined;

    return (
      <div key={`pdf-editor-${index}`} className="mb-3 rounded-2xl border border-border bg-[#08131f] p-2 sm:mb-6 sm:rounded-[28px] sm:p-5">
        <div className="mb-2 flex flex-wrap items-start justify-between gap-2 sm:mb-4 sm:gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">{label}</p>
            <p className="text-sm text-text-muted">PDF attachment rendered inline where this link appears.</p>
          </div>
          <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-[auto_auto_auto] sm:items-center sm:justify-end">
            <div className="flex w-full items-center justify-center gap-1 sm:w-auto sm:justify-end sm:gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-9 w-9 p-0"
              onClick={() => handleRemovePdf(index)}
              aria-label={`Remove ${label} PDF attachment`}
            >
              <X className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant={tool === "pan" ? "default" : "outline"}
              className="h-9 w-9 p-0"
              onClick={() => setTool("pan")}
              aria-label="Select"
              title="Select"
            >
              <MousePointer2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant={tool === "pen" ? "default" : "outline"}
              className="h-9 w-9 p-0"
              onClick={() => setTool("pen")}
              aria-label="Pen"
              title="Pen"
            >
              <PenTool className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant={tool === "highlight" ? "default" : "outline"}
              className="h-9 w-9 p-0"
              onClick={() => setTool("highlight")}
              aria-label="Highlighter"
              title="Highlighter"
            >
              <Highlighter className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant={tool === "text" ? "default" : "outline"}
              className="h-9 w-9 p-0"
              onClick={() => {
                setTool("text");
              }}
              aria-label="Text"
              title="Text"
            >
              <TextCursorInput className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 w-9 p-0"
              onClick={removeSelection}
              disabled={!activeSelection}
              aria-label="Erase selected annotation"
              title="Erase"
            >
              <Eraser className="h-4 w-4" />
            </Button>
            </div>
            <div className="flex w-full justify-center sm:w-auto">
            <div className="flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-1" aria-label="Annotation colors">
              {annotationColors.map((color) => (
                <button
                  key={`annotation-${color}`}
                  type="button"
                  className={`h-5 w-5 rounded-full border ${annotationColor === color ? "border-foreground ring-2 ring-focus" : "border-border-strong"}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setAnnotationColor(color)}
                  aria-label={`Use annotation color ${color}`}
                  title={`Color ${color}`}
                />
              ))}
            </div>
            </div>
            <div className="flex w-full items-center justify-center gap-1 sm:w-auto sm:justify-end sm:gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-9 w-9 p-0"
              onClick={() => changePdfZoom(-pdfZoomStep)}
              disabled={pdfZoom <= minPdfZoom}
              aria-label="Zoom out"
              title="Zoom out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="min-w-12 text-center text-sm text-text-muted">{Math.round(pdfZoom * 100)}%</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-9 w-9 p-0"
              onClick={() => changePdfZoom(pdfZoomStep)}
              disabled={pdfZoom >= maxPdfZoom}
              aria-label="Zoom in"
              title="Zoom in"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-9 w-9 p-0"
              onClick={() => goToPdfPage(pageNumber - 1)}
              disabled={pageNumber === 1}
            >
              ←
            </Button>
            <span className="text-sm text-text-muted">{pageNumber} / {numPages || "—"}</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-9 w-9 p-0"
              onClick={() => goToPdfPage(pageNumber + 1)}
              disabled={pageNumber === numPages}
            >
              →
            </Button>
          </div>
          </div>
        </div>

        <div
          className={`relative rounded-2xl border border-white/10 bg-[#09101b] p-1 sm:rounded-[28px] sm:p-4 ${
            lockPdfInteractions
              ? "[&_.react-pdf__Page__textContent]:pointer-events-none [&_.react-pdf__Page__textContent]:select-none [&_.react-pdf__Page__textContent_*]:pointer-events-none [&_.react-pdf__Page__textContent_*]:select-none"
              : ""
          }`}
        >
          <div
            ref={setPageWrapperElement}
            className="relative overflow-auto rounded-xl bg-[#0b1421] sm:rounded-[24px]"
            onTouchStart={handlePdfTouchStart}
            onTouchMove={handlePdfTouchMove}
            onTouchEnd={handlePdfTouchEnd}
            onTouchCancel={handlePdfTouchEnd}
          >
            {pdfPreview.status === "loading" ? (
              <div className="flex h-72 items-center justify-center text-white/60">
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                Loading PDF...
              </div>
            ) : pdfPreview.status === "error" ? (
              <div className="flex min-h-72 flex-col items-center justify-center gap-3 px-6 text-center">
                <p className="text-sm text-white/70">{pdfPreview.message}</p>
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold text-brand underline decoration-brand/35 underline-offset-4 hover:text-brand-soft"
                >
                  Open original link
                </a>
              </div>
            ) : (
              <div
                className="relative"
                style={{
                  width: zoomedStageWidth,
                  height: zoomedStageHeight,
                  minWidth: "100%",
                }}
              >
                <div
                  ref={setPdfStageElement}
                  className="relative"
                  style={{
                    width: pageBaseWidth,
                    transform: `scale(${pdfZoom})`,
                    transformOrigin: "top left",
                  }}
                >
                  <Document
                    file={pdfPreview.url}
                    loading={
                      <div className="flex h-72 items-center justify-center text-white/60">
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        Loading PDF...
                      </div>
                    }
                    error={
                      <div className="flex h-72 items-center justify-center px-6 text-center text-sm text-white/60">
                        PDF preview is unavailable. Open the original link instead.
                      </div>
                    }
                    onLoadSuccess={({ numPages: pages }) => {
                      setNumPages(pages);
                    }}
                    onLoadError={() => {
                      setError("PDF preview is unavailable. The file may have been moved, deleted, or blocked by the host.");
                    }}
                  >
                    <Page
                      pageNumber={pageNumber}
                      width={pageBaseWidth}
                      renderAnnotationLayer={false}
                      renderTextLayer={true}
                    />
                  </Document>
                  <div
                    ref={setCanvasHostElement}
                    className="absolute inset-0 z-20 pointer-events-auto"
                    style={{
                      touchAction: "none",
                      userSelect: lockPdfInteractions ? "none" : undefined,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderImageLink = (href: string, label: string, index: number) => {
    if (!showEditor) {
      return (
        <a
          key={`image-link-${index}`}
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
      <div key={`image-editor-${index}`} className="mb-6 rounded-[28px] border border-border bg-[#08131f] p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">{label}</p>
            <p className="text-sm text-text-muted">Image attachment rendered inline where this link appears.</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-9 w-9 p-0"
            onClick={() => handleRemoveImage(index)}
            aria-label={`Remove ${label} image attachment`}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#09101b]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={href} alt={label} className="h-auto max-h-[720px] w-full object-contain bg-[#0b1421]" />
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-[24px] border border-border bg-surface p-3 sm:rounded-[32px] sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Fork workspace</p>
          <h2 className="mt-2 text-2xl text-foreground">Live markdown fork editor</h2>
        </div>
        {!showEditor ? (
          <Button type="button" size="sm" variant="default" onClick={handleCreateFork} disabled={loadingFork || savingMarkdown}>
            Create new fork
          </Button>
        ) : null}
      </div>

      {error ? <p className="mb-4 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}

      {!showEditor ? (
        <div className="rounded-[20px] border border-border bg-background p-3 sm:rounded-[24px] sm:p-4">
          <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Start editing</p>
          <p className="mt-2 text-sm text-text-muted">Click “Create new fork” to open the full-width editor, manage attachments, and edit the markdown live.</p>
        </div>
      ) : null}

      {showEditor ? (
        <div className="rounded-[24px] border border-border bg-background p-3 sm:rounded-[32px] sm:p-6">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleUploadFile}
          />

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Fork editor</p>
              <p className="mt-1 text-sm text-text-muted">Edit your fork with live markdown rendering, inline PDF viewing, and direct attachment controls.</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-full border border-border bg-surface p-1">
                {(["edit", "raw"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      editorMode === mode
                        ? "bg-foreground text-background"
                        : "text-text-muted hover:text-foreground"
                    }`}
                    onClick={() => setEditorMode(mode)}
                  >
                    {mode === "edit" ? "Edit" : "Raw"}
                  </button>
                ))}
              </div>

              <span className="rounded-full bg-surface-strong px-3 py-1 text-xs font-semibold text-text-muted">
                {pdfLinks.length} PDF link{pdfLinks.length === 1 ? "" : "s"}
              </span>

              <span className="rounded-full bg-surface-strong px-3 py-1 text-xs font-semibold text-text-muted">
                {imageLinks.length} image{imageLinks.length === 1 ? "" : "s"}
              </span>

              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploadingFile}>
                <Upload className="mr-2 h-4 w-4" />
                {uploadingFile ? "Uploading..." : "Upload file"}
              </Button>

              <Button type="button" variant="default" onClick={handleSaveMarkdown} disabled={savingMarkdown || loadingFork}>
                {savingMarkdown ? "Saving draft..." : "Save fork"}
              </Button>
            </div>
          </div>

          <div className="mt-4 space-y-3 rounded-[20px] border border-border bg-surface p-3 sm:mt-6 sm:space-y-4 sm:rounded-[24px] sm:p-4">
            <div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Title</p>
                <p className="text-xs font-medium text-text-soft">Required</p>
              </div>
              <Textarea
                className="mt-3 min-h-16 border border-border bg-background"
                value={forkTitle}
                onChange={(event) => setForkTitle(event.target.value)}
                placeholder="Add a title for this fork..."
                aria-required="true"
              />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Description</p>
              <Textarea
                className="mt-3 min-h-24 border border-border bg-background"
                value={forkDescription}
                onChange={(event) => setForkDescription(event.target.value)}
                placeholder="Add a short optional description for this fork..."
              />
            </div>
          </div>

          {editorMode === "edit" ? (
            <div className="mt-4 sm:mt-6">
              <div className="rounded-[20px] border border-border bg-surface p-2 sm:rounded-[24px] sm:p-4">
                <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Rendered fork</p>
                <p className="mt-2 text-sm text-text-muted">Edit directly in this rendered view. PDF and image attachments render inline, and the close button removes the attachment link from the markdown.</p>
                <div className="mt-2 sm:mt-4">
                  <MarkdownRenderer
                    markdown={markdown}
                    editable
                    onMarkdownChange={setMarkdown}
                    renderPdfLink={renderPdfLink}
                    renderImageLink={renderImageLink}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-[20px] border border-border bg-surface p-3 sm:mt-6 sm:rounded-[24px] sm:p-4">
              <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Raw markdown</p>
              <p className="mt-2 text-sm text-text-muted">Edit the source directly when you need exact markdown control.</p>
              <Textarea
                className="mt-4 min-h-[620px] border border-border bg-[#0e1118] text-white"
                value={markdown}
                onChange={(event) => setMarkdown(event.target.value)}
                placeholder="Write your fork notes or edits in markdown..."
              />
            </div>
          )}
        </div>
      ) : null}

      <div className="mt-6 space-y-6">
        {forkActionError ? <p className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{forkActionError}</p> : null}

        <div className="rounded-[24px] border border-border bg-background p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-text-soft">My fork</p>
              <p className="mt-2 text-sm text-text-muted">Your saved fork for this resource appears here.</p>
            </div>
            <span className="rounded-full bg-surface-strong px-3 py-1 text-xs font-semibold text-text-muted">
              {myForks.length} fork{myForks.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {loadingForkCards ? (
              <p className="text-sm text-text-muted">Loading forks...</p>
            ) : forkCardsError ? (
              <p className="text-sm text-rose-200">{forkCardsError}</p>
            ) : myForks.length > 0 ? (
              myForks.map(renderForkCard)
            ) : (
              <p className="text-sm text-text-muted">You have not saved a fork for this resource yet.</p>
            )}
          </div>
        </div>

        <div className="rounded-[24px] border border-border bg-background p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Community fork</p>
              <p className="mt-2 text-sm text-text-muted">Explore other learners&apos; forks and sort by recency or stars.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="inline-flex rounded-full border border-border bg-surface p-1">
                {([
                  { key: "latest" as const, label: "Latest" },
                  { key: "highest-star" as const, label: "Highest star" },
                ]).map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      communitySort === option.key
                        ? "bg-foreground text-background"
                        : "text-text-muted hover:text-foreground"
                    }`}
                    onClick={() => setCommunitySort(option.key)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <span className="rounded-full bg-surface-strong px-3 py-1 text-xs font-semibold text-text-muted">
                {communityForks.length} fork{communityForks.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {loadingForkCards ? (
              <p className="text-sm text-text-muted">Loading forks...</p>
            ) : forkCardsError ? (
              <p className="text-sm text-rose-200">{forkCardsError}</p>
            ) : communityForks.length > 0 ? (
              communityForks.map(renderForkCard)
            ) : (
              <p className="text-sm text-text-muted">No community forks have been created for this resource yet.</p>
            )}
          </div>
        </div>
      </div>

      <div className="hidden mt-6 rounded-[24px] border border-border bg-background p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Other people’s forks</p>
            <p className="mt-2 text-sm text-text-muted">See forks from other learners below.</p>
          </div>
          <span className="rounded-full bg-surface-strong px-3 py-1 text-xs font-semibold text-text-muted">
            {loadingOtherForks ? "..." : `${otherForks?.length ?? 0} forks`}
          </span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {loadingOtherForks ? (
            <p className="text-sm text-text-muted">Loading other forks...</p>
          ) : otherForksError ? (
            <p className="text-sm text-rose-200">{otherForksError}</p>
          ) : otherForks && otherForks.length > 0 ? (
            otherForks.map((otherFork) => (
              <div key={otherFork.id} className="rounded-2xl border border-border bg-surface-strong px-4 py-3">
                <p className="text-sm font-semibold text-foreground">
                  {currentUserId && fork?.id === otherFork.id ? "Your fork" : "Fork by another student"}
                </p>
                <p className="mt-1 text-sm text-text-muted">Created on {new Date(otherFork.created_at).toLocaleDateString()}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-text-muted">No other forks have been created for this resource yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
