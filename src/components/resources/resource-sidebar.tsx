"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { BookCopy, Lightbulb, Sparkles, Trophy, Upload } from "lucide-react";
import type { Database } from "@/types/database";
import type { ExerciseSolution, KnowledgePatch, ResourcePdfLink, StudyMaterial } from "@/types/resource";
import { getSupabaseUser, isSupabaseConfigured, supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const bucketName = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "resource-attachments";
type SolutionVoteRow = Database["public"]["Tables"]["exercise_solution_votes"]["Row"];

async function uploadResourceImage(file: File, userId: string) {
  const safeFileName = file.name.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9_.-]/g, "");
  const filePath = `solutions/${userId}/${Date.now()}-${safeFileName}`;
  const { error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(filePath, file, { cacheControl: "3600", upsert: false });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);
  return data.publicUrl;
}

export function ResourceSidebar({
  material,
  pdfLinks,
  onOpenPdf,
}: {
  material: StudyMaterial;
  pdfLinks: ResourcePdfLink[];
  onOpenPdf: (pdfLink: ResourcePdfLink) => void;
}) {
  return material.core_type === "exercise" ? (
    <ExerciseSidebar material={material} pdfLinks={pdfLinks} onOpenPdf={onOpenPdf} />
  ) : (
    <NoteSidebar material={material} pdfLinks={pdfLinks} onOpenPdf={onOpenPdf} />
  );
}

