import { Suspense } from "react";
import { ProfileFollowListClient } from "@/components/profile/profile-follow-list-client";

export default function UserFollowersPage() {
  return (
    <Suspense fallback={null}>
      <ProfileFollowListClient kind="followers" source="query-user" />
    </Suspense>
  );
}
