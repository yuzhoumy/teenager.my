"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileUp, ImageIcon, LoaderCircle, Upload, X } from "lucide-react";
import Link from "next/link";
import { getMaterialFacets, materialGradeLabels, materialSubjects, materialTags, getMaterialTagLabel } from "@/lib/materials";
import { getSupabaseUser, isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Database, MaterialGrade, MaterialTag } from "@/types/database";
import type { StudyMaterial } from "@/types/resource";
import { MarkdownRenderer } from "@/components/resources/markdown-renderer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const EmbeddedPdfViewer = dynamic(
  () => import("@/components/resources/embedded-pdf-viewer").then((module) => module.EmbeddedPdfViewer),
  { ssr: false },
);

type EditorMode = "edit" | "raw";

const bucketName = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "resource-attachments";
const currentYear = new Date().getFullYear();
const initialMarkdown = "# Click to edit title\n\nClick to edit text. You can use markdown to format the content. Upload a file by clicking \"Upload File\" button at the top. You can upload multiple files and place the links anywhere in the content.\n\n---\n\n";

function createSlug(title: string) {
  const baseSlug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${baseSlug || "resource"}-${Date.now()}`;
}

function isPdfLink(url: string) {
  return /\.pdf($|[?#])/i.test(url);
}

function isImageLink(url: string) {
  return /\.(png|jpe?g|gif|webp|svg|avif)($|[?#])/i.test(url);
}

function markdownLink(label: string, href: string) {
  return `[${label}](${href})`;
}

function removeMarkdownLinkByHref(content: string, href: string) {
  const pattern = /\[([^\]]+)\]\(([^)]+)\)/g;

  for (const match of content.matchAll(pattern)) {
    const linkHref = match[2]?.trim() ?? "";
    if (linkHref !== href) {
      continue;
    }

    const start = match.index ?? 0;
    const end = start + match[0].length;
    return `${content.slice(0, start)}${content.slice(end)}`
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  return content;
}

async function uploadResourceAttachment(file: File, userId: string) {
  const safeFileName = file.name.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9_.-]/g, "");
  const filePath = `resources/${userId}/${Date.now()}-${safeFileName}`;
  const { error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(filePath, file, { cacheControl: "3600", upsert: false });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);
  return data.publicUrl;
}

type UploadResourceWorkspaceProps = {
  mode?: "create" | "edit";
  initialMaterial?: StudyMaterial;
};

export function UploadResourceWorkspace({ mode = "create", initialMaterial }: UploadResourceWorkspaceProps = {}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState(initialMaterial?.title ?? "");
  const [grade, setGrade] = useState<MaterialGrade | "">(initialMaterial?.grade ?? "");
  const [subject, setSubject] = useState(initialMaterial?.subject ?? "");
  const [origin, setOrigin] = useState(initialMaterial?.origin ?? "");
  const [year, setYear] = useState(String(initialMaterial?.year ?? currentYear));
  const [selectedTag, setSelectedTag] = useState<MaterialTag | "">(initialMaterial?.category_tags[0] ?? "");
  const [markdown, setMarkdown] = useState(initialMaterial?.content_markdown ?? initialMarkdown);
  const [editorMode, setEditorMode] = useState<EditorMode>("edit");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [subjectOptions, setSubjectOptions] = useState<string[]>([...materialSubjects]);

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      try {
        const facets = await getMaterialFacets();
        if (cancelled) {
          return;
        }

        const nextSubjects = facets.subjects.map((option) => option.value).filter(Boolean);
        setSubjectOptions(nextSubjects.length > 0 ? nextSubjects : [...materialSubjects]);
      } catch {
        if (!cancelled) {
          setSubjectOptions([...materialSubjects]);
        }
      }
    }

    void loadOptions();

    return () => {
      cancelled = true;
    };
  }, []);

  function selectTag(tag: MaterialTag) {
    setSelectedTag(tag);
    if (tag !== "trial-paper" && tag !== "exam-paper") {
      setOrigin("");
    }
  }

  async function handleUploadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setError("");
    setMessage("");
    setUploadingFile(true);

    try {
      if (!isSupabaseConfigured) {
        throw new Error("Supabase is not configured.");
      }

      const user = await getSupabaseUser();
      if (!user) {
        throw new Error("Please log in to upload attachments.");
      }

      const uploadedUrl = await uploadResourceAttachment(file, user.id);
      const nextLink = markdownLink(file.name, uploadedUrl);
      setMarkdown((current) => {
        const trimmed = current.trim();
        return trimmed ? `${trimmed}\n\n${nextLink}` : nextLink;
      });
      setEditorMode("edit");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload attachment.");
    } finally {
      setUploadingFile(false);
    }
  }

  async function handleSubmitResource() {
    setError("");
    setMessage("");

    if (!isSupabaseConfigured) {
      setError("Unable to submit resource: Supabase is not configured.");
      return;
    }

    const trimmedTitle = title.trim();
    const trimmedSubject = subject.trim();
    const trimmedOrigin = origin.trim();
    const trimmedMarkdown = markdown.trim();
    const yearNumber = Number(year);
    const needsOrigin = selectedTag === "trial-paper" || selectedTag === "exam-paper";

    if (!trimmedTitle || !grade || !trimmedSubject || !selectedTag) {
      setError("Please complete the title, grade, subject, and tag.");
      return;
    }

    if (needsOrigin && !trimmedOrigin) {
      setError(selectedTag === "exam-paper" ? "Please enter the school name." : "Please enter the origin state or district.");
      return;
    }

    if (!Number.isFinite(yearNumber) || yearNumber < 1900 || yearNumber > 2100) {
      setError("Please enter a valid year between 1900 and 2100.");
      return;
    }

    if (!trimmedMarkdown) {
      setError("Please write the resource content before submitting.");
      return;
    }

    setSubmitting(true);

    try {
      const user = await getSupabaseUser();
      if (!user) {
        throw new Error("Please log in to submit resources.");
      }

      const authorName =
        typeof user.user_metadata.display_name === "string" && user.user_metadata.display_name.trim()
          ? user.user_metadata.display_name.trim()
          : user.email ?? "Student upload";

      if (mode === "edit") {
        if (!initialMaterial) {
          throw new Error("Missing resource information for edit mode.");
        }

        const updatePayload: Database["public"]["Tables"]["materials"]["Update"] = {
          title: trimmedTitle,
          content_markdown: trimmedMarkdown,
          grade,
          subject: trimmedSubject,
          category_tags: [selectedTag],
          year: yearNumber,
          origin: needsOrigin ? trimmedOrigin : "General",
          author_name: authorName,
        };

        const { error: updateError } = await supabase
          .from("materials")
          .update(updatePayload as never)
          .eq("id", initialMaterial.id)
          .eq("uploaded_by", user.id)
          .select("id")
          .single();

        if (updateError) {
          throw updateError;
        }
      } else {
        const pendingMaterial: Database["public"]["Tables"]["pending_materials"]["Insert"] = {
          slug: createSlug(trimmedTitle),
          title: trimmedTitle,
          core_type: "exercise",
          content_markdown: trimmedMarkdown,
          grade,
          subject: trimmedSubject,
          category_tags: [selectedTag],
          year: yearNumber,
          origin: needsOrigin ? trimmedOrigin : "General",
          author_name: authorName,
          uploaded_by: user.id,
        };

        const { error: insertError } = await supabase.from("pending_materials").insert(pendingMaterial as never);
        if (insertError) {
          throw insertError;
        }
      }

      router.push(mode === "edit" && initialMaterial ? `/resources/${initialMaterial.slug}` : "/resources");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : `Unable to ${mode === "edit" ? "update" : "submit"} resource.`);
    } finally {
      setSubmitting(false);
    }
  }

  const editorModeToggle = (
    <div className="inline-flex rounded-full border border-border bg-surface p-1">
      {(["edit", "raw"] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            editorMode === mode
              ? "bg-foreground text-background"
              : "text-text-muted hover:text-foreground"
          }`}
          onClick={() => setEditorMode(mode)}
        >
          {mode === "edit" ? "Edit" : "Raw"}
        </button>
      ))}
    </div>
  );

  const renderPdfLink = (href: string, label: string, index: number) => (
    <div key={`upload-pdf-${href}-${index}`} className="-mx-2 mb-3 w-auto min-w-0 max-w-[calc(100vw-1rem)] overflow-hidden border border-[#172033] bg-[#08131f] sm:mx-0 sm:mb-6 sm:max-w-full sm:rounded-[28px] sm:border-border sm:p-5">
      <div className="flex min-w-0 max-w-full flex-wrap items-start justify-between gap-2 px-2 py-2 sm:mb-4 sm:gap-3 sm:px-0 sm:py-0">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="text-sm text-text-muted">PDF attachment rendered inline where this link appears.</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-9 w-9 p-0"
          onClick={() => setMarkdown((current) => removeMarkdownLinkByHref(current, href))}
          aria-label={`Remove ${label} PDF attachment`}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="overflow-hidden border-t border-[#172033] bg-[#0b1421] sm:rounded-[24px] sm:border-0">
        <EmbeddedPdfViewer file={href} />
      </div>
    </div>
  );

  const renderImageLink = (href: string, label: string, index: number) => (
    <div key={`upload-image-${href}-${index}`} className="mb-6 rounded-[28px] border border-border bg-[#08131f] p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="text-sm text-text-muted">Image attachment rendered inline where this link appears.</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-9 w-9 p-0"
          onClick={() => setMarkdown((current) => removeMarkdownLinkByHref(current, href))}
          aria-label={`Remove ${label} image attachment`}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#09101b]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={href} alt={label} className="h-auto max-h-[720px] w-full bg-[#0b1421] object-contain" />
      </div>
    </div>
  );

  const pdfCount = Array.from(markdown.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)).filter((match) => isPdfLink(match[2] ?? "")).length;
  const imageCount = Array.from(markdown.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)).filter((match) => isImageLink(match[2] ?? "")).length;

  return (
    <section className="space-y-6">
      <Link href="/resources" className="inline-flex items-center gap-2 text-sm font-medium text-text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Back to resources
      </Link>

      <div className="min-w-0 max-w-full overflow-hidden rounded-[24px] border border-border bg-surface p-3 sm:rounded-[32px] sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Upload workspace</p>
            <h1 className="mt-2 text-3xl text-foreground sm:text-4xl">{mode === "edit" ? "Edit resource" : "New resource editor"}</h1>
          </div>
          <Button type="button" variant="default" onClick={handleSubmitResource} disabled={submitting}>
            {submitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {submitting ? (mode === "edit" ? "Saving..." : "Submitting...") : (mode === "edit" ? "Save changes" : "Submit for approval")}
          </Button>
        </div>

        {error ? <p className="mb-4 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}
        {message ? <p className="mb-4 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-text-muted">{message}</p> : null}

        <div className="min-w-0 max-w-full overflow-hidden rounded-[24px] border border-border bg-background p-3 sm:rounded-[32px] sm:p-6">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleUploadFile}
          />

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Resource editor</p>
              <p className="mt-1 text-sm text-text-muted">
                Note: Admin will amend the resource before publishing if there are any mistakes.<br />
                teenager.my is not responsible for the content uploaded by students. Please make sure to follow the <a href="/community-guidelines" className="text-blue-500 hover:underline">community guidelines</a> when uploading resources.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-surface-strong px-3 py-1 text-xs font-semibold text-text-muted">
                <FileUp className="h-3.5 w-3.5" />
                {pdfCount} PDF link{pdfCount === 1 ? "" : "s"}
              </span>

              <span className="inline-flex items-center gap-2 rounded-full bg-surface-strong px-3 py-1 text-xs font-semibold text-text-muted">
                <ImageIcon className="h-3.5 w-3.5" />
                {imageCount} image{imageCount === 1 ? "" : "s"}
              </span>

              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploadingFile}>
                <Upload className="mr-2 h-4 w-4" />
                {uploadingFile ? "Uploading..." : "Upload file"}
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 rounded-[20px] border border-border bg-surface p-3 sm:mt-6 sm:rounded-[24px] sm:p-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Title</p>
                <p className="text-xs font-medium text-text-soft">Required</p>
              </div>
              <Textarea
                className="mt-3 min-h-16 border border-border bg-background text-lg"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Add a title for this resource..."
                aria-required="true"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <Select required value={grade} onChange={(event) => setGrade(event.target.value as MaterialGrade)}>
                <option value="" disabled>Grade</option>
                {Object.entries(materialGradeLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
              <Input
                placeholder="Year"
                type="number"
                min={1900}
                max={2100}
                value={year}
                onChange={(event) => setYear(event.target.value)}
              />
            </div>

            <Select
              required
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            >
              <option value="" disabled>Subject</option>
              {subjectOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </Select>
            {selectedTag === "trial-paper" || selectedTag === "exam-paper" ? (
              <div>
                <p className="mb-2 text-sm uppercase tracking-[0.18em] text-text-soft">
                  {selectedTag === "exam-paper" ? "School Name" : "Origin state/district"}
                </p>
                <Input
              required
                  placeholder={selectedTag === "exam-paper" ? "Enter school name" : "Enter state or district"}
              value={origin}
              onChange={(event) => setOrigin(event.target.value)}
                />
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-background px-3 py-3 text-sm text-text-muted">
                Origin is only required for Trial Paper and Exam Paper.
              </div>
            )}

            <div className="lg:col-span-2">
              <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Tags</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {materialTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${
                      selectedTag === tag
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background text-text-muted hover:border-foreground hover:text-foreground"
                    }`}
                    onClick={() => selectTag(tag)}
                  >
                    {getMaterialTagLabel(tag)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {editorMode === "edit" ? (
            <div className="mt-4 sm:mt-6">
              <div className="min-w-0 max-w-full overflow-hidden rounded-[20px] border border-border bg-surface p-2 sm:rounded-[24px] sm:p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Preview</p>
                  {editorModeToggle}
                </div>
                <div className="mt-2 min-w-0 max-w-full sm:mt-4">
                  <MarkdownRenderer
                    markdown={markdown}
                    editable
                    onMarkdownChange={setMarkdown}
                    renderPdfLink={renderPdfLink}
                    renderImageLink={renderImageLink}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-[20px] border border-border bg-surface p-3 sm:mt-6 sm:rounded-[24px] sm:p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Raw markdown</p>
                {editorModeToggle}
              </div>
              <p className="mt-2 text-sm text-text-muted">Edit the source directly when you need exact markdown control.</p>
              <Textarea
                className="mt-4 min-h-[620px] border border-border bg-[#0e1118] text-white"
                value={markdown}
                onChange={(event) => setMarkdown(event.target.value)}
                placeholder="Write the resource in markdown..."
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
