"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { CalendarClock, LocateFixed, MapPinned, Plus, RefreshCcw, Search, Send, TrendingUp, X, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AddressPicker, type PickedAddress } from "./address-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getSupabaseUser, isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

export type StudyZoneBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export type StudySessionMapItem = Pick<
  Database["public"]["Tables"]["study_sessions"]["Row"],
  "id" | "title" | "description" | "subject" | "location_name" | "address" | "lat" | "lng" | "max_participants" | "starts_at" | "created_at"
>;

export type StudyZoneZoomCommand = {
  direction: "in" | "out";
  id: number;
};

const StudyZoneMap = dynamic(() => import("./study-zone-map").then((module) => module.StudyZoneMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-[40vh] min-h-[320px] items-center justify-center rounded-2xl border border-border-strong bg-surface text-sm text-text-muted shadow-[0_10px_40px_var(--shadow)]">
      Loading map...
    </div>
  ),
});

const studySessionSubjectOptions = [
  "Any subject",
  "Additional Mathematics",
  "Bahasa Melayu",
  "Biology",
  "Chemistry",
  "English",
  "Mathematics",
  "Physics",
  "Science",
  "Sejarah",
  "Pendidikan Moral",
  "Pendidikan Islam",
  "Bahasa Cina",
  "Bahasa Tamil",
  "Geography",
  "RBT",
  "Asas Sains Komputer",
  "Prinsip Perakaunan",
  "Ekonomi",
  "Sains Komputer",
  "Asas Sains Komputer",
];

function formatBounds(bounds: StudyZoneBounds | null) {
  if (!bounds) return "All areas";
  return `${bounds.south.toFixed(2)}, ${bounds.west.toFixed(2)} to ${bounds.north.toFixed(2)}, ${bounds.east.toFixed(2)}`;
}