function ExerciseSidebar({
  material,
  pdfLinks,
  onOpenPdf,
}: {
  material: StudyMaterial;
  pdfLinks: ResourcePdfLink[];
  onOpenPdf: (pdfLink: ResourcePdfLink) => void;
}) {
  const [solutions, setSolutions] = useState<ExerciseSolution[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSolutions() {
      if (!isSupabaseConfigured) {
        setLoading(false);
        return;
      }

      const [{ data: solutionData, error: solutionError }, { data: voteData, error: voteError }] = await Promise.all([
        supabase
          .from("exercise_solutions")
          .select("*")
          .eq("material_id", material.id)
          .order("created_at", { ascending: false }),
        supabase.from("exercise_solution_votes").select("*"),
      ]);

      if (cancelled) return;

      if (solutionError || voteError) {
        setError(solutionError?.message ?? voteError?.message ?? "Unable to load solutions.");
      } else {
        const votes = (voteData ?? []) as SolutionVoteRow[];
        const mappedSolutions = ((solutionData ?? []) as ExerciseSolution[]).map((solution) => ({
          ...solution,
          vote_count: votes.filter((vote) => vote.solution_id === solution.id).length,
        }));
        setSolutions(mappedSolutions.sort((left, right) => (right.vote_count ?? 0) - (left.vote_count ?? 0)));
      }

      setLoading(false);
    }

    void loadSolutions();

    return () => {
      cancelled = true;
    };
  }, [material.id]);

  async function submitSolution() {
    if (!body.trim() || submitting) return;

    setSubmitting(true);
    setError("");

    try {
      const user = await getSupabaseUser();
      if (!user) {
        throw new Error("Please log in to submit a solution.");
      }

      const imageUrl = imageFile ? await uploadResourceImage(imageFile, user.id) : null;

      const payload = {
        material_id: material.id,
        user_id: user.id,
        body: body.trim(),
        image_url: imageUrl,
      };

      const { data, error: insertError } = await supabase
        .from("exercise_solutions")
        .insert(payload as never)
        .select("*")
        .single();

      if (insertError) {
        throw insertError;
      }

      setSolutions((current) => [{ ...(data as ExerciseSolution), vote_count: 0 }, ...current]);
      setBody("");
      setImageFile(null);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit solution.");
    } finally {
      setSubmitting(false);
    }
  }

  async function upvoteSolution(solutionId: string) {
    setError("");

    try {
      const user = await getSupabaseUser();
      if (!user) {
        throw new Error("Please log in to upvote a solution.");
      }

      const payload = {
        solution_id: solutionId,
        user_id: user.id,
      };

      const { error: voteError } = await supabase
        .from("exercise_solution_votes")
        .upsert(payload as never, { onConflict: "solution_id,user_id", ignoreDuplicates: true });

      if (voteError) {
        throw voteError;
      }

      setSolutions((current) =>
        current
          .map((solution) =>
            solution.id === solutionId
              ? { ...solution, vote_count: (solution.vote_count ?? 0) + 1 }
              : solution,
          )
          .sort((left, right) => (right.vote_count ?? 0) - (left.vote_count ?? 0)),
      );
    } catch (voteError) {
      setError(voteError instanceof Error ? voteError.message : "Unable to upvote solution.");
    }
  }

  const topPdf = useMemo(() => pdfLinks[0] ?? null, [pdfLinks]);

  return (
    <div className="space-y-5">
      <Card className="rounded-[28px] border-border bg-white/80 p-5 shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Exercise Sidebar</p>
            <h3 className="mt-2 text-3xl text-foreground">Solution Leaderboard</h3>
          </div>
          <Badge className="bg-[#f8eee5] text-brand">
            <Trophy className="mr-1 h-3.5 w-3.5" />
            Ranked
          </Badge>
        </div>

        <p className="mt-3 text-sm text-text-muted">
          Students can fork the PDF, then share worked answers here as text or image-based solutions.
        </p>

        {topPdf ? (
          <Button type="button" variant="outline" className="mt-4 w-full" onClick={() => onOpenPdf(topPdf)}>
            <BookCopy className="h-4 w-4" />
            Open Base PDF
          </Button>
        ) : null}
      </Card>

      <Card className="rounded-[28px] border-border bg-white/80 p-5 shadow-none">
        <h4 className="text-xl text-foreground">Submit a solution</h4>
        <div className="mt-4 space-y-3">
          <Textarea
            rows={6}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Explain your method, key steps, or final answer."
          />
          <Input type="file" accept="image/*" onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} />
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <Button type="button" onClick={submitSolution} disabled={submitting}>
            <Upload className="h-4 w-4" />
            {submitting ? "Submitting..." : "Upload Solution"}
          </Button>
        </div>
      </Card>

      <div className="space-y-3">
        {loading ? (
          <p className="text-sm text-text-muted">Loading leaderboard…</p>
        ) : solutions.length === 0 ? (
          <Card className="rounded-[28px] border-border bg-white/80 p-5 shadow-none">
            <p className="text-sm text-text-muted">No solutions yet. Be the first to post a worked answer.</p>
          </Card>
        ) : (
          solutions.map((solution, index) => (
            <Card key={solution.id} className="rounded-[28px] border-border bg-white/80 p-5 shadow-none">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-text-soft">Rank #{index + 1}</p>
                  <p className="mt-2 text-sm text-foreground">{solution.body}</p>
                </div>
                <Badge>{solution.vote_count ?? 0} upvotes</Badge>
              </div>
              {solution.image_url ? (
                <img
                  src={solution.image_url}
                  alt="Uploaded solution"
                  className="mt-4 w-full rounded-2xl border border-border object-cover"
                />
              ) : null}
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.16em] text-text-soft">
                  {new Date(solution.created_at).toLocaleString()}
                </p>
                <Button type="button" size="sm" variant="secondary" onClick={() => upvoteSolution(solution.id)}>
                  <Sparkles className="h-4 w-4" />
                  Upvote
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function NoteSidebar({
  material,
  pdfLinks,
  onOpenPdf,
}: {
  material: StudyMaterial;
  pdfLinks: ResourcePdfLink[];
  onOpenPdf: (pdfLink: ResourcePdfLink) => void;
}) {
  const [patches, setPatches] = useState<KnowledgePatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<"correction" | "mnemonic">("correction");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPatches() {
      if (!isSupabaseConfigured) {
        setLoading(false);
        return;
      }

      const { data, error: patchError } = await supabase
        .from("knowledge_patches")
        .select("*")
        .eq("material_id", material.id)
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (patchError) {
        setError(patchError.message);
      } else {
        setPatches((data ?? []) as KnowledgePatch[]);
      }

      setLoading(false);
    }

    void loadPatches();

    return () => {
      cancelled = true;
    };
  }, [material.id]);

  async function submitPatch() {
    if (!body.trim() || submitting) return;

    setSubmitting(true);
    setError("");

    try {
      const user = await getSupabaseUser();
      if (!user) {
        throw new Error("Please log in to suggest a patch.");
      }

      const payload = {
        material_id: material.id,
        user_id: user.id,
        kind,
        body: body.trim(),
      };

      const { data, error: insertError } = await supabase
        .from("knowledge_patches")
        .insert(payload as never)
        .select("*")
        .single();

      if (insertError) {
        throw insertError;
      }

      setPatches((current) => [data as KnowledgePatch, ...current]);
      setBody("");
      setKind("correction");
    } catch (patchError) {
      setError(patchError instanceof Error ? patchError.message : "Unable to submit patch.");
    } finally {
      setSubmitting(false);
    }
  }

  const topPdf = useMemo(() => pdfLinks[0] ?? null, [pdfLinks]);

  return (
    <div className="space-y-5">
      <Card className="rounded-[28px] border-border bg-white/80 p-5 shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-text-soft">Note Sidebar</p>
            <h3 className="mt-2 text-3xl text-foreground">Knowledge Patches</h3>
          </div>
          <Badge className="bg-[#eef4e9] text-[#5e7a49]">
            <Lightbulb className="mr-1 h-3.5 w-3.5" />
            Living Notes
          </Badge>
        </div>

        <p className="mt-3 text-sm text-text-muted">
          Suggest corrections, clearer phrasing, or memory hooks without editing the original note directly.
        </p>

        {topPdf ? (
          <Button type="button" variant="outline" className="mt-4 w-full" onClick={() => onOpenPdf(topPdf)}>
            <BookCopy className="h-4 w-4" />
            Open Attached PDF
          </Button>
        ) : null}
      </Card>

      <Card className="rounded-[28px] border-border bg-white/80 p-5 shadow-none">
        <h4 className="text-xl text-foreground">Suggest a patch</h4>
        <div className="mt-4 space-y-3">
          <Select value={kind} onChange={(event) => setKind(event.target.value as "correction" | "mnemonic")}>
            <option value="correction">Correction</option>
            <option value="mnemonic">Mnemonic</option>
          </Select>
          <Textarea
            rows={6}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Suggest a factual correction or a memorable mnemonic."
          />
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <Button type="button" onClick={submitPatch} disabled={submitting}>
            {submitting ? "Submitting..." : "Submit Patch"}
          </Button>
        </div>
      </Card>

      <div className="space-y-3">
        {loading ? (
          <p className="text-sm text-text-muted">Loading patches…</p>
        ) : patches.length === 0 ? (
          <Card className="rounded-[28px] border-border bg-white/80 p-5 shadow-none">
            <p className="text-sm text-text-muted">No patches yet. Add the first correction or mnemonic.</p>
          </Card>
        ) : (
          patches.map((patch) => (
            <Card key={patch.id} className="rounded-[28px] border-border bg-white/80 p-5 shadow-none">
              <div className="flex items-center justify-between gap-3">
                <Badge className="bg-surface-muted text-text-muted">{patch.kind}</Badge>
                <p className="text-xs uppercase tracking-[0.16em] text-text-soft">
                  {new Date(patch.created_at).toLocaleString()}
                </p>
              </div>
              <p className="mt-3 text-sm text-foreground">{patch.body}</p>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
