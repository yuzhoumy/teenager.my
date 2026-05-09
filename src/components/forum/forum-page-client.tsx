"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { FileUp, Heart, ImageIcon, MessageSquare, Plus, Reply, Send, Upload, X } from "lucide-react";
import { MarkdownRenderer } from "@/components/resources/markdown-renderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getSupabaseUser, isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { ProfileNameRow } from "@/lib/profile-names";
import type { Database } from "@/types/database";
import type { ForumComment, ForumPost } from "@/types/forum";

/** Use current profiles.display_name instead of stale forum_posts / forum_comments.author_name. */
function applyProfileAuthorNames<T extends { user_id: string | null; author_name: string }>(
  rows: T[],
  profiles: ProfileNameRow[] | null | undefined,
): T[] {
  const map = new Map(
    (profiles ?? [])
      .map((profile) => {
        const name = profile.display_name?.trim();
        return name ? ([profile.user_id, name] as const) : null;
      })
      .filter((entry): entry is readonly [string, string] => entry !== null),
  );
  return rows.map((row) => {
    if (!row.user_id) return row;
    const name = map.get(row.user_id);
    return name ? { ...row, author_name: name } : row;
  });
}

type EditorMode = "edit" | "raw";
type ForumSort = "latest" | "love" | "tag";
type CommentsByPost = Record<string, ForumComment[]>;
type LoveCounts = Record<string, number>;
const bucketName = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "resource-attachments";

const starterMarkdown = "# What are you working through?\n\nShare your question, notes, idea, or study tip here.\n\n- Add context\n- Mention what you have tried\n- Ask for the kind of feedback you want";
const forumTags = ["General", "Homework Help", "Exam Prep", "Notes", "Study Tips", "Subject Question"] as const;
const EmbeddedPdfViewer = dynamic(
  () => import("@/components/resources/embedded-pdf-viewer").then((module) => module.EmbeddedPdfViewer),
  { ssr: false },
);

