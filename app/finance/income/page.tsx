import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import IncomeForm from "./IncomeForm";

export default async function IncomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: bankAccounts } = await supabase
    .from("bank_accounts")
    .select("*")
    .order("display_order", { ascending: true });

  if (!bankAccounts || bankAccounts.length === 0) {
    redirect("/finance/setup");
  }

  const { data: incomes } = await supabase
    .from("incomes")
    .select("*, income_deposits(amount, bank_account_id)")
    .order("income_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(10);

  return <IncomeForm bankAccounts={bankAccounts} initialIncomes={incomes || []} />;
}