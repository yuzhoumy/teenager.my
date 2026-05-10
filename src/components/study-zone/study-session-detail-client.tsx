"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CalendarClock, LoaderCircle, MapPinned, MessageSquare, Send, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { AddressPickerMiniMap } from "./address-picker-mini-map";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getSupabaseUser, isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

type StudySession = Database["public"]["Tables"]["study_sessions"]["Row"];
type StudySessionComment = Database["public"]["Tables"]["study_session_comments"]["Row"];
type StudySessionParticipant = Database["public"]["Tables"]["study_session_participants"]["Row"];

function formatDateTime(value: string | null) {
  if (!value) return "Anytime";
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getAuthorName(user: Awaited<ReturnType<typeof getSupabaseUser>>) {
  if (!user) return "Student";

  const displayName = user.user_metadata.display_name;
  return typeof displayName === "string" && displayName.trim() ? displayName.trim() : user.email ?? "Student";
}

export function StudySessionDetailClient() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const [session, setSession] = useState<StudySession | null>(null);
  const [participants, setParticipants] = useState<StudySessionParticipant[]>([]);
  const [comments, setComments] = useState<StudySessionComment[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const [error, setError] = useState("");
  const [commentError, setCommentError] = useState("");

  const participantCount = participants.length;
  const maxParticipants = session?.max_participants ?? 0;
  const isJoined = Boolean(currentUserId && participants.some((participant) => participant.user_id === currentUserId));
  const isFull = Boolean(session && participantCount >= session.max_participants);
  const googleMapsHref = useMemo(() => {
    if (!session) return "";
    return `https://www.google.com/maps/search/?api=1&query=${session.lat},${session.lng}`;
  }, [session]);

  const loadSession = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError("Supabase is not configured.");
      setLoading(false);
      return;
    }

    if (!sessionId) {
      setError("Missing study session ID.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const user = await getSupabaseUser();
      setCurrentUserId(user?.id ?? null);

      const [
        { data: sessionData, error: sessionError },
        { data: participantData, error: participantError },
        { data: commentData, error: commentLoadError },
      ] = await Promise.all([
        supabase.from("study_sessions").select("*").eq("id", sessionId).maybeSingle(),
        supabase.from("study_session_participants").select("*").eq("session_id", sessionId).order("created_at", { ascending: true }),
        supabase.from("study_session_comments").select("*").eq("session_id", sessionId).order("created_at", { ascending: true }),
      ]);

      if (sessionError) throw sessionError;
      if (participantError) throw participantError;
      if (commentLoadError) throw commentLoadError;

      setSession((sessionData as StudySession | null) ?? null);
      setParticipants((participantData ?? []) as StudySessionParticipant[]);
      setComments((commentData ?? []) as StudySessionComment[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load this study session.");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadSession();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadSession]);

  async function handleJoin() {
    if (!session || joining || isJoined || isFull) return;

    setError("");
    setJoining(true);

    try {
      const user = await getSupabaseUser();
      if (!user) {
        throw new Error("Please log in to join this session.");
      }

      const payload: Database["public"]["Tables"]["study_session_participants"]["Insert"] = {
        session_id: session.id,
        user_id: user.id,
      };

      const { data, error: joinError } = await supabase
        .from("study_session_participants")
        .upsert(payload as never, { onConflict: "session_id,user_id", ignoreDuplicates: true })
        .select("*")
        .single();

      if (joinError) throw joinError;

      setCurrentUserId(user.id);
      setParticipants((current) => (current.some((participant) => participant.user_id === user.id) ? current : [...current, data as StudySessionParticipant]));
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "Unable to join this session.");
    } finally {
      setJoining(false);
    }
  }

  async function handleComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCommentError("");

    if (!session || commenting) return;

    const trimmedBody = commentBody.trim();
    if (!trimmedBody) {
      setCommentError("Write a comment first.");
      return;
    }

    setCommenting(true);

    try {
      const user = await getSupabaseUser();
      if (!user) {
        throw new Error("Please log in to comment.");
      }

      const payload: Database["public"]["Tables"]["study_session_comments"]["Insert"] = {
        session_id: session.id,
        user_id: user.id,
        author_name: getAuthorName(user),
        body: trimmedBody,
      };

      const { data, error: insertError } = await supabase
        .from("study_session_comments")
        .insert(payload as never)
        .select("*")
        .single();

      if (insertError) throw insertError;

      setComments((current) => [...current, data as StudySessionComment]);
      setCommentBody("");
    } catch (submitError) {
      setCommentError(submitError instanceof Error ? submitError.message : "Unable to add your comment.");
    } finally {
      setCommenting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-text-muted">
        <LoaderCircle className="mr-2 h-5 w-5 animate-spin" />
        Loading session...
      </div>
    );
  }

  if (!session) {
    return (
      <section className="space-y-4">
        <Link href="/study-zone" className="inline-flex items-center gap-2 text-sm font-medium text-text-muted hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to Jom Study
        </Link>
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-[0_4px_24px_var(--shadow)]">
          <p className="text-sm text-rose-200">{error || "Study session not found."}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <Link href="/study-zone" className="inline-flex items-center gap-2 text-sm font-medium text-text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Back to Jom Study
      </Link>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-border-strong bg-surface-strong p-6 shadow-[0_10px_40px_var(--shadow)]">
            <p className="text-sm uppercase tracking-[0.18em] text-text-soft">{session.location_name}</p>
            <h1 className="mt-2 text-4xl text-foreground sm:text-5xl">{session.title}</h1>
            <div className="mt-4 flex flex-wrap gap-3 text-sm text-text-muted">
              <span className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1">
                <CalendarClock className="h-4 w-4 text-brand" />
                {formatDateTime(session.starts_at)}
              </span>
              {session.subject ? <span className="rounded-full bg-surface px-3 py-1">{session.subject}</span> : null}
            </div>
            {session.description ? <p className="mt-5 text-base text-text-muted">{session.description}</p> : null}
          </div>

          <div className="rounded-2xl border border-border bg-surface p-5 shadow-[0_4px_24px_var(--shadow)]">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-brand" />
              <h2 className="text-2xl text-foreground">Comments</h2>
            </div>

            <form onSubmit={handleComment} className="mt-4 space-y-3">
              <Textarea value={commentBody} onChange={(event) => setCommentBody(event.target.value)} rows={4} placeholder="Ask a question or coordinate with the group..." />
              {commentError ? <p className="text-sm text-[#b53333]">{commentError}</p> : null}
              <Button type="submit" disabled={commenting}>
                <Send className="h-4 w-4" />
                {commenting ? "Posting..." : "Post comment"}
              </Button>
            </form>

            <div className="mt-5 space-y-3">
              {comments.length > 0 ? (
                comments.map((comment) => (
                  <div key={comment.id} className="rounded-2xl border border-border bg-background px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">{comment.author_name}</p>
                      <p className="text-xs text-text-soft">{new Date(comment.created_at).toLocaleString()}</p>
                    </div>
                    <p className="mt-2 text-sm text-text-muted">{comment.body}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-text-muted">No comments yet.</p>
              )}
            </div>
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-[0_4px_24px_var(--shadow)]">
            <AddressPickerMiniMap lat={session.lat} lng={session.lng} label={session.location_name} />
            <div className="mt-4 space-y-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <MapPinned className="h-4 w-4 text-brand" />
                  {session.location_name}
                </p>
                {session.address ? <p className="mt-1 text-sm text-text-muted">{session.address}</p> : null}
              </div>
              <Button asChild variant="outline" className="w-full">
                <a href={googleMapsHref} target="_blank" rel="noreferrer">
                  View in Google Map
                </a>
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-5 shadow-[0_4px_24px_var(--shadow)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-[0.16em] text-text-soft">Participants</p>
                <p className="mt-1 text-3xl font-semibold text-foreground">
                  {participantCount}/{maxParticipants}
                </p>
              </div>
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-muted">
                <Users className="h-5 w-5 text-brand" />
              </span>
            </div>
            <Button type="button" className="mt-4 w-full" onClick={handleJoin} disabled={joining || isJoined || isFull}>
              {joining ? "Joining..." : isJoined ? "Joined" : isFull ? "Session full" : "Join"}
            </Button>
            {error ? <p className="mt-3 text-sm text-[#b53333]">{error}</p> : null}
          </div>
        </aside>
      </div>
    </section>
  );
}
