"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import { BookmarkPlus, Eraser, LoaderCircle, PenTool, Star, TextCursorInput, Upload, X } from "lucide-react";
import { getSupabaseUser, isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";
import type { ForkCardData, ForkStar, UserFork } from "@/types/resource";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownRenderer } from "@/components/resources/markdown-renderer";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs`;

type AnnotationLayerMap = Record<number, unknown[]>;
type Tool = "pan" | "pen" | "text";
type EditorMode = "edit" | "raw";
type CommunitySort = "latest" | "highest-star";
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
  markdown_content: string;
  annotation_layers: Record<number, unknown[]> | null;
  is_pinned: boolean;
  pinned_title: string | null;
  pinned_order: number;
  created_at: string;
};

const bucketName = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "resource-attachments";

function isPdfLink(url: string) {
  return /\.pdf($|[?#])/i.test(url);
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
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const [error, setError] = useState("");
  const [loadingFork, setLoadingFork] = useState(true);
  const [savingMarkdown, setSavingMarkdown] = useState(false);
  const [savingLayer, setSavingLayer] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [tool, setTool] = useState<Tool>("pan");
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
  const [starringForkId, setStarringForkId] = useState<string | null>(null);
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
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null);
  const [pageWrapperElement, setPageWrapperElement] = useState<HTMLDivElement | null>(null);

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
      upperCanvasElement.style.cursor = toolRef.current === "pen" ? "crosshair" : "text";
    }

    const handleMouseDown = (event: FabricMouseEvent) => {
      if (toolRef.current !== "text" || event.target || !event.e) {
        return;
      }

      const pointer = instance.getPointer(event.e);
      const text = new fabric.IText("New note", {
        left: Math.max(pointer.x - 60, 16),
        top: Math.max(pointer.y - 16, 16),
        fill: "#111827",
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

    canvasInstanceRef.current = instance;

    return () => {
      try {
        instance.off("mouse:down", handleMouseDown);
        instance.dispose();
      } catch {
        // Fabric may already have detached DOM nodes during React unmount.
      }
      canvasInstanceRef.current = null;
      setActiveSelection(false);
    };
  }, [canvasElement, fabric]);

  useEffect(() => {
    const canvas = canvasInstanceRef.current;
    if (!canvas) {
      return;
    }

    canvas.isDrawingMode = tool === "pen";
    canvas.selection = tool === "pan";
    canvas.forEachObject((object) => {
      object.selectable = tool === "pan" || tool === "text";
      object.evented = tool === "pan" || tool === "text";
    });

    if (canvas.upperCanvasEl) {
      canvas.upperCanvasEl.style.cursor =
        tool === "pen" ? "crosshair" : tool === "text" ? "text" : "move";
    }

    canvas.renderAll();
  }, [canvasElement, tool]);

  useEffect(() => {
    const resize = () => {
      const pageWrapper = pageWrapperElement;
      const canvas = canvasInstanceRef.current;
      if (!pageWrapper || !canvas) return;

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
    if (pageWrapperElement) {
      observer.observe(pageWrapperElement);
      resize();
    }

    return () => observer.disconnect();
  }, [canvasElement, pageNumber, pageWrapperElement]);

  useEffect(() => {
    const canvas = canvasInstanceRef.current;
    if (!canvas) return;

    canvas.clear();
    const objects = annotationLayers[pageNumber] ?? [];
    if (objects.length === 0) {
      canvas.renderAll();
      return;
    }

    canvas.loadFromJSON({ objects }, () => {
      canvas.renderAll();
    });
  }, [annotationLayers, canvasElement, pageNumber]);

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
    setSavingMarkdown(true);

    try {
      const activeFork = fork ?? (await createNewFork());
      const { data: updatedFork, error: updateError } = await supabase
        .from("user_forks")
        .update({ markdown_content: markdown } as never)
        .eq("id", activeFork.id)
        .select("*")
        .single();

      if (updateError) {
        throw updateError;
      }

      const typedFork = updatedFork as UserFork & { annotation_layers: AnnotationLayerMap | null; markdown_content: string };
      setFork(typedFork);
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
    setMarkdown(forkCard.markdown_content || initialMarkdown);
    setAnnotationLayers(forkCard.annotation_layers ?? {});
    setShowEditor(true);
    setEditorMode("edit");
  };

  const handleSaveLayer = async () => {
    setError("");
    setSavingLayer(true);

    try {
      const activeFork = await ensureFork();
      const canvas = canvasInstanceRef.current;
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

  const removeSelection = () => {
    const canvas = canvasInstanceRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (active) {
      canvas.remove(active);
      canvas.discardActiveObject();
      canvas.renderAll();
      setActiveSelection(false);
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

  const toggleForkStar = async (forkCard: ForkCardData) => {
    if (!currentUserId || starringForkId) {
      if (!currentUserId) {
        setForkActionError("Please log in to star a fork.");
      }
      return;
    }

    setForkActionError("");
    setStarringForkId(forkCard.id);

    try {
      if (forkCard.has_starred) {
        const { error: deleteError } = await supabase
          .from("fork_stars")
          .delete()
          .eq("fork_id", forkCard.id)
          .eq("user_id", currentUserId);

        if (deleteError) {
          throw deleteError;
        }
      } else {
        const payload: Database["public"]["Tables"]["fork_stars"]["Insert"] = {
          fork_id: forkCard.id,
          user_id: currentUserId,
        };

        const { error: insertError } = await supabase
          .from("fork_stars")
          .insert(payload as never);

        if (insertError) {
          throw insertError;
        }
      }

      setForkCards((current) =>
        current.map((currentFork) => {
          if (currentFork.id !== forkCard.id) {
            return currentFork;
          }

          return {
            ...currentFork,
            has_starred: !currentFork.has_starred,
            star_count: currentFork.has_starred ? Math.max(0, currentFork.star_count - 1) : currentFork.star_count + 1,
          };
        }),
      );
    } catch (starError) {
      setForkActionError(starError instanceof Error ? starError.message : "Unable to update fork star.");
    } finally {
      setStarringForkId(null);
    }
  };

  const renderForkCard = (forkCard: ForkCardData) => (
    <div
      key={forkCard.id}
      className="cursor-pointer rounded-2xl border border-border bg-surface-strong p-4 transition hover:border-foreground/30 hover:bg-surface"
      onClick={() => router.push(`/forks?forkId=${forkCard.id}&materialSlug=${materialSlug}`)}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {currentUserId && forkCard.user_id === currentUserId ? "Your fork" : forkCard.author_name}
          </p>
          <p className="mt-1 text-sm text-text-muted">Saved on {new Date(forkCard.created_at).toLocaleDateString()}</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant={forkCard.has_starred ? "secondary" : "outline"}
          disabled={starringForkId === forkCard.id}
          onClick={(event) => {
            event.stopPropagation();
            void toggleForkStar(forkCard);
          }}
        >
          <Star className={`h-4 w-4 ${forkCard.has_starred ? "fill-current" : ""}`} />
          {forkCard.star_count}
        </Button>
      </div>

      <p className="mt-3 line-clamp-3 text-sm leading-6 text-text-muted">
        {forkCard.markdown_content.replace(/\s+/g, " ").trim() || "No markdown content yet."}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
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
            Edit fork
          </Button>
        ) : null}
        <Button asChild size="sm" variant="outline">
          <Link href={`/forks?forkId=${forkCard.id}&materialSlug=${materialSlug}`}>
            Open fork
          </Link>
        </Button>
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

    return (
      <div key={`pdf-editor-${index}`} className="mb-6 rounded-[28px] border border-border bg-[#08131f] p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">{label}</p>
            <p className="text-sm text-text-muted">PDF attachment rendered inline where this link appears.</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
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
            <Button type="button" size="sm" variant={tool === "pan" ? "secondary" : "default"} onClick={() => setTool("pan")}>
              Select
            </Button>
            <Button type="button" size="sm" variant={tool === "pen" ? "secondary" : "default"} onClick={() => setTool("pen")}>
              <PenTool className="mr-2 h-4 w-4" />
              Pen
            </Button>
            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={() => {
                setTool("text");
              }}
            >
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
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-9 w-9 p-0"
              onClick={() => setPageNumber(Math.max(1, pageNumber - 1))}
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
              onClick={() => setPageNumber(Math.min(numPages, pageNumber + 1))}
              disabled={pageNumber === numPages}
            >
              →
            </Button>
          </div>
        </div>

        <div className="relative rounded-[28px] border border-white/10 bg-[#09101b] p-4">
          <div ref={setPageWrapperElement} className="relative overflow-hidden rounded-[24px] bg-[#0b1421]">
            <Document
              file={href}
              loading={
                <div className="flex h-72 items-center justify-center text-white/60">
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  Loading PDF...
                </div>
              }
              onLoadSuccess={({ numPages: pages }) => {
                setNumPages(pages);
              }}
              onLoadError={(pdfError) => {
                setError(`Failed to load PDF: ${pdfError.message}`);
              }}
            >
              <Page
                pageNumber={pageNumber}
                width={pageWrapperElement?.clientWidth ?? 760}
                renderAnnotationLayer={false}
                renderTextLayer={true}
              />
            </Document>
            <canvas
              ref={setCanvasElement}
              className="absolute inset-0 pointer-events-auto"
              style={{ touchAction: "none" }}
            />
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

      {!showEditor ? (
        <div className="rounded-[24px] border border-border bg-background p-4">
          <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Start editing</p>
          <p className="mt-2 text-sm text-text-muted">Click “Create new fork” to open the full-width editor, manage attachments, and edit the markdown live.</p>
        </div>
      ) : null}

      {showEditor ? (
        <div className="rounded-[32px] border border-border bg-background p-6">
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
                {savingMarkdown ? "Saving draft..." : "Save markdown"}
              </Button>
            </div>
          </div>

          {editorMode === "edit" ? (
            <div className="mt-6">
              <div className="rounded-[24px] border border-border bg-surface p-4">
                <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Rendered fork</p>
                <p className="mt-2 text-sm text-text-muted">Edit directly in this rendered view. PDF and image attachments render inline, and the close button removes the attachment link from the markdown.</p>
                <div className="mt-4">
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
            <div className="mt-6 rounded-[24px] border border-border bg-surface p-4">
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
