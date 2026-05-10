import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PaymentsForm from "./PaymentsForm";

export default async function PaymentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [bankAccountsResult, creditCardsResult, expensesResult, paymentsResult] = await Promise.all([
    supabase.from("bank_accounts").select("*").order("display_order", { ascending: true }),
    supabase.from("credit_cards").select("*").order("display_order", { ascending: true }),
    supabase.from("expenses").select("*"),
    supabase
      .from("credit_card_payments")
      .select("*")
      .order("payment_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const bankAccounts = bankAccountsResult.data || [];
  const creditCards = creditCardsResult.data || [];
  const expenses = expensesResult.data || [];
  const payments = paymentsResult.data || [];

  if (creditCards.length === 0 || bankAccounts.length === 0) {
    redirect("/setup");
  }

  // Compute current "owed" per card so the form can suggest the right amount
  const cardOwed = creditCards.map((card) => {
    const expensesOnCard = expenses
      .filter((e) => e.credit_card_id === card.id)
      .reduce((sum, e) => sum + Number(e.amount), 0);
    const paymentsToCard = payments
      .filter((p) => p.credit_card_id === card.id)
      .reduce((sum, p) => sum + Number(p.amount), 0);
    return Number(card.starting_balance_owed) + expensesOnCard - paymentsToCard;
  });

  const cardsWithOwed = creditCards.map((card, i) => ({
    ...card,
    current_owed: cardOwed[i],
  }));

  return (
    <PaymentsForm
      bankAccounts={bankAccounts}
      creditCards={cardsWithOwed}
      initialPayments={payments}
    />
  );
}