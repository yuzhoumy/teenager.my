import { Suspense } from "react";
import { StudySessionDetailClient } from "@/components/study-zone/study-session-detail-client";

export default function StudySessionDetailPage() {
  return (
    <Suspense fallback={null}>
      <StudySessionDetailClient />
    </Suspense>
  );
}
