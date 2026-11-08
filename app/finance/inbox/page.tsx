import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requestTimeZone } from "@/lib/timeZone";
import { createClient } from "@/lib/supabase/server";
import { readNewAlerts } from "@/lib/finance/inbox";
import { friendBalances } from "@/lib/finance/friends";
import InboxClient from "./InboxClient";

export const metadata: Metadata = {
  title: "Inbox",
  robots: { index: false },
};

// Friends' names from past expenses, most used first ("ahmed" and "Ahmed"
// count as one, shown as most recently typed).
function peopleByUse(names: string[]): string[] {
  const counts = new Map<string, { name: string; count: number }>();
  for (const name of names) {
    const key = name.toLowerCase();
    const seen = counts.get(key);
    if (seen) seen.count++;
    else counts.set(key, { name, count: 1 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count).map((p) => p.name);
}

// Statement checks done over a month ago, with the card or account's name.
function dueForCheck(checks: { account_key: string; checked_at: string }[], names: Map<string, string>) {
  const monthAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
  return checks
    .filter((c) => names.has(c.account_key) && Date.parse(c.checked_at) < monthAgo)
    .map((c) => ({ name: names.get(c.account_key)!, checkedAt: c.checked_at }));
}

export default async function InboxPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/finance/inbox");
  }

  // Read any alert emails the Gmail script dropped off since last time.
  await readNewAlerts(supabase, requestTimeZone(await headers()));

  const [alertsResult, cardsResult, accountsResult, keysResult, spentByResult, paidBackResult, checksResult] = await Promise.all([
    supabase
      .from("bank_alerts")
      .select("id, sender, subject, email_date, kind, amount, merchant, bank, card_last4, category, credit_card_id, bank_account_id")
      .eq("status", "new")
      .order("email_date", { ascending: false })
      .limit(300),
    supabase.from("credit_cards").select("id, name, issuer").order("display_order", { ascending: true }),
    supabase.from("bank_accounts").select("id, name").order("display_order", { ascending: true }),
    supabase.from("bank_alert_keys").select("label, created_at, last_used_at"),
    // Friends' purchases on the card, and what they've paid back.
    supabase
      .from("expenses")
      .select("id, description, amount, expense_date, spent_by")
      .not("spent_by", "is", null)
      .order("expense_date", { ascending: false })
      .limit(1000),
    supabase
      .from("incomes")
      .select("id, source, amount, income_date, paid_back_by")
      .not("paid_back_by", "is", null)
      .order("income_date", { ascending: false })
      .limit(1000),
    supabase.from("statement_checks").select("account_key, checked_at"),
  ]);
  const keys = keysResult.data || [];
  const friendSpending = spentByResult.data || [];

  // Cards and accounts last checked against a statement over a month ago.
  const names = new Map<string, string>([
    ...(cardsResult.data || []).map((c) => [`card:${c.id}`, c.name] as [string, string]),
    ...(accountsResult.data || []).map((a) => [`account:${a.id}`, a.name] as [string, string]),
  ]);
  const checks = checksResult.data || [];
  const statementsDue = dueForCheck(checks, names);

  return (
    <InboxClient
      alerts={alertsResult.data || []}
      creditCards={cardsResult.data || []}
      bankAccounts={accountsResult.data || []}
      gmailKey={keys.find((k) => k.label === "gmail") ?? null}
      phoneKey={keys.find((k) => k.label === "phone") ?? null}
      people={peopleByUse(friendSpending.map((r) => r.spent_by as string))}
      friends={friendBalances(friendSpending, paidBackResult.data || [])}
      statementsDue={statementsDue}
      neverCheckedStatements={checks.length === 0}
      supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL!}
      publicKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}
    />
  );
}
