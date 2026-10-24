import "server-only";

import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lookupCompany, parseCapture } from "./lookup";

export type SaveResult =
  | { ok: true; id: string; name: string; duplicate: boolean }
  | { ok: false; error: string };

// Saves a captured company for the signed-in user and starts the lookup in
// the background, so the caller gets an answer in well under a second.
// Every query goes through the user's own client, so RLS applies.
export async function saveCapture(
  supabase: SupabaseClient,
  input: { url?: string | null; text?: string | null; title?: string | null; name?: string | null }
): Promise<SaveResult> {
  const capture = parseCapture(input);
  const name = (input.name?.trim() || capture.name)?.slice(0, 200);
  if (!name) {
    return { ok: false, error: "Couldn't tell which company this is. Type its name instead." };
  }

  const existing = capture.sourceUrl
    ? await supabase.from("companies").select("id, name").eq("source_url", capture.sourceUrl).maybeSingle()
    : await supabase.from("companies").select("id, name").ilike("name", name.replace(/[%_\\]/g, "\\$&")).limit(1).maybeSingle();
  if (existing.data) {
    return { ok: true, id: existing.data.id, name: existing.data.name, duplicate: true };
  }

  const { data, error } = await supabase
    .from("companies")
    .insert({ name, source_url: capture.sourceUrl, website: capture.website })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Couldn't save the company." };
  }

  after(() => runLookup(supabase, data.id));
  return { ok: true, id: data.id, name, duplicate: false };
}

export async function runLookup(supabase: SupabaseClient, id: string): Promise<string | null> {
  const { data: company, error } = await supabase
    .from("companies")
    .select("name, source_url, website, careers_url")
    .eq("id", id)
    .single();
  if (error || !company) return error?.message ?? "Company not found.";

  try {
    const result = await lookupCompany(company);
    const { error: updateError } = await supabase
      .from("companies")
      .update({ ...result, checked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", id);
    return updateError?.message ?? null;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Lookup failed.";
    await supabase
      .from("companies")
      .update({ status: "needs_review", lookup_note: `Lookup failed: ${message}`, checked_at: new Date().toISOString() })
      .eq("id", id);
    return message;
  }
}
