import { Suspense } from "react";
import { ProfileFollowListClient } from "@/components/profile/profile-follow-list-client";

export default function ProfileFollowingPage() {
  return (
    <Suspense fallback={null}>
      <ProfileFollowListClient kind="following" source="current-user" />
    </Suspense>
  );
}
