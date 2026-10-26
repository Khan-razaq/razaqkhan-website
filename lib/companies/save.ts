import "server-only";

import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lookupCompany, parseCapture } from "./lookup";
import { companyKeys, findDuplicateGroups, linkedInUrl, mergeGroup, type CompanyRow } from "./dedupe";

export type SaveResult =
  | { ok: true; id: string; name: string; duplicate: boolean }
  | { ok: false; error: string };

const ROW_FIELDS =
  "id, name, source_url, website, careers_url, ats, ats_slug, open_roles, summary, status, lookup_note, notes, checked_at, created_at";

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

  // Already saved, by name, LinkedIn link or website? Then don't add it
  // again; just fill in the LinkedIn link if the saved one lacks it.
  const { data: rows, error: listError } = await supabase.from("companies").select(ROW_FIELDS);
  if (listError) return { ok: false, error: listError.message };
  const keys = new Set(companyKeys({ name, source_url: capture.sourceUrl, website: capture.website }));
  const existing = (rows as CompanyRow[]).find((row) => companyKeys(row).some((k) => keys.has(k)));
  if (existing) {
    const newLinkedIn = linkedInUrl(capture.sourceUrl);
    if (newLinkedIn && !linkedInUrl(existing.source_url)) {
      await supabase.from("companies").update({ source_url: newLinkedIn }).eq("id", existing.id);
    }
    return { ok: true, id: existing.id, name: existing.name, duplicate: true };
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
    const { linkedin_url, site_name, ...result } = await lookupCompany(company);
    const update: Record<string, unknown> = {
      ...result,
      checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    // The LinkedIn page the company's own website links to.
    if (!linkedInUrl(company.source_url) && linkedin_url) update.source_url = linkedin_url;
    // Names spelled out by the site itself, or by the LinkedIn link
    // ("fauna-robotics" → "Fauna Robotics").
    const slug = linkedInUrl((update.source_url as string | undefined) ?? company.source_url)
      ?.split("/")
      .filter(Boolean)
      .pop();
    const slugName = slug?.includes("-")
      ? slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
      : null;
    const better = betterName(company.name, site_name) ?? betterName(company.name, slugName);
    if (better) update.name = better;

    let { error: updateError } = await supabase.from("companies").update(update).eq("id", id);
    if (updateError?.code === "23505") {
      // Another saved company already has that LinkedIn link: save the rest,
      // and the merge below joins the two.
      delete update.source_url;
      ({ error: updateError } = await supabase.from("companies").update(update).eq("id", id));
    }
    // The lookup may reveal this is a company already saved under another
    // name (same website), so merge if so.
    await mergeDuplicates(supabase);
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

// A name taken from a web address ("Faunarobotics") or a page title ("Join
// a team on a mission - AEye Careers") is replaced by the site's own name
// for itself ("Fauna Robotics", "AEye") when they clearly mean the same.
function betterName(current: string, siteName: string | null): string | null {
  if (!siteName || siteName.length > 40 || siteName === current) return null;
  const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const fromDomain = !current.includes(" ") && squash(current) === squash(siteName);
  const fromTitle = /\s[|–—-]\s/.test(current) && squash(current).includes(squash(siteName));
  return fromDomain || fromTitle ? siteName : null;
}

// Joins every set of duplicates into the company saved first. Safe to run
// any time: with no duplicates it only reads.
export async function mergeDuplicates(supabase: SupabaseClient): Promise<number> {
  const { data: rows, error } = await supabase.from("companies").select(ROW_FIELDS);
  if (error || !rows) return 0;

  let merged = 0;
  for (const group of findDuplicateGroups(rows as CompanyRow[])) {
    const { keep, drop } = mergeGroup(group);
    // Free the LinkedIn link first: it's unique per user, and the kept row
    // may be about to take it from a row that's being removed.
    const dropRows = group.filter((r) => drop.includes(r.id));
    await supabase.from("companies").update({ source_url: null }).in("id", drop);

    const fields: Partial<CompanyRow> = { ...keep };
    delete fields.id;
    delete fields.created_at;
    const { error: keepError } = await supabase
      .from("companies")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", keep.id);
    if (keepError) {
      // Put things back and leave the duplicates rather than lose anything.
      for (const r of dropRows) {
        await supabase.from("companies").update({ source_url: r.source_url }).eq("id", r.id);
      }
      continue;
    }
    await supabase.from("companies").delete().in("id", drop);
    merged += drop.length;
  }
  return merged;
}
