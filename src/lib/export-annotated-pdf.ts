"use client";

import { pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs`;

type SavedLayerValue =
  | unknown[]
  | {
      objects?: unknown[];
      width?: number;
      height?: number;
    };

type AnnotationLayerMap = Record<number, SavedLayerValue>;

type FabricObject = {
  scaleX: number;
  scaleY: number;
  left: number;
  top: number;
  setCoords?: () => void;
};

type FabricCanvas = {
  lowerCanvasEl?: HTMLCanvasElement;
  loadFromJSON: (json: { objects: unknown[] }, callback: () => void) => void;
  getObjects: () => FabricObject[];
  setWidth: (width: number) => void;
  setHeight: (height: number) => void;
  renderAll: () => void;
  dispose: () => void;
};

type FabricModule = {
  StaticCanvas?: new (element: HTMLCanvasElement, options?: { backgroundColor?: string }) => FabricCanvas;
  Canvas?: new (
    element: HTMLCanvasElement,
    options: { backgroundColor: string; isDrawingMode: boolean; selection: boolean }
  ) => FabricCanvas;
};

type RenderedPdfPage = {
  bytes: Uint8Array;
  width: number;
  height: number;
};

function toUint8Array(dataUrl: string) {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function normalizeSavedLayer(value: SavedLayerValue | undefined) {
  if (!value) {
    return { objects: [] as unknown[], width: null as number | null, height: null as number | null };
  }

  if (Array.isArray(value)) {
    return { objects: value, width: null, height: null };
  }

  return {
    objects: Array.isArray(value.objects) ? value.objects : [],
    width: typeof value.width === "number" ? value.width : null,
    height: typeof value.height === "number" ? value.height : null,
  };
}

async function loadFabricModule() {
  const loadedModule = (await import("fabric")) as { fabric?: FabricModule } & Partial<FabricModule>;
  return loadedModule.fabric ?? (loadedModule as FabricModule);
}

async function renderOverlayCanvas({
  fabric,
  objects,
  outputWidth,
  outputHeight,
  savedWidth,
  savedHeight,
}: {
  fabric: FabricModule;
  objects: unknown[];
  outputWidth: number;
  outputHeight: number;
  savedWidth: number | null;
  savedHeight: number | null;
}) {
  if (objects.length === 0) {
    return null;
  }

  const fabricElement = document.createElement("canvas");
  fabricElement.width = outputWidth;
  fabricElement.height = outputHeight;

  const StaticCanvasClass = fabric.StaticCanvas;
  const CanvasClass = fabric.Canvas;
  if (!StaticCanvasClass && !CanvasClass) {
    throw new Error("Fabric canvas is unavailable.");
  }

  const fabricCanvas = StaticCanvasClass
    ? new StaticCanvasClass(fabricElement, { backgroundColor: "transparent" })
    : new CanvasClass!(fabricElement, {
        backgroundColor: "transparent",
        isDrawingMode: false,
        selection: false,
      });

  fabricCanvas.setWidth(outputWidth);
  fabricCanvas.setHeight(outputHeight);

  await new Promise<void>((resolve) => {
    fabricCanvas.loadFromJSON({ objects }, () => resolve());
  });

  const scaleX = savedWidth && savedWidth > 0 ? outputWidth / savedWidth : 1;
  const scaleY = savedHeight && savedHeight > 0 ? outputHeight / savedHeight : 1;
  if (scaleX !== 1 || scaleY !== 1) {
    fabricCanvas.getObjects().forEach((object) => {
      object.scaleX *= scaleX;
      object.scaleY *= scaleY;
      object.left *= scaleX;
      object.top *= scaleY;
      object.setCoords?.();
    });
  }

  fabricCanvas.renderAll();
  const outputCanvas = fabricCanvas.lowerCanvasEl ?? fabricElement;
  const cloneCanvas = document.createElement("canvas");
  cloneCanvas.width = outputWidth;
  cloneCanvas.height = outputHeight;
  const context = cloneCanvas.getContext("2d");
  if (!context) {
    fabricCanvas.dispose();
    throw new Error("Unable to render annotation layer.");
  }
  context.drawImage(outputCanvas, 0, 0, outputWidth, outputHeight);
  fabricCanvas.dispose();

  return cloneCanvas;
}

async function renderAnnotatedPages({
  file,
  annotationLayers,
  preferredWidth,
}: {
  file: string;
  annotationLayers?: AnnotationLayerMap | null;
  preferredWidth: number;
}) {
  const fabric = await loadFabricModule();
  const loadingTask = pdfjs.getDocument(file);
  const pdfDocument = await loadingTask.promise;
  const renderedPages: RenderedPdfPage[] = [];

  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
    const page = await pdfDocument.getPage(pageNumber);
    const firstViewport = page.getViewport({ scale: 1 });
    const scale = preferredWidth > 0 ? preferredWidth / firstViewport.width : 1.25;
    const viewport = page.getViewport({ scale: Number.isFinite(scale) && scale > 0 ? scale : 1.25 });

    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = Math.round(viewport.width);
    pageCanvas.height = Math.round(viewport.height);

    const pageContext = pageCanvas.getContext("2d");
    if (!pageContext) {
      throw new Error("Unable to render PDF page.");
    }

    await page.render({ canvas: pageCanvas, canvasContext: pageContext, viewport }).promise;

    const mergedCanvas = document.createElement("canvas");
    mergedCanvas.width = pageCanvas.width;
    mergedCanvas.height = pageCanvas.height;
    const mergedContext = mergedCanvas.getContext("2d");
    if (!mergedContext) {
      throw new Error("Unable to compose PDF page.");
    }

    mergedContext.drawImage(pageCanvas, 0, 0);

    const savedLayer = normalizeSavedLayer(annotationLayers?.[pageNumber]);
    const overlayCanvas = await renderOverlayCanvas({
      fabric,
      objects: savedLayer.objects,
      outputWidth: mergedCanvas.width,
      outputHeight: mergedCanvas.height,
      savedWidth: savedLayer.width,
      savedHeight: savedLayer.height,
    });

    if (overlayCanvas) {
      mergedContext.drawImage(overlayCanvas, 0, 0, mergedCanvas.width, mergedCanvas.height);
    }

    renderedPages.push({
      bytes: toUint8Array(mergedCanvas.toDataURL("image/jpeg", 0.92)),
      width: mergedCanvas.width,
      height: mergedCanvas.height,
    });
  }

  return renderedPages;
}

function buildPdf(pages: RenderedPdfPage[]) {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let position = 0;

  const pushText = (text: string) => {
    const bytes = encoder.encode(text);
    chunks.push(bytes);
    position += bytes.length;
  };

  const pushBytes = (bytes: Uint8Array) => {
    chunks.push(bytes);
    position += bytes.length;
  };

  pushText("%PDF-1.4\n");

  const objectOffsets: number[] = [];
  const writeObject = (objectNumber: number, body: string | Uint8Array) => {
    objectOffsets[objectNumber] = position;
    pushText(`${objectNumber} 0 obj\n`);
    if (typeof body === "string") {
      pushText(body);
    } else {
      pushBytes(body);
    }
    pushText("\nendobj\n");
  };

  const pageObjectNumbers: number[] = [];
  const contentObjectNumbers: number[] = [];
  const imageObjectNumbers: number[] = [];
  let nextObjectNumber = 3;

  for (let index = 0; index < pages.length; index += 1) {
    pageObjectNumbers.push(nextObjectNumber);
    contentObjectNumbers.push(nextObjectNumber + 1);
    imageObjectNumbers.push(nextObjectNumber + 2);
    nextObjectNumber += 3;
  }

  const kids = pageObjectNumbers.map((pageObjectNumber) => `${pageObjectNumber} 0 R`).join(" ");
  writeObject(1, `<< /Type /Catalog /Pages 2 0 R >>`);
  writeObject(2, `<< /Type /Pages /Count ${pages.length} /Kids [${kids}] >>`);

  pages.forEach((page, index) => {
    const imageName = `/Im${index + 1}`;
    const pageObjectNumber = pageObjectNumbers[index];
    const contentObjectNumber = contentObjectNumbers[index];
    const imageObjectNumber = imageObjectNumbers[index];
    const contentStream = `q\n${page.width} 0 0 ${page.height} 0 0 cm\n${imageName} Do\nQ`;
    const contentBytes = encoder.encode(contentStream);

    writeObject(
      pageObjectNumber,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] /Resources << /XObject << ${imageName} ${imageObjectNumber} 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`,
    );
    writeObject(
      contentObjectNumber,
      `<< /Length ${contentBytes.length} >>\nstream\n${contentStream}\nendstream`,
    );

    objectOffsets[imageObjectNumber] = position;
    pushText(`${imageObjectNumber} 0 obj\n`);
    pushText(
      `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.bytes.length} >>\nstream\n`,
    );
    pushBytes(page.bytes);
    pushText(`\nendstream\nendobj\n`);
  });

  const xrefOffset = position;
  pushText(`xref\n0 ${nextObjectNumber}\n`);
  pushText("0000000000 65535 f \n");
  for (let objectNumber = 1; objectNumber < nextObjectNumber; objectNumber += 1) {
    pushText(`${String(objectOffsets[objectNumber] ?? 0).padStart(10, "0")} 00000 n \n`);
  }

  pushText(`trailer\n<< /Size ${nextObjectNumber} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  let totalLength = 0;
  for (const chunk of chunks) {
    totalLength += chunk.length;
  }

  const output = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }

  return output;
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-").replace(/\s+/g, " ").trim() || "annotated-fork.pdf";
}

export async function downloadAnnotatedPdf({
  file,
  annotationLayers,
  fileName,
  preferredWidth,
}: {
  file: string;
  annotationLayers?: AnnotationLayerMap | null;
  fileName: string;
  preferredWidth: number;
}) {
  const pages = await renderAnnotatedPages({
    file,
    annotationLayers,
    preferredWidth,
  });
  const pdfBytes = buildPdf(pages);
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = sanitizeFileName(fileName);
    anchor.rel = "noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
