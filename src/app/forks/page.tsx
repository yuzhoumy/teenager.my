import { Suspense } from "react";
import { ForkViewerClient } from "@/components/resources/fork-viewer-client";

export default function ForkViewerPage() {
  return (
    <Suspense fallback={null}>
      <ForkViewerClient />
    </Suspense>
  );
}
