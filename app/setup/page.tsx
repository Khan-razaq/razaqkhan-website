import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SetupForm from "./SetupForm";

export default async function SetupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [bankAccountsResult, creditCardsResult] = await Promise.all([
    supabase.from("bank_accounts").select("*").order("display_order", { ascending: true }),
    supabase.from("credit_cards").select("*").order("display_order", { ascending: true }),
  ]);

  return (
    <SetupForm
      initialBankAccounts={bankAccountsResult.data || []}
      initialCreditCards={creditCardsResult.data || []}
    />
  );
}