export type ProfileNameRow = {
  user_id: string;
  display_name?: string | null;
};

export function getProfileDisplayName(profile: Pick<ProfileNameRow, "display_name"> | null | undefined, fallback = "Unknown author") {
  return profile?.display_name?.trim() || fallback;
}

export function createProfileNameMap(profiles: ProfileNameRow[] | null | undefined) {
  return new Map(
    (profiles ?? []).map((profile) => [
      profile.user_id,
      getProfileDisplayName(profile),
    ]),
  );
}
