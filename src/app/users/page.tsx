import { Suspense } from "react";
import { PublicProfileClient } from "@/components/profile/public-profile-client";

export default function PublicProfilePage() {
  return (
    <Suspense fallback={null}>
      <PublicProfileClient />
    </Suspense>
  );
}
