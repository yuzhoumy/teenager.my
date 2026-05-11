import { Suspense } from "react";
import { ProfileFollowListClient } from "@/components/profile/profile-follow-list-client";

export default function UserFollowingPage() {
  return (
    <Suspense fallback={null}>
      <ProfileFollowListClient kind="following" source="query-user" />
    </Suspense>
  );
}
