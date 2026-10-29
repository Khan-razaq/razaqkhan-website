"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, accountKey, merchantKey, type Bank, type PaymentMethod } from "@/lib/finance/alerts";

type Confirm = {
  id: string;
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
  category: string;
  // A purchase or transfer comes from one card or account; a card payment
  // moves money from an account to a card, so it needs both.
  creditCardId: string | null;
  bankAccountId: string | null;
};

async function signedIn() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function paymentMethodForCard(card: { name: string; issuer: string } | null): PaymentMethod {
  const s = `${card?.name ?? ""} ${card?.issuer ?? ""}`.toLowerCase();
  if (/amex|american express/.test(s)) return "Amex";
  if (/discover|capital ?one/.test(s)) return "Discover";
  return "Citi";
}

// Records an alert: purchases, transfers and "couldn't read" ones become an
// expense; card payments become a card payment. Remembers the category for
// the merchant and the card for the alert, so next time they're filled in.
export async function confirmAlert(input: Confirm): Promise<{ error: string | null }> {
  const { supabase, user } = await signedIn();
  if (!user) return { error: "Signed out. Sign in and try again." };

  const { data: alert, error: loadError } = await supabase
    .from("bank_alerts")
    .select("id, kind, bank, card_last4, status")
    .eq("id", input.id)
    .single();
  if (loadError || !alert) return { error: loadError?.message ?? "Alert not found." };
  if (alert.status !== "new") return { error: "Already handled." };

  const amount = Math.round(Number(input.amount) * 100) / 100;
  if (!(amount > 0)) return { error: "Amount must be more than zero." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { error: "Pick a date." };

  if (alert.kind === "card_payment") {
    if (!input.creditCardId || !input.bankAccountId) return { error: "Pick the card that was paid and the account it was paid from." };
    const { data: payment, error } = await supabase
      .from("credit_card_payments")
      .insert({
        user_id: user.id,
        credit_card_id: input.creditCardId,
        bank_account_id: input.bankAccountId,
        amount,
        payment_date: input.date,
        notes: "From bank alert",
      })
      .select("id")
      .single();
    if (error || !payment) return { error: error?.message ?? "Couldn't save the payment." };
    await supabase
      .from("bank_alerts")
      .update({ status: "accepted", card_payment_id: payment.id, reviewed_at: new Date().toISOString() })
      .eq("id", alert.id);
  } else {
    if (alert.kind === "income" || alert.kind === "refund") {
      return { error: "Money coming in isn't an expense. Dismiss it, or log it on the Income page." };
    }
    if (!input.creditCardId && !input.bankAccountId) return { error: "Pick the card or account." };
    const category = (CATEGORIES as readonly string[]).includes(input.category) ? input.category : "Other";
    const description = input.description.trim() || "Bank alert";

    let paymentMethod: PaymentMethod = "Debit";
    if (input.creditCardId) {
      const { data: card } = await supabase.from("credit_cards").select("name, issuer").eq("id", input.creditCardId).single();
      paymentMethod = paymentMethodForCard(card);
    }

    const { data: expense, error } = await supabase
      .from("expenses")
      .insert({
        user_id: user.id,
        description: description.charAt(0).toUpperCase() + description.slice(1),
        amount,
        category,
        payment_method: paymentMethod,
        expense_date: input.date,
        credit_card_id: input.creditCardId,
        bank_account_id: input.creditCardId ? null : input.bankAccountId,
      })
      .select("id")
      .single();
    if (error || !expense) return { error: error?.message ?? "Couldn't save the expense." };
    await supabase
      .from("bank_alerts")
      .update({ status: "accepted", expense_id: expense.id, category, reviewed_at: new Date().toISOString() })
      .eq("id", alert.id);

    // Learn the merchant's category.
    const key = merchantKey(description);
    if (key) {
      await supabase
        .from("merchant_categories")
        .upsert({ user_id: user.id, merchant_key: key, category, updated_at: new Date().toISOString() });
    }
  }

  // Learn which card or account this alert means (not for card payments,
  // where the email's bank could be either side).
  const key = accountKey(alert.bank as Bank | null, alert.card_last4);
  if (key && alert.kind !== "card_payment") {
    await supabase.from("alert_accounts").upsert({
      user_id: user.id,
      account_key: key,
      credit_card_id: input.creditCardId,
      bank_account_id: input.creditCardId ? null : input.bankAccountId,
      updated_at: new Date().toISOString(),
    });
  }

  revalidatePath("/finance");
  revalidatePath("/finance/inbox");
  return { error: null };
}

export async function dismissAlert(id: string): Promise<{ error: string | null }> {
  const { supabase, user } = await signedIn();
  if (!user) return { error: "Signed out. Sign in and try again." };
  const { error } = await supabase
    .from("bank_alerts")
    .update({ status: "dismissed", reviewed_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/finance");
  revalidatePath("/finance/inbox");
  return { error: error?.message ?? null };
}

// A new key for the Gmail script (any old key stops working).
export async function createGmailKey(): Promise<{ key: string | null; error: string | null }> {
  const { supabase, user } = await signedIn();
  if (!user) return { key: null, error: "Signed out. Sign in and try again." };
  const { data, error } = await supabase.rpc("create_bank_alert_key");
  revalidatePath("/finance/inbox");
  return { key: (data as string | null) ?? null, error: error?.message ?? null };
}
