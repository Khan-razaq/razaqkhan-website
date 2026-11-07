import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import StatementsClient from "./StatementsClient";

export const metadata: Metadata = {
  title: "Check a statement",
  robots: { index: false },
};

export default async function StatementsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/finance/statements");
  }

  const [cardsResult, accountsResult, checksResult] = await Promise.all([
    supabase.from("credit_cards").select("id, name").order("display_order", { ascending: true }),
    supabase.from("bank_accounts").select("id, name").order("display_order", { ascending: true }),
    supabase.from("statement_checks").select("account_key, checked_at, through_date"),
  ]);

  const targets = [
    ...(cardsResult.data || []).map((c) => ({ key: `card:${c.id}`, name: c.name, kind: "card" as const })),
    ...(accountsResult.data || []).map((a) => ({ key: `account:${a.id}`, name: a.name, kind: "account" as const })),
  ];

  return <StatementsClient targets={targets} checks={checksResult.data || []} />;
}
