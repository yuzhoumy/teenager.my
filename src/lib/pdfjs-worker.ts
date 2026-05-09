import { pdfjs } from "react-pdf";

/**
 * PDF.js must load its worker from an absolute URL. Protocol-relative URLs like
 * `//unpkg.com/...` follow the page origin, so on http://localhost they become http://
 * and worker loads can fail. Use an explicit https:// URL and match the installed pdfjs
 * version. Override with NEXT_PUBLIC_PDF_WORKER_URL (e.g. `/pdf.worker.min.mjs` if you
 * copy the file into public/).
 */
const PDFJS_VERSION = pdfjs.version ?? "5.4.296";

const fromEnv =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_PDF_WORKER_URL
    ? process.env.NEXT_PUBLIC_PDF_WORKER_URL.trim()
    : "";

pdfjs.GlobalWorkerOptions.workerSrc =
  fromEnv ||
  `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;
