"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MessageSquareText } from "lucide-react";
import type { DiscussionPost } from "@/types/resource";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

async function attachAuthors(posts: DiscussionPost[]) {
  const userIds = Array.from(new Set(posts.map((post) => post.user_id).filter(Boolean))) as string[];

  if (userIds.length === 0) {
    return posts;
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, display_name")
    .in("user_id", userIds);

  const typedProfiles = (profiles ?? []) as Array<{ user_id: string; display_name: string }>;
  const authorNames = new Map(typedProfiles.map((profile) => [profile.user_id, profile.display_name]));

  return posts.map((post) => ({
    ...post,
    author_name: post.user_id ? authorNames.get(post.user_id) ?? "Unknown author" : "Unknown author",
  }));
}

export function ResourceDiscussionThread({ materialId }: { materialId: string }) {
  const [posts, setPosts] = useState<DiscussionPost[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const composerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPosts() {
      if (!isSupabaseConfigured) {
        setLoading(false);
        return;
      }

      const { data, error: discussionError } = await supabase
        .from("material_discussions")
        .select("*")
        .eq("material_id", materialId)
        .order("created_at", { ascending: false });

      if (!cancelled) {
        if (discussionError) {
          setError(discussionError.message);
        } else {
          setPosts(await attachAuthors((data ?? []) as DiscussionPost[]));
        }
        setLoading(false);
      }
    }

    void loadPosts();

    return () => {
      cancelled = true;
    };
  }, [materialId]);

  async function handleSubmit() {
    if (!body.trim() || submitting) return;

    setSubmitting(true);
    setError("");

    try {
      const user = await getCurrentUser();
      if (!user) {
        throw new Error("Please log in to join the discussion.");
      }

      const payload = {
        material_id: materialId,
        user_id: user.id,
        body: body.trim(),
      };

      const { data, error: insertError } = await supabase
        .from("material_discussions")
        .insert(payload as never)
        .select("*")
        .single();

      if (insertError) {
        throw insertError;
      }

      const [postWithAuthor] = await attachAuthors([data as DiscussionPost]);
      setPosts((current) => [postWithAuthor, ...current]);
      setBody("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to post discussion.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleReply(post: DiscussionPost) {
    const mention = `@${post.author_name ?? "Unknown author"} `;

    setBody((currentBody) => {
      if (!currentBody.trim()) {
        return mention;
      }

      return currentBody.endsWith("\n") ? `${currentBody}${mention}` : `${currentBody}\n${mention}`;
    });

    requestAnimationFrame(() => {
      composerRef.current?.focus();
    });
  }

  return (
    <Card className="rounded-[32px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Discussion</p>
          <h2 className="mt-2 text-3xl text-foreground">Thread</h2>
        </div>
        <Badge className="bg-surface-muted text-text-muted">
          <MessageSquareText className="mr-1 h-3.5 w-3.5" />
          Shared
        </Badge>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.9fr)]">
        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-text-muted">Loading discussion…</p>
          ) : posts.length === 0 ? (
            <p className="text-sm text-text-muted">No discussion yet. Start the thread with a question or insight.</p>
          ) : (
            posts.map((post) => (
              <div key={post.id} className="rounded-2xl border border-border bg-surface px-4 py-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  {post.user_id ? (
                    <Link
                      href={`/users?userId=${post.user_id}`}
                      className="text-xs font-semibold uppercase tracking-[0.16em] text-text-soft hover:text-foreground"
                    >
                      {post.author_name ?? "Unknown author"}
                    </Link>
                  ) : (
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-soft">
                      {post.author_name ?? "Unknown author"}
                    </p>
                  )}
                  <Button type="button" variant="ghost" size="sm" onClick={() => handleReply(post)}>
                    Reply
                  </Button>
                </div>
                <p className="text-sm text-foreground">{post.body}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.16em] text-text-soft">
                  {new Date(post.created_at).toLocaleString()}
                </p>
              </div>
            ))
          )}
        </div>

        <div className="space-y-3 rounded-[24px] border border-border bg-[#fbfaf5] p-4">
          <h3 className="text-xl text-foreground">Add to thread</h3>
          <Textarea
            ref={composerRef}
            rows={6}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Ask a question, share context, or point out something helpful."
          />
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Posting..." : "Post Discussion"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
