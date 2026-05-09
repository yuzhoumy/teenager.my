"use client";

import dynamic from "next/dynamic";
import type { StudyMaterial } from "@/types/resource";

const ResourceDetailClient = dynamic(
  () => import("@/components/resources/resource-detail-client").then((mod) => mod.ResourceDetailClient),
  { ssr: false }
);

type InitialTab = "resource" | "fork" | "discussion";

export function ResourceDetailClientShell({
  material,
  initialTab,
}: {
  material: StudyMaterial;
  initialTab?: InitialTab;
}) {
  return <ResourceDetailClient material={material} initialTab={initialTab} />;
}
