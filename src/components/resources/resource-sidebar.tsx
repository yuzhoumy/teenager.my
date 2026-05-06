"use client";

import { useMemo } from "react";
import { BookCopy } from "lucide-react";
import type { ResourcePdfLink, StudyMaterial } from "@/types/resource";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function ResourceSidebar({
  material,
  pdfLinks,
}: {
  material: StudyMaterial;
  pdfLinks: ResourcePdfLink[];
}) {
  return material.core_type === "exercise" ? (
    <ExerciseSidebar material={material} pdfLinks={pdfLinks} />
  ) : (
    <NoteSidebar material={material} pdfLinks={pdfLinks} />
  );
}

function ExerciseSidebar({
  pdfLinks,
}: {
  material: StudyMaterial;
  pdfLinks: ResourcePdfLink[];
}) {
  const topPdf = useMemo(() => pdfLinks[0] ?? null, [pdfLinks]);

  return (
    <div className="space-y-5">
      <Card className="rounded-[28px] border-border bg-white/80 p-5 shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Exercise Sidebar</p>
            <h3 className="mt-2 text-3xl text-foreground">Exercise resources</h3>
          </div>
        </div>

        <p className="mt-3 text-sm text-text-muted">
          Use the available PDF to work through this exercise and review the resource details.
        </p>

        {topPdf ? (
          <Button asChild variant="outline" className="mt-4 w-full">
            <a href={topPdf.href} target="_blank" rel="noreferrer">
              <BookCopy className="h-4 w-4" />
              Open Exercise PDF
            </a>
          </Button>
        ) : (
          <p className="mt-4 text-sm text-text-muted">No PDF attachment is available for this exercise.</p>
        )}
      </Card>
    </div>
  );
}

function NoteSidebar({
  pdfLinks,
}: {
  material: StudyMaterial;
  pdfLinks: ResourcePdfLink[];
}) {
  const topPdf = useMemo(() => pdfLinks[0] ?? null, [pdfLinks]);

  return (
    <div className="space-y-5">
      <Card className="rounded-[28px] border-border bg-white/80 p-5 shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Note Sidebar</p>
            <h3 className="mt-2 text-3xl text-foreground">Note resources</h3>
          </div>
        </div>

        <p className="mt-3 text-sm text-text-muted">
          Open the attached PDF for this note when available.
        </p>

        {topPdf ? (
          <Button asChild variant="outline" className="mt-4 w-full">
            <a href={topPdf.href} target="_blank" rel="noreferrer">
              <BookCopy className="h-4 w-4" />
              Open Attached PDF
            </a>
          </Button>
        ) : (
          <p className="mt-4 text-sm text-text-muted">No PDF attachment is available for this note.</p>
        )}
      </Card>
    </div>
  );
}
