"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bell, ChevronDown, ChevronUp } from "lucide-react";
import type { Database, NotificationType } from "@/types/database";
import { createProfileNameMap, type ProfileNameRow } from "@/lib/profile-names";
import { getSupabaseUser, isSupabaseConfigured, supabase, supabaseUntyped } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

type Payload = Record<string, string | undefined>;

function asPayload(raw: NotificationRow["payload"]): Payload {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const out: Payload = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") {
      out[key] = value;
    }
  }
  return out;
}

function summarizeNotification(row: NotificationRow, actorLabel: string): string {
  const payload = asPayload(row.payload);

  switch (row.type as NotificationType) {
    case "follow":
      return `${actorLabel} started following you`;
    case "fork_material":
      return `${actorLabel} forked your resource`;
    case "comment_material":
      return `${actorLabel} commented on your resource discussion`;
    case "mention_material":
      return `${actorLabel} mentioned you in a resource discussion`;
    case "comment_forum":
      return `${actorLabel} commented on your forum post`;
    case "reply_forum":
      return `${actorLabel} replied to your forum comment`;
    case "mention_forum":
      return `${actorLabel} mentioned you in the forum`;
    case "new_material_followed":
      return `${actorLabel} published a new resource`;
    case "new_fork_followed":
      return `${actorLabel} created a new fork`;
    case "new_post_followed":
      return `${actorLabel} started a new forum thread`;
    case "announcement":
      return payload.title ? `Announcement: ${payload.title}` : "New announcement";
    case "fork_annotation":
      return `${actorLabel} added a note on a fork of your material`;
    default:
      return "New notification";
  }
}

function notificationHref(row: NotificationRow): string | null {
  const payload = asPayload(row.payload);

  switch (row.type as NotificationType) {
    case "follow":
      return row.actor_id ? `/users?userId=${row.actor_id}` : null;
    case "fork_material":
      return payload.material_slug ? `/resources/${payload.material_slug}/fork` : null;
    case "comment_material":
    case "mention_material":
      return payload.material_slug ? `/resources/${payload.material_slug}?tab=discussion` : null;
    case "comment_forum":
    case "reply_forum":
    case "mention_forum":
      return payload.post_id ? `/forum#forum-post-${payload.post_id}` : "/forum";
    case "new_material_followed":
      return payload.material_slug ? `/resources/${payload.material_slug}` : null;
    case "new_fork_followed":
      return payload.material_slug ? `/resources/${payload.material_slug}?tab=fork` : null;
    case "new_post_followed":
      return payload.post_id ? `/forum#forum-post-${payload.post_id}` : "/forum";
    case "announcement":
      return null;
    case "fork_annotation":
      return payload.material_slug ? `/resources/${payload.material_slug}?tab=fork` : null;
    default:
      return null;
  }
}

function AnnouncementBodyToggle({ announcementId, title }: { announcementId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadBody() {
    if (body !== null || loading) return;
    setLoading(true);
    setError("");
    const { data, error: fetchError } = await supabase.from("announcements").select("body").eq("id", announcementId).maybeSingle();
    setLoading(false);
    if (fetchError) {
      setError(fetchError.message);
      return;
    }
    setBody((data as { body?: string } | null)?.body ?? "");
  }

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      await loadBody();
    }
  }

  return (
    <div className="mt-3 rounded-2xl border border-border bg-background/60 px-4 py-3">
      <button type="button" className="flex w-full items-center justify-between gap-3 text-left text-sm font-medium text-foreground" onClick={() => void toggle()}>
        <span>{title}</span>
        {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
      </button>
      {open ? (
        <div className="mt-3 border-t border-border pt-3 text-sm text-text-muted whitespace-pre-wrap">
          {loading ? <p>Loading…</p> : null}
          {error ? <p className="text-rose-600">{error}</p> : null}
          {!loading && !error && body !== null ? body || <span className="text-text-soft">No detail text.</span> : null}
        </div>
      ) : null}
    </div>
  );
}