function formatDateTime(value: string | null) {
  if (!value) return "Anytime";
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StartSessionModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (session: StudySessionMapItem) => void;
}) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [maxParticipants, setMaxParticipants] = useState(8);
  const [startsAt, setStartsAt] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState<PickedAddress | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const trimmedTitle = title.trim();
    if (!trimmedTitle || !location) {
      setError("Add a title and pick a location before starting the session.");
      return;
    }

    if (!isSupabaseConfigured) {
      setError("Supabase is not configured.");
      return;
    }

    setSubmitting(true);

    try {
      const user = await getSupabaseUser();
      if (!user) {
        throw new Error("Please log in to start a study session.");
      }

      const payload: Database["public"]["Tables"]["study_sessions"]["Insert"] = {
        user_id: user.id,
        title: trimmedTitle,
        subject: subject.trim() || null,
        max_participants: maxParticipants,
        starts_at: startsAt ? new Date(startsAt).toISOString() : null,
        description: description.trim() || null,
        location_name: location.location_name,
        address: location.address,
        lat: location.lat,
        lng: location.lng,
      };

      const { data, error: insertError } = await supabase
        .from("study_sessions")
        .insert(payload as never)
        .select("id, title, description, subject, location_name, address, lat, lng, max_participants, starts_at, created_at")
        .single();

      if (insertError) throw insertError;

      const createdSession = data as StudySessionMapItem;
      const { error: participantError } = await supabase.from("study_session_participants").insert({
        session_id: createdSession.id,
        user_id: user.id,
      } as never);

      if (participantError) throw participantError;

      onCreated(createdSession);
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to start this session.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[2000] overflow-y-auto bg-background/75 px-4 py-6 backdrop-blur-md">
      <div className="mx-auto max-w-3xl rounded-2xl border border-border-strong bg-surface-strong p-5 shadow-[0_20px_80px_var(--shadow)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Jom Study</p>
            <h2 className="mt-2 text-3xl text-foreground">Start a session</h2>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Session title" required />
            <Select value={subject} onChange={(event) => setSubject(event.target.value)} aria-label="Subject">
              <option value="">Subject</option>
              {studySessionSubjectOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
            <Input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
            <Input
              type="number"
              min={1}
              max={200}
              value={maxParticipants}
              onChange={(event) => setMaxParticipants(Number(event.target.value))}
              placeholder="Max participants"
            />
          </div>
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} placeholder="What are you studying? Who should join?" />
          <AddressPicker value={location} onChange={setLocation} />

          {error ? <p className="text-sm text-[#b53333]">{error}</p> : null}

          <div className="flex flex-wrap justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              <Send className="h-4 w-4" />
              {submitting ? "Starting..." : "Start session"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function StudyZonePageClient() {
  const [sessions, setSessions] = useState<StudySessionMapItem[]>([]);
  const [filterText, setFilterText] = useState("");
  const [currentBounds, setCurrentBounds] = useState<StudyZoneBounds | null>(null);
  const [activeBounds, setActiveBounds] = useState<StudyZoneBounds | null>(null);
  const [locateSignal, setLocateSignal] = useState(0);
  const [zoomCommand, setZoomCommand] = useState<StudyZoneZoomCommand | null>(null);
  const [showStartSession, setShowStartSession] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const postRefs = useRef<Record<string, HTMLElement | null>>({});

  const fetchSessions = useCallback(async (bounds: StudyZoneBounds | null) => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      setError("Supabase is not configured.");
      return;
    }

    setLoading(true);
    setError("");

    let query = supabase
      .from("study_sessions")
      .select("id, title, description, subject, location_name, address, lat, lng, max_participants, starts_at, created_at")
      .order("created_at", { ascending: false })
      .limit(250);

    if (bounds) {
      query = query.gte("lat", bounds.south).lte("lat", bounds.north);
      if (bounds.west <= bounds.east) {
        query = query.gte("lng", bounds.west).lte("lng", bounds.east);
      }
    }

    const { data, error: sessionsError } = await query;

    if (sessionsError) {
      setSessions([]);
      setError(sessionsError.message);
      setLoading(false);
      return;
    }

    setSessions((data ?? []) as StudySessionMapItem[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void fetchSessions(null);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [fetchSessions]);

  const visibleSessions = useMemo(() => {
    const normalizedFilter = filterText.trim().toLowerCase();
    if (!normalizedFilter) return sessions;

    return sessions.filter((session) =>
      [session.title, session.description, session.subject, session.location_name, session.address]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(normalizedFilter)),
    );
  }, [filterText, sessions]);

  const trendingAreas = useMemo(() => {
    const counts = visibleSessions.reduce<Record<string, number>>((areas, session) => {
      areas[session.location_name] = (areas[session.location_name] ?? 0) + 1;
      return areas;
    }, {});

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [visibleSessions]);

  function scrollToPost(sessionId: string) {
    const card = postRefs.current[sessionId];
    card?.scrollIntoView({ behavior: "smooth", block: "center" });
    card?.focus({ preventScroll: true });
  }

  function searchCurrentArea() {
    setActiveBounds(currentBounds);
    void fetchSessions(currentBounds);
  }

  function clearAreaSearch() {
    setActiveBounds(null);
    void fetchSessions(null);
  }

  function addSession(session: StudySessionMapItem) {
    setSessions((current) => [session, ...current]);
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Jom Study</p>
          <h1 className="mt-2 text-4xl text-foreground sm:text-5xl">Study sessions nearby</h1>
        </div>
        <Button type="button" onClick={() => setShowStartSession(true)}>
          <Plus className="h-4 w-4" />
          Start a Session
        </Button>
      </div>

      <div className="relative">
        <StudyZoneMap
          sessions={visibleSessions}
          locateSignal={locateSignal}
          zoomCommand={zoomCommand}
          onBoundsChange={setCurrentBounds}
          onLocateError={setError}
          onScrollToPost={scrollToPost}
          className="h-[40vh] min-h-[320px] rounded-2xl"
        />
        <div className="absolute right-3 top-3 z-[500] w-[calc(100%-1.5rem)] max-w-md rounded-2xl border border-border-strong bg-surface/95 p-3 shadow-[0_14px_45px_var(--shadow)] backdrop-blur">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-soft" />
            <Input
              value={filterText}
              onChange={(event) => setFilterText(event.target.value)}
              className="pl-9 pr-24"
              placeholder="Search posts or places"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setLocateSignal((current) => current + 1)}>
              <LocateFixed className="h-4 w-4" />
              Locate Me
            </Button>
            <Button type="button" size="sm" onClick={searchCurrentArea} disabled={!currentBounds || loading}>
              <MapPinned className="h-4 w-4" />
              Search this area
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setZoomCommand((current) => ({ direction: "in", id: (current?.id ?? 0) + 1 }))}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setZoomCommand((current) => ({ direction: "out", id: (current?.id ?? 0) + 1 }))}>
              <ZoomOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {error ? <p className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)]">
        <div className="space-y-4 lg:max-h-[calc(100vh-11rem)] lg:overflow-y-auto lg:pr-2">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-surface p-4">
            <p className="text-sm text-text-muted">
              <span className="font-semibold text-foreground">{visibleSessions.length}</span> sessions
              <span className="mx-2 text-text-soft">|</span>
              {formatBounds(activeBounds)}
            </p>
            {activeBounds ? (
              <Button type="button" size="sm" variant="ghost" onClick={clearAreaSearch}>
                <RefreshCcw className="h-4 w-4" />
                Reset area
              </Button>
            ) : null}
          </div>

          {loading ? (
            <div className="rounded-2xl border border-border bg-surface p-5 shadow-[0_4px_24px_var(--shadow)]">
              <p className="text-sm text-text-muted">Loading study sessions...</p>
            </div>
          ) : visibleSessions.length > 0 ? (
            <div className="grid auto-rows-fr gap-4 md:grid-cols-2">
              {visibleSessions.map((session, index) => (
                <Link
                  key={session.id}
                  ref={(node: HTMLAnchorElement | null) => {
                    postRefs.current[session.id] = node;
                  }}
                  href={`/study-zone/session?sessionId=${session.id}`}
                  id={`study-session-${session.id}`}
                  className={`block scroll-mt-28 rounded-2xl border border-border bg-surface p-5 shadow-[0_4px_24px_var(--shadow)] hover:border-border-strong hover:bg-surface-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                    index % 5 === 0 ? "md:row-span-2" : ""
                  }`}
                >
                  <div className="flex h-full flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border-strong bg-surface-muted">
                        <MapPinned className="h-4 w-4 text-brand" />
                      </span>
                      <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-text-muted">
                        {session.max_participants} participants
                      </span>
                    </div>
                    <p className="mt-4 text-xs uppercase tracking-[0.16em] text-text-soft">{session.location_name}</p>
                    <h2 className="mt-1 text-2xl text-foreground">{session.title}</h2>
                    <p className="mt-2 flex items-center gap-2 text-sm text-text-muted">
                      <CalendarClock className="h-4 w-4 text-brand" />
                      {formatDateTime(session.starts_at)}
                    </p>
                    {session.description ? <p className="mt-3 text-sm text-text-muted">{session.description}</p> : null}
                    {session.address ? <p className="mt-auto pt-4 text-xs text-text-soft">{session.address}</p> : null}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-surface p-5 shadow-[0_4px_24px_var(--shadow)]">
              <p className="text-sm text-text-muted">No study sessions found for this view.</p>
            </div>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-[0_4px_24px_var(--shadow)]">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-brand" />
              <h2 className="text-2xl text-foreground">Trending Areas</h2>
            </div>
            <div className="mt-4 space-y-3">
              {trendingAreas.length > 0 ? (
                trendingAreas.map(([area, count]) => (
                  <button
                    key={area}
                    type="button"
                    className="flex w-full items-center justify-between rounded-2xl border border-border bg-background px-4 py-3 text-left hover:border-border-strong hover:bg-surface-muted"
                    onClick={() => setFilterText(area)}
                  >
                    <span className="text-sm font-semibold text-foreground">{area}</span>
                    <span className="text-xs text-text-muted">{count} posts</span>
                  </button>
                ))
              ) : (
                <p className="text-sm text-text-muted">Areas will appear once sessions are available.</p>
              )}
            </div>
          </div>
        </aside>
      </div>

      {showStartSession ? <StartSessionModal onClose={() => setShowStartSession(false)} onCreated={addSession} /> : null}
    </section>
  );
}
