"use client";

import dynamic from "next/dynamic";
import type { StudyMaterial } from "@/types/resource";

const ResourceDetailClient = dynamic(
  () => import("@/components/resources/resource-detail-client").then((mod) => mod.ResourceDetailClient),
  { ssr: false }
);

export function ResourceDetailClientShell({ material }: { material: StudyMaterial }) {
  return <ResourceDetailClient material={material} />;
}
