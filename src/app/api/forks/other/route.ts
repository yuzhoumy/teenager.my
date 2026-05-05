import { NextResponse } from "next/server";
import { supabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return NextResponse.json({ error: "Supabase admin client is not configured." }, { status: 501 });
  }

  const url = new URL(request.url);
  const materialId = url.searchParams.get("materialId");
  const sourceUrl = url.searchParams.get("sourceUrl");
  const excludeUserId = url.searchParams.get("excludeUserId");

  if (!materialId || !sourceUrl) {
    return NextResponse.json({ error: "Missing required query parameters." }, { status: 400 });
  }

  const query = supabaseAdmin
    .from("user_forks")
    .select("id, created_at")
    .eq("material_id", materialId)
    .eq("source_url", sourceUrl)
    .order("created_at", { ascending: false });

  const { data, error } = excludeUserId ? await query.neq("user_id", excludeUserId) : await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
