import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { readNewAlerts } from "@/lib/finance/inbox";
import InboxClient from "./InboxClient";

export const metadata: Metadata = {
  title: "Inbox",
  robots: { index: false },
};

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

  const [alertsResult, cardsResult, accountsResult, keyResult] = await Promise.all([
    supabase
      .from("bank_alerts")
      .select("id, sender, subject, email_date, kind, amount, merchant, bank, card_last4, category, credit_card_id, bank_account_id")
      .eq("status", "new")
      .order("email_date", { ascending: false })
      .limit(300),
    supabase.from("credit_cards").select("id, name, issuer").order("display_order", { ascending: true }),
    supabase.from("bank_accounts").select("id, name").order("display_order", { ascending: true }),
    supabase.from("bank_alert_keys").select("created_at, last_used_at").maybeSingle(),
  ]);

  return (
    <InboxClient
      alerts={alertsResult.data || []}
      creditCards={cardsResult.data || []}
      bankAccounts={accountsResult.data || []}
      gmailKey={keyResult.data ?? null}
      supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL!}
      publicKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}
    />
  );
}
