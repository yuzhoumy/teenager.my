"use client";

import { Download } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { isValidSchool, schoolOptions } from "@/lib/schools";
import type { Database } from "@/types/database";
import type { StudyMaterial } from "@/types/resource";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const placeholderUploads = [
  "Form 3 Science Notes - Chapter 6",
  "Form 1 BM Notes - Tatabahasa",
];

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type MaterialBookmarkRow = Database["public"]["Tables"]["material_bookmarks"]["Row"];
type MaterialRow = Database["public"]["Tables"]["materials"]["Row"];
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
  const [school, setSchool] = useState("");
  const [formLevel, setFormLevel] = useState("1");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [savedResources, setSavedResources] = useState<StudyMaterial[]>([]);
  const [loadingSavedResources, setLoadingSavedResources] = useState(false);

  const avatarPreview = useMemo(() => avatarUrl.trim(), [avatarUrl]);

  useEffect(() => {
    async function loadProfile() {
      setLoadingProfile(true);
      setError("");
      setStatus("");

      if (!isSupabaseConfigured) {
      setError("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart dev server.");
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

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("display_name, school, form, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();

      const profile = profileData as Pick<ProfileRow, "display_name" | "school" | "form" | "avatar_url"> | null;

      if (profileError) {
        if (profileError.code !== "PGRST205") {
          setError(profileError.message);
          setLoadingProfile(false);
          return;
        }
      }

      setDisplayName(profile?.display_name ?? (user.user_metadata.display_name as string | undefined) ?? "");
      setSchool(profile?.school ?? (user.user_metadata.school as string | undefined) ?? "");
      setFormLevel(String(profile?.form ?? (user.user_metadata.form as number | undefined) ?? 1));
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
        setLoadingSavedResources(false);
        setLoadingProfile(false);
        return;
      }

      const { data: materialsData, error: materialsError } = await supabase
        .from("materials")
        .select("*")
        .in("id", materialIds)
        .order("year", { ascending: false })
        .order("created_at", { ascending: false });

      if (materialsError) {
        setError(materialsError.message);
        setLoadingSavedResources(false);
        setLoadingProfile(false);
        return;
      }

      const materials = (materialsData ?? []) as MaterialRow[];
      setSavedResources(materials as StudyMaterial[]);
      setLoadingSavedResources(false);
      setLoadingProfile(false);
    }

    void loadProfile();
  }, [router]);

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
    if (!isValidSchool(school)) {
      setError("Please select a school from the list.");
      return;
    }

    setSaving(true);
    const nextForm = Number(formLevel);
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
      school,
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
        school,
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
            <Input
              list="school-options"
              placeholder="School"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              required
            />
            <datalist id="school-options">
              {schoolOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
            <Select value={formLevel} onChange={(e) => setFormLevel(e.target.value)} required>
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>
                  Form {value}
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
            <Button type="submit" disabled={saving || loadingProfile}>
              {saving ? "Saving..." : "Save profile"}
            </Button>
            <Button type="button" variant="outline" onClick={onLogout}>
              Logout
            </Button>
          </form>
        ) : null}
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Rewards / Streaks</h2>
          <Badge className="bg-foreground/10 text-foreground/70">Coming Soon</Badge>
        </div>
        {/* TODO: Hook streak logic from profile engagement events */}
        <p className="text-sm text-foreground/70">Streak UI placeholder for Phase 1. Logic and rewards tracking come in next phase.</p>
      </Card>

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
                <Button asChild size="sm">
                  <a href={resource.file_url}>
                    <Download className="h-4 w-4" />
                    Download
                  </a>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold">Uploaded Resources</h2>
        <ul className="space-y-2 text-sm text-foreground/70">
          {placeholderUploads.map((item) => (
            <li key={item} className="rounded-lg bg-foreground/5 px-3 py-2">
              {item}
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
