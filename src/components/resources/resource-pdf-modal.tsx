"use client";

import dynamic from "next/dynamic";
import { X } from "lucide-react";
import type { ResourcePdfLink, StudyMaterial } from "@/types/resource";
import { Button } from "@/components/ui/button";

const PdfAnnotationViewer = dynamic(
  () => import("@/components/resources/resource-pdf-viewer").then((mod) => mod.PdfAnnotationViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-[#191c22] text-sm text-white/70">
        Loading PDF workspace…
      </div>
    ),
  },
);

export function ResourcePdfModal({
  material,
  pdfLink,
  open,
  onClose,
}: {
  material: StudyMaterial;
  pdfLink: ResourcePdfLink;
  open: boolean;
  onClose: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex h-[min(90vh,980px)] w-full max-w-7xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#0f1115] shadow-[0_32px_120px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 text-white">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-white/55">Attachment viewer</p>
            <h2 className="mt-1 text-xl text-white">{pdfLink.label}</h2>
          </div>
          <Button type="button" variant="ghost" size="sm" className="text-white hover:bg-white/10 hover:text-white" onClick={onClose}>
            <X className="h-4 w-4" />
            Close
          </Button>
        </div>

        <div className="min-h-0 flex-1">
          <PdfAnnotationViewer materialId={material.id} sourceUrl={pdfLink.href} />
        </div>
      </div>
    </div>
  );
}
