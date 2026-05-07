"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { getSupabaseUser, isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";
import type { MaterialStar } from "@/types/resource";
import { Button } from "@/components/ui/button";

export function ResourceStarButton({ materialId }: { materialId: string }) {
  const [starCount, setStarCount] = useState(0);
  const [hasStarred, setHasStarred] = useState(false);
  const [starring, setStarring] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    let active = true;

    async function loadStars() {
      const [user, { data, error: starsError }] = await Promise.all([
        getSupabaseUser(),
        supabase.from("material_stars").select("*").eq("material_id", materialId),
      ]);

      if (!active) {
        return;
      }

      if (starsError) {
        setError(starsError.message);
        return;
      }

      const stars = (data ?? []) as MaterialStar[];
      setStarCount(stars.length);
      setHasStarred(Boolean(user?.id && stars.some((star) => star.user_id === user.id)));
    }

    void loadStars();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      if (!active) {
        return;
      }

      void loadStars();
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [materialId]);

  async function toggleStar() {
    if (!isSupabaseConfigured || starring) {
      return;
    }

    setError("");

    const user = await getSupabaseUser();
    if (!user) {
      setError("Please log in to star resources.");
      return;
    }

    setStarring(true);

    try {
      if (hasStarred) {
        const { error: deleteError } = await supabase
          .from("material_stars")
          .delete()
          .eq("user_id", user.id)
          .eq("material_id", materialId);

        if (deleteError) {
          throw deleteError;
        }
      } else {
        const payload: Database["public"]["Tables"]["material_stars"]["Insert"] = {
          user_id: user.id,
          material_id: materialId,
        };

        const { error: insertError } = await supabase
          .from("material_stars")
          .upsert(payload as never, { onConflict: "user_id,material_id", ignoreDuplicates: true });

        if (insertError) {
          throw insertError;
        }
      }

      setHasStarred((current) => !current);
      setStarCount((current) => hasStarred ? Math.max(0, current - 1) : current + 1);
    } catch (starError) {
      setError(starError instanceof Error ? starError.message : "Unable to update resource star.");
    } finally {
      setStarring(false);
    }
  }

  return (
    <div>
      <Button
        type="button"
        size="sm"
        variant={hasStarred ? "secondary" : "outline"}
        onClick={() => void toggleStar()}
        disabled={starring}
      >
        <Star className={`h-4 w-4 ${hasStarred ? "fill-current" : ""}`} />
        {starCount}
      </Button>
      {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
