"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";

const PdfForkEditor = dynamic(
  () => import("@/components/resources/resource-pdf-fork-editor").then((module) => module.PdfForkEditor),
  { ssr: false },
);

export function ResourceForkWorkspace({
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
  const searchParams = useSearchParams();
  const initialForkId = searchParams.get("forkId") ?? undefined;

  return (
    <PdfForkEditor
      materialId={materialId}
      materialSlug={materialSlug}
      sourceUrl={sourceUrl}
      initialMarkdown={initialMarkdown}
      mode="editor"
      initialForkId={initialForkId}
    />
  );
}
