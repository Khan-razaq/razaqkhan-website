"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runLookup, saveCapture, type SaveResult } from "@/lib/companies/save";

export async function addCompany(input: {
  url?: string | null;
  text?: string | null;
  title?: string | null;
}): Promise<SaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Signed out. Sign in and try again." };

  const result = await saveCapture(supabase, input);
  revalidatePath("/companies");
  return result;
}

// Runs the lookup again and waits for it, so the page can show the result.
export async function relookupCompany(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Signed out. Sign in and try again." };

  const error = await runLookup(supabase, id);
  revalidatePath("/companies");
  return { error };
}
