import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ExpenseTracker from "./ExpenseTracker";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [
    bankAccountsResult,
    creditCardsResult,
    expensesResult,
    depositsResult,
    loanPaymentsResult,
    cardPaymentsResult,
    contributionsResult,
  ] = await Promise.all([
    supabase.from("bank_accounts").select("*").order("display_order", { ascending: true }),
    supabase.from("credit_cards").select("*").order("display_order", { ascending: true }),
    supabase.from("expenses").select("*").order("expense_date", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("income_deposits").select("*"),
    supabase.from("loan_payments").select("*"),
    supabase.from("credit_card_payments").select("*"),
    supabase.from("savings_contributions").select("*"),
  ]);

  const bankAccounts = bankAccountsResult.data || [];
  const creditCards = creditCardsResult.data || [];
  const expenses = expensesResult.data || [];
  const deposits = depositsResult.data || [];
  const loanPayments = loanPaymentsResult.data || [];
  const cardPayments = cardPaymentsResult.data || [];
  const contributions = contributionsResult.data || [];

  if (bankAccounts.length === 0) {
    redirect("/setup");
  }

  return (
    <ExpenseTracker
      bankAccounts={bankAccounts}
      creditCards={creditCards}
      expenses={expenses}
      deposits={deposits}
      loanPayments={loanPayments}
      cardPayments={cardPayments}
      contributions={contributions}
    />
  );
}