"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { Heart, MessageSquare, Plus, Reply, Send, X } from "lucide-react";
import { MarkdownRenderer } from "@/components/resources/markdown-renderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getSupabaseUser, isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";
import type { ForumComment, ForumPost } from "@/types/forum";

type EditorMode = "edit" | "raw";
type ForumSort = "latest" | "love" | "tag";
type CommentsByPost = Record<string, ForumComment[]>;
type LoveCounts = Record<string, number>;

const starterMarkdown = "# What are you working through?\n\nShare your question, notes, idea, or study tip here.\n\n- Add context\n- Mention what you have tried\n- Ask for the kind of feedback you want";
const forumTags = ["General", "Homework Help", "Exam Prep", "Notes", "Study Tips", "Subject Question"] as const;

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
  const [title, setTitle] = useState("");
  const [tag, setTag] = useState<(typeof forumTags)[number]>("General");
  const [markdown, setMarkdown] = useState(starterMarkdown);
  const [editorMode, setEditorMode] = useState<EditorMode>("edit");
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

  return (
    <Card className="rounded-[28px] border-border-strong bg-surface-strong p-5">
      <form onSubmit={handleSubmit} className="space-y-5">
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
                <MarkdownRenderer markdown={markdown} />
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
  onToggleLove,
  onCommentCreated,
}: {
  post: ForumPost;
  comments: ForumComment[];
  loveCount: number;
  isLoved: boolean;
  onToggleLove: (postId: string, isLoved: boolean) => Promise<void>;
  onCommentCreated: (comment: ForumComment) => void;
}) {
  const [commentBody, setCommentBody] = useState("");
  const [replyTarget, setReplyTarget] = useState<ForumComment | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [updatingLove, setUpdatingLove] = useState(false);
  const [commentError, setCommentError] = useState("");
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
        <div className="prose-reset markdown-readme max-w-none">
          <MarkdownRenderer markdown={post.markdown} />
        </div>
      </div>

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

        if (!cancelled) {
          setPosts((data ?? []) as ForumPost[]);
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

      const nextComments = ((data ?? []) as ForumComment[]).reduce<CommentsByPost>((grouped, comment) => {
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
    setPosts((current) => [post, ...current]);
    setCommentsByPost((current) => ({ ...current, [post.id]: [] }));
    setLoveCounts((current) => ({ ...current, [post.id]: 0 }));
    setIsComposing(false);
  }

  function handleCommentCreated(comment: ForumComment) {
    setCommentsByPost((current) => ({
      ...current,
      [comment.post_id]: [...(current[comment.post_id] ?? []), comment],
    }));
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
              onToggleLove={toggleLove}
              onCommentCreated={handleCommentCreated}
            />
          ))}
        </div>
      )}
    </section>
  );
}
