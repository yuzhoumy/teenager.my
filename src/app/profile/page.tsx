"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { usePreferences } from "@/components/preferences/preferences-provider";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const placeholderBookmarks = [
  "SPM Trial Add Maths 2024 - Johor",
  "English Writing Notes - SPM",
];

const placeholderUploads = [
  "Form 3 Science Notes - Chapter 6",
  "Form 1 BM Notes - Tatabahasa",
];

export default function ProfilePage() {
  const router = useRouter();
  const { t } = usePreferences();
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

  const avatarPreview = useMemo(() => avatarUrl.trim(), [avatarUrl]);

  useEffect(() => {
    async function loadProfile() {
      setLoadingProfile(true);
      setError("");
      setStatus("");

      if (!isSupabaseConfigured) {
        setError(t("auth.configError"));
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

      const db = supabase as any;
      const { data: profile, error: profileError } = await db
        .from("profiles")
        .select("display_name, school, form, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();

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
      setLoadingProfile(false);
    }

    void loadProfile();
  }, [router, t]);

  async function onSaveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("");

    if (!isSupabaseConfigured) {
      setError(t("auth.configError"));
      return;
    }
    if (!userId) {
      setError("Please log in to edit your profile.");
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

    const db = supabase as any;
    const { error: upsertError } = await db.from("profiles").upsert(
      {
        user_id: userId,
        display_name: displayName,
        school,
        form: nextForm,
        avatar_url: nextAvatarUrl,
      },
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
      setError(t("auth.configError"));
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
        <h1 className="text-2xl font-bold">{t("profile.title")}</h1>
        <p className="text-sm text-foreground/70">{t("profile.subtitle")}</p>
      </div>

      <Card className="space-y-2">
        <h2 className="font-semibold">{t("profile.studentDetails")}</h2>
        {!isLoggedIn && !loadingProfile ? (
          <p className="text-sm text-foreground/70">
            Please <Link href="/login" className="text-sky-600 hover:text-sky-500">log in</Link> to edit your profile.
          </p>
        ) : null}
        {loadingProfile ? <p className="text-sm text-foreground/70">Loading profile...</p> : null}
        {isLoggedIn ? (
          <form className="space-y-3" onSubmit={onSaveProfile}>
            <Input
              placeholder={t("profile.displayNameLabel")}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
            <Input
              placeholder={t("profile.schoolLabel")}
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              required
            />
            <Select value={formLevel} onChange={(e) => setFormLevel(e.target.value)} required>
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>
                  {t("auth.formPrefix", { form: value })}
                </option>
              ))}
            </Select>
            <div className="space-y-2">
              <label className="text-sm text-foreground/70">{t("profile.avatarLabel")}</label>
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
          <h2 className="font-semibold">{t("profile.rewardsStreaks")}</h2>
          <Badge className="bg-foreground/10 text-foreground/70">{t("nav.comingSoon")}</Badge>
        </div>
        {/* TODO: Hook streak logic from profile engagement events */}
        <p className="text-sm text-foreground/70">{t("profile.streakPlaceholder")}</p>
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold">{t("profile.bookmarkedResources")}</h2>
        <ul className="space-y-2 text-sm text-foreground/70">
          {placeholderBookmarks.map((item) => (
            <li key={item} className="rounded-lg bg-foreground/5 px-3 py-2">
              {item}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold">{t("profile.uploadedResources")}</h2>
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