function isPdfLink(url: string) {
  return /\.pdf($|[?#])/i.test(url);
}

function isImageLink(url: string) {
  return /\.(png|jpe?g|gif|webp|svg|avif)($|[?#])/i.test(url);
}

function markdownLink(label: string, href: string) {
  return `[${label}](${href})`;
}

async function uploadForumAttachment(file: File, userId: string) {
  const safeFileName = file.name.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9_.-]/g, "");
  const filePath = `forum/${userId}/${Date.now()}-${safeFileName}`;
  const { error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(filePath, file, { cacheControl: "3600", upsert: false });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);
  return data.publicUrl;
}

function getAuthorName(user: Awaited<ReturnType<typeof getSupabaseUser>>) {
  if (!user) return "Student";

  const displayName = user.user_metadata.display_name;
  return typeof displayName === "string" && displayName.trim()
    ? displayName.trim()
    : user.email ?? "Student";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function AuthorLink({ userId, name }: { userId: string | null; name: string }) {
  if (!userId) {
    return <span>{name}</span>;
  }

  return (
    <Link href={`/users?userId=${userId}`} className="hover:text-foreground hover:underline">
      {name}
    </Link>
  );
}

function ForumPostEditor({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (post: ForumPost) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState("");
  const [tag, setTag] = useState<(typeof forumTags)[number]>("General");
  const [markdown, setMarkdown] = useState(starterMarkdown);
  const [editorMode, setEditorMode] = useState<EditorMode>("edit");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!isSupabaseConfigured) {
      setError("Supabase is not configured.");
      return;
    }

    const trimmedTitle = title.trim();
    const trimmedMarkdown = markdown.trim();

    if (!trimmedTitle || !tag || !trimmedMarkdown) {
      setError("Please add a title, tag, and post content.");
      return;
    }

    setSubmitting(true);

    try {
      const user = await getSupabaseUser();
      if (!user) {
        throw new Error("Please log in to create a forum post.");
      }

      const payload: Database["public"]["Tables"]["forum_posts"]["Insert"] = {
        user_id: user.id,
        author_name: getAuthorName(user),
        title: trimmedTitle,
        tag,
        markdown: trimmedMarkdown,
      };

      const { data, error: insertError } = await supabase
        .from("forum_posts")
        .insert(payload as never)
        .select("*")
        .single();

      if (insertError) {
        throw insertError;
      }

      onCreated(data as ForumPost);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create this post.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUploadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setError("");
    setUploadingFile(true);

    try {
      if (!isSupabaseConfigured) {
        throw new Error("Supabase is not configured.");
      }

      const user = await getSupabaseUser();
      if (!user) {
        throw new Error("Please log in to upload attachments.");
      }

      const uploadedUrl = await uploadForumAttachment(file, user.id);
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

  const renderPdfLink = (href: string, label: string, index: number) => (
    <div key={`forum-editor-pdf-${href}-${index}`} className="mb-4 overflow-hidden rounded-[20px] border border-[#172033] bg-[#08131f] p-3">
      <p className="mb-3 text-sm font-semibold text-foreground">{label}</p>
      <EmbeddedPdfViewer file={href} />
    </div>
  );

  const renderImageLink = (href: string, label: string, index: number) => (
    <div key={`forum-editor-image-${href}-${index}`} className="mb-4 overflow-hidden rounded-[20px] border border-[#172033] bg-[#08131f] p-3">
      <p className="mb-3 text-sm font-semibold text-foreground">{label}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={href} alt={label} className="h-auto max-h-[640px] w-full rounded-xl bg-[#0b1421] object-contain" />
    </div>
  );

  const pdfCount = Array.from(markdown.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)).filter((match) => isPdfLink(match[2] ?? "")).length;
  const imageCount = Array.from(markdown.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)).filter((match) => isImageLink(match[2] ?? "")).length;

  return (
    <Card className="rounded-[28px] border-border-strong bg-surface-strong p-5">
      <form onSubmit={handleSubmit} className="space-y-5">
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleUploadFile} />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-text-soft">New forum post</p>
            <h2 className="mt-2 text-3xl text-foreground">Start a discussion</h2>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
            Close
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Post title" required />
          <Select value={tag} onChange={(event) => setTag(event.target.value as (typeof forumTags)[number])} required>
            {forumTags.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </div>

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
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1 text-xs font-semibold text-text-muted">
            <FileUp className="h-3.5 w-3.5" />
            {pdfCount} PDF link{pdfCount === 1 ? "" : "s"}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1 text-xs font-semibold text-text-muted">
            <ImageIcon className="h-3.5 w-3.5" />
            {imageCount} image{imageCount === 1 ? "" : "s"}
          </span>
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploadingFile}>
            <Upload className="h-4 w-4" />
            {uploadingFile ? "Uploading..." : "Upload file"}
          </Button>
        </div>

        {editorMode === "edit" ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Textarea
              value={markdown}
              onChange={(event) => setMarkdown(event.target.value)}
              className="min-h-[360px]"
              placeholder="Write with markdown..."
              required
            />
            <div className="min-h-[360px] rounded-[24px] border border-border bg-background p-5">
              <div className="prose-reset markdown-readme max-w-none">
                <MarkdownRenderer markdown={markdown} renderPdfLink={renderPdfLink} renderImageLink={renderImageLink} />
              </div>
            </div>
          </div>
        ) : (
          <Textarea
            value={markdown}
            onChange={(event) => setMarkdown(event.target.value)}
            className="min-h-[420px] font-mono text-sm"
            placeholder="Write raw markdown..."
            required
          />
        )}

        {error ? <p className="text-sm text-[#b53333]">{error}</p> : null}

        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            <Send className="h-4 w-4" />
            {submitting ? "Posting..." : "Publish post"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ForumPostCard({
  post,
  comments,
  loveCount,
  isLoved,
  currentUserId,
  onToggleLove,
  onCommentCreated,
  onPostUpdated,
  onPostDeleted,
}: {
  post: ForumPost;
  comments: ForumComment[];
  loveCount: number;
  isLoved: boolean;
  currentUserId: string | null;
  onToggleLove: (postId: string, isLoved: boolean) => Promise<void>;
  onCommentCreated: (comment: ForumComment) => void;
  onPostUpdated: (postId: string, payload: Pick<ForumPost, "title" | "tag" | "markdown">) => void;
  onPostDeleted: (postId: string) => void;
}) {
  const [editingPost, setEditingPost] = useState(false);
  const [editTitle, setEditTitle] = useState(post.title);
  const [editTag, setEditTag] = useState(post.tag);
  const [editMarkdown, setEditMarkdown] = useState(post.markdown);
  const [updatingPost, setUpdatingPost] = useState(false);
  const [deletingPost, setDeletingPost] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [replyTarget, setReplyTarget] = useState<ForumComment | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [updatingLove, setUpdatingLove] = useState(false);
  const [commentError, setCommentError] = useState("");
  const [postActionError, setPostActionError] = useState("");
  const canManagePost = Boolean(currentUserId && post.user_id === currentUserId);
  const rootComments = comments.filter((comment) => !comment.parent_comment_id);
  const repliesByParent = comments
    .filter((comment) => comment.parent_comment_id)
    .reduce<Record<string, ForumComment[]>>((grouped, comment) => {
      if (!comment.parent_comment_id) return grouped;
      grouped[comment.parent_comment_id] = [...(grouped[comment.parent_comment_id] ?? []), comment];
      return grouped;
    }, {});

  async function handleCommentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCommentError("");

    const trimmedBody = commentBody.trim();
    if (!trimmedBody) {
      setCommentError("Please write a comment first.");
      return;
    }

    if (!isSupabaseConfigured) {
      setCommentError("Supabase is not configured.");
      return;
    }

    setSubmittingComment(true);

    try {
      const user = await getSupabaseUser();
      if (!user) {
        throw new Error("Please log in to comment.");
      }

      const payload: Database["public"]["Tables"]["forum_comments"]["Insert"] = {
        post_id: post.id,
        parent_comment_id: replyTarget?.id ?? null,
        user_id: user.id,
        author_name: getAuthorName(user),
        body: trimmedBody,
      };

      const { data, error } = await supabase
        .from("forum_comments")
        .insert(payload as never)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      onCommentCreated(data as ForumComment);
      setCommentBody("");
      setReplyTarget(null);
    } catch (submitError) {
      setCommentError(submitError instanceof Error ? submitError.message : "Unable to add this comment.");
    } finally {
      setSubmittingComment(false);
    }
  }

  async function handleLoveClick() {
    setUpdatingLove(true);
    try {
      await onToggleLove(post.id, isLoved);
    } finally {
      setUpdatingLove(false);
    }
  }

  function startReply(comment: ForumComment) {
    setReplyTarget(comment);
    setCommentBody((current) => {
      const mention = `@${comment.author_name} `;
      return current.startsWith(mention) ? current : mention;
    });
  }

  async function handlePostUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPostActionError("");

    if (!canManagePost) {
      setPostActionError("You can only edit your own posts.");
      return;
    }

    const trimmedTitle = editTitle.trim();
    const trimmedTag = editTag.trim();
    const trimmedMarkdown = editMarkdown.trim();

    if (!trimmedTitle || !trimmedTag || !trimmedMarkdown) {
      setPostActionError("Please add a title, tag, and post content.");
      return;
    }

    if (!isSupabaseConfigured) {
      setPostActionError("Supabase is not configured.");
      return;
    }

    setUpdatingPost(true);
    try {
      const user = await getSupabaseUser();
      if (!user) {
        throw new Error("Please log in to edit your post.");
      }

      const { error } = await supabase
        .from("forum_posts")
        .update({
          title: trimmedTitle,
          tag: trimmedTag,
          markdown: trimmedMarkdown,
        } as never)
        .eq("id", post.id)
        .eq("user_id", user.id);

      if (error) {
        throw error;
      }

      onPostUpdated(post.id, {
        title: trimmedTitle,
        tag: trimmedTag,
        markdown: trimmedMarkdown,
      });
      setEditingPost(false);
    } catch (updateError) {
      setPostActionError(updateError instanceof Error ? updateError.message : "Unable to update this post.");
    } finally {
      setUpdatingPost(false);
    }
  }

  async function handleDeletePost() {
    setPostActionError("");

    if (!canManagePost) {
      setPostActionError("You can only delete your own posts.");
      return;
    }

    if (!window.confirm("Delete this post? This cannot be undone.")) {
      return;
    }

    if (!isSupabaseConfigured) {
      setPostActionError("Supabase is not configured.");
      return;
    }

    setDeletingPost(true);
    try {
      const user = await getSupabaseUser();
      if (!user) {
        throw new Error("Please log in to delete your post.");
      }

      const { error: deleteCommentsError } = await supabase
        .from("forum_comments")
        .delete()
        .eq("post_id", post.id);
      if (deleteCommentsError) {
        throw deleteCommentsError;
      }

      const { error: deleteLovesError } = await supabase
        .from("forum_post_loves")
        .delete()
        .eq("post_id", post.id);
      if (deleteLovesError) {
        throw deleteLovesError;
      }

      const { error: deletePostError } = await supabase
        .from("forum_posts")
        .delete()
        .eq("id", post.id)
        .eq("user_id", user.id);
      if (deletePostError) {
        throw deletePostError;
      }

      onPostDeleted(post.id);
    } catch (deleteError) {
      setPostActionError(deleteError instanceof Error ? deleteError.message : "Unable to delete this post.");
    } finally {
      setDeletingPost(false);
    }
  }

  function renderComment(comment: ForumComment, isReply = false) {
    const replies = repliesByParent[comment.id] ?? [];

    return (
      <div key={comment.id} className={isReply ? "ml-5 space-y-3 border-l border-border pl-4" : "space-y-3"}>
        <div className="rounded-2xl border border-border bg-background px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">
              <AuthorLink userId={comment.user_id} name={comment.author_name} />
            </p>
            <p className="text-xs uppercase tracking-[0.14em] text-text-soft">{formatDate(comment.created_at)}</p>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm text-text-muted">{comment.body}</p>
          <div className="mt-3">
            <Button type="button" size="sm" variant="ghost" onClick={() => startReply(comment)}>
              <Reply className="h-4 w-4" />
              Reply
            </Button>
          </div>
        </div>
        {replies.map((reply) => renderComment(reply, true))}
      </div>
    );
  }

  const renderPdfLink = (href: string, label: string, index: number) => (
    <div key={`forum-post-pdf-${post.id}-${href}-${index}`} className="mb-4 overflow-hidden rounded-[20px] border border-[#172033] bg-[#08131f] p-3">
      <p className="mb-3 text-sm font-semibold text-foreground">{label}</p>
      <EmbeddedPdfViewer file={href} />
    </div>
  );

  const renderImageLink = (href: string, label: string, index: number) => (
    <div key={`forum-post-image-${post.id}-${href}-${index}`} className="mb-4 overflow-hidden rounded-[20px] border border-[#172033] bg-[#08131f] p-3">
      <p className="mb-3 text-sm font-semibold text-foreground">{label}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={href} alt={label} className="h-auto max-h-[720px] w-full rounded-xl bg-[#0b1421] object-contain" />
    </div>
  );

  return (
    <article id={`forum-post-${post.id}`} className="scroll-mt-28 rounded-[28px] border border-border bg-surface p-5 shadow-[0_4px_24px_var(--shadow)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge>{post.tag}</Badge>
            <span className="text-xs uppercase tracking-[0.14em] text-text-soft">{formatDate(post.created_at)}</span>
          </div>
          <h2 className="text-3xl text-foreground">{post.title}</h2>
          <p className="mt-2 text-sm text-text-muted">
            Posted by <AuthorLink userId={post.user_id} name={post.author_name} />
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant={isLoved ? "secondary" : "outline"} onClick={handleLoveClick} disabled={updatingLove}>
            <Heart className={`h-4 w-4 ${isLoved ? "fill-current" : ""}`} />
            {loveCount}
          </Button>
          <span className="inline-flex items-center gap-2 text-sm text-text-muted">
            <MessageSquare className="h-4 w-4 text-brand" />
            {comments.length}
          </span>
        </div>
      </div>

      <div className="mt-5 border-t border-border pt-5">
        {editingPost ? (
          <form onSubmit={handlePostUpdate} className="space-y-3">
            <Input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} placeholder="Post title" required />
            <Select value={editTag} onChange={(event) => setEditTag(event.target.value)} required>
              {forumTags.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
            <Textarea
              value={editMarkdown}
              onChange={(event) => setEditMarkdown(event.target.value)}
              className="min-h-[260px]"
              required
            />
            {postActionError ? <p className="text-sm text-[#b53333]">{postActionError}</p> : null}
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingPost(false);
                  setEditTitle(post.title);
                  setEditTag(post.tag);
                  setEditMarkdown(post.markdown);
                  setPostActionError("");
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updatingPost}>
                {updatingPost ? "Saving..." : "Save post"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="prose-reset markdown-readme max-w-none">
            <MarkdownRenderer markdown={post.markdown} renderPdfLink={renderPdfLink} renderImageLink={renderImageLink} />
          </div>
        )}
      </div>

      {canManagePost ? (
        <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-border pt-4">
          {!editingPost ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setEditTitle(post.title);
                setEditTag(post.tag);
                setEditMarkdown(post.markdown);
                setPostActionError("");
                setEditingPost(true);
              }}
            >
              Edit post
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="outline" onClick={() => void handleDeletePost()} disabled={deletingPost || editingPost}>
            {deletingPost ? "Deleting..." : "Delete post"}
          </Button>
        </div>
      ) : null}

      {postActionError && !editingPost ? <p className="mt-3 text-sm text-[#b53333]">{postActionError}</p> : null}

      <section className="mt-6 border-t border-border pt-5">
        <h3 className="text-xl text-foreground">Comments</h3>
        <div className="mt-4 space-y-3">
          {rootComments.length > 0 ? (
            rootComments.map((comment) => renderComment(comment))
          ) : (
            <p className="text-sm text-text-muted">No comments yet.</p>
          )}
        </div>

        <form onSubmit={handleCommentSubmit} className="mt-4 space-y-3">
          {replyTarget ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-text-muted">
              <span>
                Replying to <AuthorLink userId={replyTarget.user_id} name={replyTarget.author_name} />
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setReplyTarget(null);
                  setCommentBody("");
                }}
              >
                <X className="h-4 w-4" />
                Clear
              </Button>
            </div>
          ) : null}
          <Textarea
            value={commentBody}
            onChange={(event) => setCommentBody(event.target.value)}
            placeholder="Add a comment..."
            className="min-h-[110px]"
          />
          {commentError ? <p className="text-sm text-[#b53333]">{commentError}</p> : null}
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={submittingComment}>
              <Send className="h-4 w-4" />
              {submittingComment ? "Posting..." : "Comment"}
            </Button>
          </div>
        </form>
      </section>
    </article>
  );
}

