"use client";

import { FormEvent, useState } from "react";
import { materialTags } from "@/lib/materials";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Database, MaterialGrade, MaterialTag } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const bucketName = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "resource-attachments";
const uploadText = {
  "auth.formPrefix": "Form {form}",
  "resourceFilters.yearPlaceholder": "Year",
  "search.grade": "Grade",
  "search.origin": "Origin",
  "search.placeholder": "Metadata search",
  "search.submitPlaceholder": "Submit for approval",
  "search.tagsCommaSeparated": "Tags, comma separated",
  "search.uploadMaterial": "Upload Material",
  "search.uploadStudyMaterial": "Upload study material",
  "upload.close": "Close",
  "upload.optionalNotes": "Optional notes",
  "upload.subjectPlaceholder": "Subject",
  "upload.titlePlaceholder": "Title",
} as const;

function t(key: keyof typeof uploadText, values?: { form?: number }) {
  const template = uploadText[key];
  return values?.form ? template.replace("{form}", String(values.form)) : template;
}

function parseTags(value: string): MaterialTag[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length > 0 && materialTags.includes(tag as MaterialTag)),
    ),
  ) as MaterialTag[];
}

function createSlug(title: string) {
  const baseSlug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${baseSlug || "resource"}-${Date.now()}`;
}

export function UploadResourceModal() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [grade, setGrade] = useState<MaterialGrade | "">("");
  const [subject, setSubject] = useState("");
  const [origin, setOrigin] = useState("");
  const [year, setYear] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!isSupabaseConfigured) {
      setError("Unable to submit resource: Supabase is not configured.");
      return;
    }

    if (!file) {
      setError("Please choose a file to upload.");
      return;
    }

    if (!title || !grade || !subject || !origin || !year) {
      setError("Please complete all required fields.");
      return;
    }

    const parsedTags = parseTags(tagInput);
    if (parsedTags.length === 0) {
      setError("Please provide at least one valid tag, e.g. exercise, notes, past-year, trial-paper.");
      return;
    }

    const yearNumber = Number(year);
    if (!Number.isFinite(yearNumber) || yearNumber < 2000 || yearNumber > 2100) {
      setError("Please enter a valid year between 2000 and 2100.");
      return;
    }

    setIsSubmitting(true);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user?.id) {
      setError("You must be logged in to upload resources.");
      setIsSubmitting(false);
      return;
    }

    const uploaderId = user.id;
    const safeFileName = file.name.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9_.-]/g, "");
    const filePath = `${uploaderId}/${Date.now()}-${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, { cacheControl: "3600", upsert: false });

    if (uploadError) {
      setError(uploadError.message);
      setIsSubmitting(false);
      return;
    }

    const publicUrlResponse = await supabase.storage.from(bucketName).getPublicUrl(filePath);
    const publicUrl = publicUrlResponse.data?.publicUrl;

    if (!publicUrl) {
      setError("Unable to generate file URL.");
      setIsSubmitting(false);
      return;
    }

    const pendingMaterial = {
      slug: createSlug(title),
      title,
      core_type: "exercise",
      content_markdown: notes.trim()
        ? `${notes.trim()}\n\n## Attachment\n[Open the attachment](${publicUrl})`
        : `## Attachment\n[Open the attachment](${publicUrl})`,
      grade,
      subject,
      category_tags: parsedTags,
      year: yearNumber,
      origin,
      author_name: user.user_metadata.display_name as string | undefined ?? user.email ?? "Student upload",
      uploaded_by: uploaderId,
    } as Database["public"]["Tables"]["pending_materials"]["Insert"];

    const { error: insertError } = await (supabase.from("pending_materials") as any).insert(pendingMaterial);

    if (insertError) {
      setError(insertError.message);
      setIsSubmitting(false);
      return;
    }

    setMessage("Your upload is pending approval. An admin must approve it before it appears in the library.");
    setTitle("");
    setGrade("");
    setSubject("");
    setOrigin("");
    setYear("");
    setTagInput("");
    setNotes("");
    setFile(null);
    setIsSubmitting(false);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>{t("search.uploadMaterial")}</Button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-lg rounded-[32px] border border-border bg-background p-6 shadow-[0_24px_70px_rgba(0,0,0,0.24)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.18em] text-text-soft">{t("search.placeholder")}</p>
                <h2 className="mt-2 text-2xl text-foreground">{t("search.uploadStudyMaterial")}</h2>
              </div>
              <button
                type="button"
                className="rounded-xl px-3 py-2 text-text-muted hover:bg-surface-muted hover:text-foreground"
                onClick={() => setOpen(false)}
              >
                {t("upload.close")}
              </button>
            </div>
            <form className="space-y-3" onSubmit={handleSubmit}>
              <Input
                placeholder={t("upload.titlePlaceholder")}
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
              <Select required value={grade} onChange={(event) => setGrade(event.target.value as MaterialGrade)}>
                <option value="" disabled>
                  {t("search.grade")}
                </option>
                <option value="f1">{t("auth.formPrefix", { form: 1 })}</option>
                <option value="f2">{t("auth.formPrefix", { form: 2 })}</option>
                <option value="f3">{t("auth.formPrefix", { form: 3 })}</option>
                <option value="f4">{t("auth.formPrefix", { form: 4 })}</option>
                <option value="f5">{t("auth.formPrefix", { form: 5 })}</option>
              </Select>
              <Input
                placeholder={t("upload.subjectPlaceholder")}
                required
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
              />
              <Input
                placeholder={t("search.origin")}
                required
                value={origin}
                onChange={(event) => setOrigin(event.target.value)}
              />
              <Input
                type="number"
                min={2000}
                max={2100}
                placeholder={t("resourceFilters.yearPlaceholder")}
                required
                value={year}
                onChange={(event) => setYear(event.target.value)}
              />
              <Input
                placeholder={`${t("search.tagsCommaSeparated")} (exercise, notes, past-year, trial-paper)`}
                required
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
              />
              <Input
                type="file"
                required
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
              <Textarea
                placeholder={t("upload.optionalNotes")}
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
              {error ? <p className="text-sm text-[#b53333]">{error}</p> : null}
              {message ? <p className="text-sm text-text-muted">{message}</p> : null}
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Uploading..." : t("search.submitPlaceholder")}
              </Button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
