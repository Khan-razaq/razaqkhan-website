import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LoansClient from "./LoansClient";

export default async function LoansPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [
    bankAccountsResult,
    loansResult,
    paymentsResult,
    settingsResult,
    goalsResult,
    contributionsResult,
  ] = await Promise.all([
    supabase.from("bank_accounts").select("*").order("display_order", { ascending: true }),
    supabase.from("loans").select("*").order("created_at", { ascending: true }),
    supabase
      .from("loan_payments")
      .select("*")
      .order("payment_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("user_settings").select("*").eq("user_id", user.id).single(),
    supabase.from("savings_goals").select("*").order("display_order", { ascending: true }),
    supabase
      .from("savings_contributions")
      .select("*")
      .order("contribution_date", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  const bankAccounts = bankAccountsResult.data || [];
  const loans = loansResult.data || [];
  const payments = paymentsResult.data || [];
  const settings = settingsResult.data || { inr_to_usd_rate: 90 };
  const goals = goalsResult.data || [];
  const contributions = contributionsResult.data || [];

  return (
    <LoansClient
      bankAccounts={bankAccounts}
      loans={loans}
      payments={payments}
      inrToUsdRate={Number(settings.inr_to_usd_rate)}
      goals={goals}
      contributions={contributions}
    />
  );
}