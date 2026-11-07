import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { readNewAlerts } from "@/lib/finance/inbox";
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

export default async function InboxPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/finance/inbox");
  }

  // Read any alert emails the Gmail script dropped off since last time.
  await readNewAlerts(supabase);

  const [alertsResult, cardsResult, accountsResult, keysResult, spentByResult] = await Promise.all([
    supabase
      .from("bank_alerts")
      .select("id, sender, subject, email_date, kind, amount, merchant, bank, card_last4, category, credit_card_id, bank_account_id")
      .eq("status", "new")
      .order("email_date", { ascending: false })
      .limit(300),
    supabase.from("credit_cards").select("id, name, issuer").order("display_order", { ascending: true }),
    supabase.from("bank_accounts").select("id, name").order("display_order", { ascending: true }),
    supabase.from("bank_alert_keys").select("label, created_at, last_used_at"),
    supabase
      .from("expenses")
      .select("spent_by")
      .not("spent_by", "is", null)
      .order("expense_date", { ascending: false })
      .limit(1000),
  ]);
  const keys = keysResult.data || [];

  return (
    <InboxClient
      alerts={alertsResult.data || []}
      creditCards={cardsResult.data || []}
      bankAccounts={accountsResult.data || []}
      gmailKey={keys.find((k) => k.label === "gmail") ?? null}
      phoneKey={keys.find((k) => k.label === "phone") ?? null}
      people={peopleByUse((spentByResult.data || []).map((r) => r.spent_by as string))}
      supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL!}
      publicKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}
    />
  );
}