export function NotificationsPageClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [actorNames, setActorNames] = useState<Map<string, string>>(new Map());

  const sortedRows = useMemo(() => [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at)), [rows]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      if (!isSupabaseConfigured) {
        setError("Supabase is not configured.");
        setLoading(false);
        return;
      }

      const user = await getSupabaseUser();
      if (!user) {
        setError("Please log in to view notifications.");
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from("notifications")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(120);

        if (fetchError) {
          throw fetchError;
        }

        const nextRows = (data ?? []) as NotificationRow[];
        const actorIds = Array.from(
          new Set(nextRows.map((row) => row.actor_id).filter((id): id is string => Boolean(id))),
        );

        let names = new Map<string, string>();
        if (actorIds.length > 0) {
          const { data: profiles } = await supabase.from("profiles").select("user_id, display_name").in("user_id", actorIds);
          names = createProfileNameMap((profiles ?? []) as ProfileNameRow[]);
        }

        const readStamp = new Date().toISOString();
        await supabaseUntyped.from("notifications").update({ read_at: readStamp }).is("read_at", null);

        if (!cancelled) {
          setRows(nextRows.map((row) => (row.read_at ? row : { ...row, read_at: readStamp })));
          setActorNames(names);
        }
      } catch (loadError) {
        if (!cancelled) {
          const message =
            loadError instanceof Error
              ? loadError.message
              : "Unable to load notifications. If you just deployed the app, run `notifications_migration.sql` in Supabase.";
          setError(message);
          setRows([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="space-y-6">
      <div className="rounded-[30px] border border-border bg-surface p-6 shadow-[0_4px_24px_var(--shadow)] sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Activity</p>
            <h1 className="mt-2 flex items-center gap-3 text-4xl text-foreground sm:text-5xl">
              <Bell className="h-10 w-10 text-brand" />
              Notifications
            </h1>
            <p className="mt-3 max-w-2xl text-base text-text-muted">
              Follows, forks, forum replies, resource discussions, and announcements from the team.
            </p>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-[28px] border border-[#e7c3b8] bg-[#fff4f0] p-5 text-sm text-[#b53333]">
          {error}{" "}
          {!error.includes("log in") ? (
            <Link href="/login" className="font-semibold underline">
              Login
            </Link>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <Card className="rounded-[28px] border-border bg-surface p-8 text-center shadow-[0_4px_24px_var(--shadow)]">
          <p className="text-sm text-text-muted">Loading notifications…</p>
        </Card>
      ) : sortedRows.length === 0 ? (
        <Card className="rounded-[28px] border-border bg-surface p-8 text-center shadow-[0_4px_24px_var(--shadow)]">
          <p className="text-lg text-foreground">You are all caught up</p>
          <p className="mt-2 text-sm text-text-muted">New activity will land here when someone interacts with your posts or follows you.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedRows.map((row) => {
            const actorLabel =
              row.actor_id && actorNames.has(row.actor_id) ? actorNames.get(row.actor_id)! : row.actor_id ? "Someone" : "teenager.my";
            const href = notificationHref(row);
            const payload = asPayload(row.payload);
            const unread = !row.read_at;

            const inner = (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-foreground">{summarizeNotification(row, actorLabel)}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-text-soft">
                      {new Date(row.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {unread ? <Badge className="bg-brand/15 text-brand hover:bg-brand/20">New</Badge> : null}
                    <Badge className="border-border bg-transparent normal-case tracking-normal text-text-muted">
                      {row.type.replaceAll("_", " ")}
                    </Badge>
                  </div>
                </div>
                {row.type === "announcement" && payload.announcement_id ? (
                  <AnnouncementBodyToggle announcementId={payload.announcement_id} title={payload.title ?? "Announcement"} />
                ) : null}
              </>
            );

            return (
              <Card key={row.id} className="rounded-[24px] border-border bg-surface p-5 shadow-[0_4px_18px_var(--shadow)]">
                {href ? (
                  <Link href={href} className="block transition hover:opacity-90">
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