export function ForumPageClient() {
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [commentsByPost, setCommentsByPost] = useState<CommentsByPost>({});
  const [loveCounts, setLoveCounts] = useState<LoveCounts>({});
  const [lovedPostIds, setLovedPostIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const [sortMode, setSortMode] = useState<ForumSort>("latest");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const postIds = useMemo(() => posts.map((post) => post.id), [posts]);
  const sortedPosts = useMemo(() => {
    const filteredPosts =
      sortMode === "tag" && selectedTags.length > 0
        ? posts.filter((post) => selectedTags.includes(post.tag))
        : posts;
    const nextPosts = [...filteredPosts];

    if (sortMode === "love") {
      return nextPosts.sort((left, right) => (loveCounts[right.id] ?? 0) - (loveCounts[left.id] ?? 0));
    }

    if (sortMode === "tag") {
      return nextPosts.sort((left, right) => left.tag.localeCompare(right.tag) || right.created_at.localeCompare(left.created_at));
    }

    return nextPosts.sort((left, right) => right.created_at.localeCompare(left.created_at));
  }, [loveCounts, posts, selectedTags, sortMode]);

  useEffect(() => {
    let cancelled = false;

    async function loadPosts() {
      setLoading(true);
      setError("");

      if (!isSupabaseConfigured) {
        setError("Supabase is not configured.");
        setLoading(false);
        return;
      }

      try {
        const { data, error: postsError } = await supabase
          .from("forum_posts")
          .select("*")
          .order("created_at", { ascending: false });

        if (postsError) {
          throw postsError;
        }

        const rawPosts = (data ?? []) as ForumPost[];
        const authorIds = Array.from(new Set(rawPosts.map((post) => post.user_id).filter(Boolean))) as string[];
        let hydratedPosts = rawPosts;
        if (authorIds.length > 0) {
          const { data: profileRows, error: profilesError } = await supabase
            .from("profiles")
            .select("user_id, display_name")
            .in("user_id", authorIds);
          if (profilesError) {
            throw profilesError;
          }
          hydratedPosts = applyProfileAuthorNames(rawPosts, profileRows as ProfileNameRow[]);
        }

        if (!cancelled) {
          setPosts(hydratedPosts);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load forum posts.");
          setPosts([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadPosts();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCurrentUser() {
      const user = await getSupabaseUser();
      if (!cancelled) {
        setCurrentUserId(user?.id ?? null);
      }
    }

    void loadCurrentUser();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadComments() {
      if (!isSupabaseConfigured || postIds.length === 0) {
        setCommentsByPost({});
        return;
      }

      const { data, error: commentsError } = await supabase
        .from("forum_comments")
        .select("*")
        .in("post_id", postIds)
        .order("created_at", { ascending: true });

      if (cancelled) {
        return;
      }

      if (commentsError) {
        setError(commentsError.message);
        return;
      }

      const rawComments = (data ?? []) as ForumComment[];
      const commentAuthorIds = Array.from(new Set(rawComments.map((comment) => comment.user_id).filter(Boolean))) as string[];
      let hydratedComments = rawComments;
      if (commentAuthorIds.length > 0) {
        const { data: profileRows, error: profilesError } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", commentAuthorIds);
        if (profilesError) {
          setError(profilesError.message);
          return;
        }
        hydratedComments = applyProfileAuthorNames(rawComments, profileRows as ProfileNameRow[]);
      }

      const nextComments = hydratedComments.reduce<CommentsByPost>((grouped, comment) => {
        grouped[comment.post_id] = [...(grouped[comment.post_id] ?? []), comment];
        return grouped;
      }, {});

      setCommentsByPost(nextComments);
    }

    void loadComments();

    return () => {
      cancelled = true;
    };
  }, [postIds.join("|")]);

  useEffect(() => {
    let cancelled = false;

    async function loadLoves() {
      if (!isSupabaseConfigured || postIds.length === 0) {
        setLoveCounts({});
        setLovedPostIds(new Set());
        return;
      }

      const user = await getSupabaseUser();
      const { data, error: lovesError } = await supabase
        .from("forum_post_loves")
        .select("post_id, user_id")
        .in("post_id", postIds);

      if (cancelled) {
        return;
      }

      if (lovesError) {
        setError(lovesError.message);
        return;
      }

      const loveRows = (data ?? []) as Array<Pick<Database["public"]["Tables"]["forum_post_loves"]["Row"], "post_id" | "user_id">>;
      const nextCounts = loveRows.reduce<LoveCounts>((counts, row) => {
        counts[row.post_id] = (counts[row.post_id] ?? 0) + 1;
        return counts;
      }, {});
      const nextLovedIds = new Set(loveRows.filter((row) => row.user_id === user?.id).map((row) => row.post_id));

      setLoveCounts(nextCounts);
      setLovedPostIds(nextLovedIds);
    }

    void loadLoves();

    return () => {
      cancelled = true;
    };
  }, [postIds.join("|")]);

  useEffect(() => {
    if (typeof window === "undefined" || loading || posts.length === 0) {
      return;
    }

    const rawHash = window.location.hash.replace(/^#/, "");
    if (!rawHash.startsWith("forum-post-")) {
      return;
    }

    const timer = window.setTimeout(() => {
      document.getElementById(rawHash)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);

    return () => window.clearTimeout(timer);
  }, [loading, posts.length]);

  function handlePostCreated(post: ForumPost) {
    void (async () => {
      let nextPost = post;
      if (post.user_id) {
        const { data: profileRows } = await supabase.from("profiles").select("user_id, display_name").eq("user_id", post.user_id).maybeSingle();
        nextPost = applyProfileAuthorNames([post], profileRows ? [profileRows as ProfileNameRow] : [])[0] ?? post;
      }
      setPosts((current) => [nextPost, ...current]);
      setCommentsByPost((current) => ({ ...current, [nextPost.id]: [] }));
      setLoveCounts((current) => ({ ...current, [nextPost.id]: 0 }));
      setIsComposing(false);
    })();
  }

  function handleCommentCreated(comment: ForumComment) {
    void (async () => {
      let nextComment = comment;
      if (comment.user_id) {
        const { data: profileRows } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .eq("user_id", comment.user_id)
          .maybeSingle();
        nextComment = applyProfileAuthorNames([comment], profileRows ? [profileRows as ProfileNameRow] : [])[0] ?? comment;
      }
      setCommentsByPost((current) => ({
        ...current,
        [nextComment.post_id]: [...(current[nextComment.post_id] ?? []), nextComment],
      }));
    })();
  }

  function handlePostUpdated(postId: string, payload: Pick<ForumPost, "title" | "tag" | "markdown">) {
    setPosts((current) => current.map((post) => (post.id === postId ? { ...post, ...payload } : post)));
  }

  function handlePostDeleted(postId: string) {
    setPosts((current) => current.filter((post) => post.id !== postId));
    setCommentsByPost((current) => {
      const next = { ...current };
      delete next[postId];
      return next;
    });
    setLoveCounts((current) => {
      const next = { ...current };
      delete next[postId];
      return next;
    });
    setLovedPostIds((current) => {
      const next = new Set(current);
      next.delete(postId);
      return next;
    });
  }

  async function toggleLove(postId: string, isLoved: boolean) {
    setError("");

    if (!isSupabaseConfigured) {
      setError("Supabase is not configured.");
      return;
    }

    const user = await getSupabaseUser();
    if (!user) {
      setError("Please log in to love posts.");
      return;
    }

    if (isLoved) {
      const { error: deleteError } = await supabase
        .from("forum_post_loves")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", user.id);

      if (deleteError) {
        setError(deleteError.message);
        return;
      }

      setLikedState(postId, false);
      return;
    }

    const payload: Database["public"]["Tables"]["forum_post_loves"]["Insert"] = {
      post_id: postId,
      user_id: user.id,
    };
    const { error: insertError } = await supabase
      .from("forum_post_loves")
      .upsert(payload as never, { onConflict: "post_id,user_id", ignoreDuplicates: true });

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setLikedState(postId, true);
  }

  function setLikedState(postId: string, isLoved: boolean) {
    setLovedPostIds((current) => {
      const next = new Set(current);
      if (isLoved) {
        next.add(postId);
      } else {
        next.delete(postId);
      }
      return next;
    });
    setLoveCounts((current) => ({
      ...current,
      [postId]: Math.max(0, (current[postId] ?? 0) + (isLoved ? 1 : -1)),
    }));
  }

  function toggleTagFilter(tag: string) {
    setSelectedTags((current) =>
      current.includes(tag)
        ? current.filter((entry) => entry !== tag)
        : [...current, tag],
    );
  }

  return (
    <section className="space-y-6">
      <div className="rounded-[30px] border border-border bg-surface p-6 shadow-[0_4px_24px_var(--shadow)] sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Student forum</p>
            <h1 className="mt-2 text-4xl text-foreground sm:text-5xl">Forum</h1>
            <p className="mt-3 max-w-3xl text-base text-text-muted">
              Share study questions, markdown notes, and replies with other students.
            </p>
          </div>
          <Button onClick={() => setIsComposing(true)}>
            <Plus className="h-4 w-4" />
            Create new post
          </Button>
        </div>
      </div>

      {isComposing ? <ForumPostEditor onCancel={() => setIsComposing(false)} onCreated={handlePostCreated} /> : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-border bg-surface p-4 shadow-[0_4px_24px_var(--shadow)]">
        <p className="text-sm text-text-muted">
          {sortedPosts.length} of {posts.length} post{posts.length === 1 ? "" : "s"}
        </p>
        <div className="flex items-center gap-2">
          <label htmlFor="forum-sort" className="text-sm font-medium text-text-muted">
            Sort
          </label>
          <Select id="forum-sort" value={sortMode} onChange={(event) => setSortMode(event.target.value as ForumSort)} className="w-[180px]">
            <option value="latest">Latest</option>
            <option value="love">Highest love</option>
            <option value="tag">Tag</option>
          </Select>
        </div>
      </div>

      {sortMode === "tag" ? (
        <div className="rounded-[24px] border border-border bg-surface p-4 shadow-[0_4px_24px_var(--shadow)]">
          <div className="flex flex-wrap items-center gap-3">
            {forumTags.map((tag) => (
              <label
                key={tag}
                className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 text-sm text-text-muted transition hover:border-foreground hover:text-foreground"
              >
                <input
                  type="checkbox"
                  checked={selectedTags.includes(tag)}
                  onChange={() => toggleTagFilter(tag)}
                  className="h-4 w-4 accent-[var(--brand)]"
                />
                {tag}
              </label>
            ))}
            {selectedTags.length > 0 ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedTags([])}>
                Clear
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-[28px] border border-[#e7c3b8] bg-[#fff4f0] p-5 text-sm text-[#b53333]">
          {error}{" "}
          {!isSupabaseConfigured ? (
            <Link href="/login" className="font-semibold underline">
              Check login setup
            </Link>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-[28px] border border-border bg-surface p-8 text-center shadow-[0_4px_24px_var(--shadow)]">
          <h2 className="text-3xl text-foreground">Loading posts</h2>
          <p className="mt-3 text-sm text-text-muted">Please wait while the forum opens.</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-[28px] border border-border bg-surface p-8 text-center shadow-[0_4px_24px_var(--shadow)]">
          <h2 className="text-3xl text-foreground">No posts yet</h2>
          <p className="mt-3 text-sm text-text-muted">Create the first discussion for the forum.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {sortedPosts.map((post) => (
            <ForumPostCard
              key={post.id}
              post={post}
              comments={commentsByPost[post.id] ?? []}
              loveCount={loveCounts[post.id] ?? 0}
              isLoved={lovedPostIds.has(post.id)}
              currentUserId={currentUserId}
              onToggleLove={toggleLove}
              onCommentCreated={handleCommentCreated}
              onPostUpdated={handlePostUpdated}
              onPostDeleted={handlePostDeleted}
            />
          ))}
        </div>
      )}
    </section>
  );
}
