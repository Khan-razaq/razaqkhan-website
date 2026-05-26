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
    fixedExpensesResult,
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
    supabase.from("fixed_expenses").select("*").eq("active", true),
  ]);

  const bankAccounts = bankAccountsResult.data || [];
  const loans = loansResult.data || [];
  const payments = paymentsResult.data || [];
  const settings = settingsResult.data || {
    inr_to_usd_rate: 90,
    monthly_buffer_usd: 500,
    expected_monthly_income_usd: 0,
  };
  const goals = goalsResult.data || [];
  const contributions = contributionsResult.data || [];
  const fixedExpenses = fixedExpensesResult.data || [];

  return (
    <LoansClient
      bankAccounts={bankAccounts}
      loans={loans}
      payments={payments}
      inrToUsdRate={Number(settings.inr_to_usd_rate)}
      monthlyBuffer={Number(settings.monthly_buffer_usd ?? 500)}
      expectedMonthlyIncome={Number(settings.expected_monthly_income_usd ?? 0)}
      goals={goals}
      contributions={contributions}
      fixedExpenses={fixedExpenses}
    />
  );
}