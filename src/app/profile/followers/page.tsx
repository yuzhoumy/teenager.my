import { Suspense } from "react";
import { ProfileFollowListClient } from "@/components/profile/profile-follow-list-client";

export default function ProfileFollowersPage() {
  return (
    <Suspense fallback={null}>
      <ProfileFollowListClient kind="followers" source="current-user" />
    </Suspense>
  );
}
