"use client";

import { Eye, Pencil, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ContributionGraph } from "@/components/profile/contribution-graph";
import { educationLevels, normalizeEducationLevel } from "@/lib/education-levels";
import { getMaterialHref } from "@/lib/materials";
import type { ContributionActivity } from "@/lib/profile-contributions";
import type { Database } from "@/types/database";
import type { StudyMaterial, UserFork } from "@/types/resource";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type MaterialBookmarkRow = Database["public"]["Tables"]["material_bookmarks"]["Row"];
type MaterialRow = Database["public"]["Tables"]["materials"]["Row"];
type UserForkRow = Database["public"]["Tables"]["user_forks"]["Row"];
type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];

export default function ProfilePage() {
  const router = useRouter();
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [formLevel, setFormLevel] = useState("1");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [savedResources, setSavedResources] = useState<StudyMaterial[]>([]);
  const [loadingSavedResources, setLoadingSavedResources] = useState(false);
  const [uploadedResources, setUploadedResources] = useState<StudyMaterial[]>([]);
  const [forkedResources, setForkedResources] = useState<UserFork[]>([]);
  const [loadingUploadedResources, setLoadingUploadedResources] = useState(false);
  const [followingCount, setFollowingCount] = useState(0);
  const [followerCount, setFollowerCount] = useState(0);
  const [deletingResourceId, setDeletingResourceId] = useState<string | null>(null);

  const avatarPreview = useMemo(() => avatarUrl.trim(), [avatarUrl]);
  const contributionActivity = useMemo<ContributionActivity[]>(
    () => [
      ...uploadedResources.map((resource) => ({
        id: `upload-${resource.id}`,
        type: "upload" as const,
        title: resource.title,
        href: getMaterialHref(resource),
        createdAt: resource.created_at,
      })),
      ...forkedResources.map((fork) => ({
        id: `fork-${fork.id}`,
        type: "fork" as const,
        title: fork.pinned_title?.trim() || "Community fork",
        href: `/forks?forkId=${fork.id}`,
        createdAt: fork.created_at,
      })),
    ],
    [forkedResources, uploadedResources],
  );

  useEffect(() => {
    async function loadProfile() {
      setLoadingProfile(true);
      setError("");
      setStatus("");

      if (!isSupabaseConfigured) {
      setError("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart dev server.");
        setLoadingProfile(false);
        return;
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) {
        setError(userError.message);
        setLoadingProfile(false);
        return;
      }

      const user = userData.user;
      if (!user) {
        setIsLoggedIn(false);
        setLoadingProfile(false);
        router.replace("/login");
        return;
      }

      setIsLoggedIn(true);
      setUserId(user.id);
      setLoadingSavedResources(true);
      setLoadingUploadedResources(true);

      const [{ count: nextFollowingCount, error: followingError }, { count: nextFollowerCount, error: followerError }] = await Promise.all([
        supabase
          .from("profile_follows")
          .select("id", { count: "exact", head: true })
          .eq("follower_id", user.id),
        supabase
          .from("profile_follows")
          .select("id", { count: "exact", head: true })
          .eq("followed_id", user.id),
      ]);

      if (followingError || followerError) {
        setError(followingError?.message ?? followerError?.message ?? "Unable to load follow counts.");
      } else {
        setFollowingCount(nextFollowingCount ?? 0);
        setFollowerCount(nextFollowerCount ?? 0);
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("display_name, form, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();

      const profile = profileData as Pick<ProfileRow, "display_name" | "form" | "avatar_url"> | null;

      if (profileError) {
        if (profileError.code !== "PGRST205") {
          setError(profileError.message);
          setLoadingProfile(false);
          return;
        }
      }

      setDisplayName(profile?.display_name ?? (user.user_metadata.display_name as string | undefined) ?? "");
      setFormLevel(normalizeEducationLevel(profile?.form ?? user.user_metadata.form));
      setAvatarUrl(
        profile?.avatar_url ?? (user.user_metadata.avatar_url as string | undefined) ?? "",
      );

      const { data: bookmarksData, error: bookmarkError } = await supabase
        .from("material_bookmarks")
        .select("material_id")
        .eq("user_id", user.id);

      const bookmarks = (bookmarksData ?? []) as Array<Pick<MaterialBookmarkRow, "material_id">>;

      if (bookmarkError) {
        setError(bookmarkError.message);
        setLoadingSavedResources(false);
        setLoadingProfile(false);
        return;
      }

      const materialIds = (bookmarks ?? []).map((bookmark) => bookmark.material_id);

      if (materialIds.length === 0) {
        setSavedResources([]);
      } else {
        const { data: materialsData, error: materialsError } = await supabase
          .from("materials")
          .select("*")
          .in("id", materialIds)
          .order("year", { ascending: false })
          .order("created_at", { ascending: false });

        if (materialsError) {
          setError(materialsError.message);
          setLoadingSavedResources(false);
          setLoadingUploadedResources(false);
          setLoadingProfile(false);
          return;
        }

        const materials = (materialsData ?? []) as MaterialRow[];
        setSavedResources(materials as StudyMaterial[]);
      }

      setLoadingSavedResources(false);

      const { data: uploadedData, error: uploadedError } = await supabase
        .from("materials")
        .select("*")
        .eq("uploaded_by", user.id)
        .order("created_at", { ascending: false });

      if (uploadedError) {
        setError(uploadedError.message);
        setLoadingUploadedResources(false);
        setLoadingProfile(false);
        return;
      }

      setUploadedResources((uploadedData ?? []) as StudyMaterial[]);

      const { data: forkedData, error: forkedError } = await supabase
        .from("user_forks")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (forkedError) {
        setError(forkedError.message);
        setLoadingUploadedResources(false);
        setLoadingProfile(false);
        return;
      }

      setForkedResources((forkedData ?? []) as UserFork[]);
      setLoadingUploadedResources(false);
      setLoadingProfile(false);
    }

    void loadProfile();
  }, [router]);

  useEffect(() => {
    if (!userId || !isSupabaseConfigured) {
      return;
    }

    const channel = supabase
      .channel(`profile-contribution-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "materials", filter: `uploaded_by=eq.${userId}` },
        (payload) => {
          const material = payload.new as MaterialRow;
          setUploadedResources((current) => {
            if (current.some((item) => item.id === material.id)) {
              return current;
            }
            return [material as StudyMaterial, ...current];
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "user_forks", filter: `user_id=eq.${userId}` },
        (payload) => {
          const fork = payload.new as UserForkRow;
          setForkedResources((current) => {
            if (current.some((item) => item.id === fork.id)) {
              return current;
            }
            return [fork as UserFork, ...current];
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  async function onSaveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("");

    if (!isSupabaseConfigured) {
      setError("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart dev server.");
      return;
    }
    if (!userId) {
      setError("Please log in to edit your profile.");
      return;
    }

    setSaving(true);
    const nextForm = normalizeEducationLevel(formLevel);
    let nextAvatarUrl = avatarUrl.trim() || null;

    if (avatarFile) {
      if (!avatarFile.type.startsWith("image/")) {
        setError("Please select a valid image file.");
        setSaving(false);
        return;
      }
      if (avatarFile.size > 5 * 1024 * 1024) {
        setError("Profile picture must be 5MB or smaller.");
        setSaving(false);
        return;
      }

      const ext = avatarFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const safeExt = ext.replace(/[^a-z0-9]/g, "") || "jpg";
      const filePath = `${userId}/${Date.now()}.${safeExt}`;
      const storage = supabase.storage.from("avatars");
      const { error: uploadError } = await storage.upload(filePath, avatarFile, {
        upsert: true,
        contentType: avatarFile.type,
      });

      if (uploadError) {
        setError(uploadError.message);
        setSaving(false);
        return;
      }

      const { data: publicUrlData } = storage.getPublicUrl(filePath);
      nextAvatarUrl = publicUrlData.publicUrl;
    }

    const profilePayload: ProfileInsert = {
      user_id: userId,
      display_name: displayName,
      form: nextForm,
      avatar_url: nextAvatarUrl,
    };

    const { error: upsertError } = await supabase.from("profiles").upsert(
      profilePayload as never,
      { onConflict: "user_id" },
    );

    if (upsertError && upsertError.code !== "PGRST205") {
      setError(upsertError.message);
      setSaving(false);
      return;
    }

    const { error: metadataError } = await supabase.auth.updateUser({
      data: {
        display_name: displayName,
        form: nextForm,
        avatar_url: nextAvatarUrl,
      },
    });

    if (metadataError) {
      setError(metadataError.message);
      setSaving(false);
      return;
    }

    setAvatarUrl(nextAvatarUrl ?? "");
    setAvatarFile(null);
    setStatus("Profile updated successfully.");
    setSaving(false);
  }

  async function onLogout() {
    setError("");
    setStatus("");

    if (!isSupabaseConfigured) {
      setError("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart dev server.");
      return;
    }

    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError(signOutError.message);
      return;
    }

    router.replace("/login");
  }

  async function deleteUploadedResource(resource: StudyMaterial) {
    setError("");
    setStatus("");

    if (!userId) {
      setError("Please log in to delete uploaded resources.");
      return;
    }

    const confirmed = window.confirm(`Delete "${resource.title}"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    setDeletingResourceId(resource.id);

    const { error: deleteError } = await supabase
      .from("materials")
      .delete()
      .eq("id", resource.id)
      .eq("uploaded_by", userId);

    setDeletingResourceId(null);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setUploadedResources((current) => current.filter((item) => item.id !== resource.id));
    setSavedResources((current) => current.filter((item) => item.id !== resource.id));
    setStatus("Resource deleted.");
  }

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">My Profile</h1>
        <p className="text-sm text-foreground/70">Manage your student profile and saved resources.</p>
      </div>

      <Card className="space-y-2">
        <h2 className="font-semibold">Student Details</h2>
        {!isLoggedIn && !loadingProfile ? (
          <p className="text-sm text-foreground/70">
            Please <Link href="/login" className="text-sky-600 hover:text-sky-500">log in</Link> to edit your profile.
          </p>
        ) : null}
        {loadingProfile ? <p className="text-sm text-foreground/70">Loading profile...</p> : null}
        {isLoggedIn ? (
          <form className="space-y-3" onSubmit={onSaveProfile}>
            <Input
              placeholder="Display Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
            <Select value={formLevel} onChange={(e) => setFormLevel(e.target.value)} required>
              {educationLevels.map((level) => (
                <option key={level.value} value={level.value}>
                  {level.label}
                </option>
              ))}
            </Select>
            <div className="space-y-2">
              <label className="text-sm text-foreground/70">Avatar</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
                className="block w-full rounded-xl border bg-background px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-foreground/10 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-foreground/15"
              />
              {avatarFile ? (
                <p className="text-xs text-foreground/70">
                  Selected: {avatarFile.name}
                </p>
              ) : null}
            </div>
            {avatarPreview ? (
              <div className="flex items-center gap-3 rounded-xl border p-3">
                <Image
                  src={avatarPreview}
                  alt="Profile preview"
                  width={56}
                  height={56}
                  className="h-14 w-14 rounded-full object-cover"
                  unoptimized
                />
                <p className="text-xs text-foreground/70">Preview</p>
              </div>
            ) : null}
            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
            {status ? <p className="text-sm text-emerald-600">{status}</p> : null}
            <Button type="submit" disabled={saving || loadingProfile} className="mr-2">
              {saving ? "Saving..." : "Save profile"}
            </Button>
            <Button type="button" variant="outline" onClick={onLogout}>
              Logout
            </Button>
          </form>
        ) : null}
      </Card>

      {isLoggedIn ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/profile/following" className="rounded-2xl transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
            <Card className="h-full rounded-2xl">
              <span className="block text-2xl font-semibold text-foreground">{followingCount}</span>
              <p className="text-sm text-foreground/70">Following</p>
            </Card>
          </Link>
          <Link href="/profile/followers" className="rounded-2xl transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
            <Card className="h-full rounded-2xl">
              <span className="block text-2xl font-semibold text-foreground">{followerCount}</span>
              <p className="text-sm text-foreground/70">Followed by</p>
            </Card>
          </Link>
        </div>
      ) : null}

      {isLoggedIn ? (
        <Card>
          <h2 className="mb-2 font-semibold">Contributions</h2>
          <ContributionGraph activity={contributionActivity} />
        </Card>
      ) : null}

      <Card>
        <h2 className="mb-2 font-semibold">Bookmarked Resources</h2>
        {loadingSavedResources ? (
          <p className="text-sm text-foreground/70">Loading saved resources...</p>
        ) : savedResources.length === 0 ? (
          <p className="text-sm text-foreground/70">No saved resources yet.</p>
        ) : (
          <ul className="space-y-2">
            {savedResources.map((resource) => (
              <li
                key={resource.id}
                className="flex flex-col gap-3 rounded-lg bg-foreground/5 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-foreground">{resource.title}</p>
                  <p className="text-sm text-foreground/70">
                    {resource.subject} • {resource.year} • {resource.origin}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={getMaterialHref(resource)}>
                    <Eye className="h-4 w-4" />
                    View
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Uploaded Resources</h2>
          <Button asChild size="sm">
            <Link href="/resources/upload/">
              <Upload className="h-4 w-4" />
              Upload resource
            </Link>
          </Button>
        </div>
        {loadingUploadedResources ? (
          <p className="text-sm text-foreground/70">Loading uploaded resources...</p>
        ) : uploadedResources.length === 0 ? (
          <p className="text-sm text-foreground/70">No uploaded resources yet.</p>
        ) : (
          <ul className="space-y-2">
            {uploadedResources.map((resource) => {
              return (
                <li key={resource.id} className="rounded-lg bg-foreground/5 px-3 py-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-foreground">{resource.title}</p>
                      <p className="text-sm text-foreground/70">
                        {resource.subject} &bull; {resource.year} &bull; {resource.origin}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={getMaterialHref(resource)}>
                          <Eye className="h-4 w-4" />
                          View
                        </Link>
                      </Button>
                      <Button asChild type="button" size="sm" variant="secondary">
                        <Link href={`/resources/${resource.slug}/edit`}>
                          <Pencil className="h-4 w-4" />
                          Edit
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void deleteUploadedResource(resource)}
                        disabled={deletingResourceId === resource.id}
                      >
                        <Trash2 className="h-4 w-4" />
                        {deletingResourceId === resource.id ? "Deleting..." : "Delete"}
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </section>
  );
}
