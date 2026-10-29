import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PARSER_VERSION,
  accountKey,
  guessCategory,
  isCardBank,
  merchantKey,
  parseAlert,
  type Bank,
} from "./alerts";

type Account = { id: string; name: string; issuer?: string };

// Bank names as they might appear in a card's or account's name.
const BANK_WORDS: Record<Bank, RegExp> = {
  citi: /citi|costco/i,
  amex: /amex|american express/i,
  capitalone: /discover|capital ?one/i,
  discover: /discover|capital ?one/i,
  chase: /chase/i,
  santander: /santander/i,
};

// Reads alert emails that arrived since the last visit (or that an older
// version of the reader read), and fills in what they say: kind, amount,
// merchant, a category, and the card or account they're probably about.
export async function readNewAlerts(supabase: SupabaseClient): Promise<void> {
  const { data: alerts } = await supabase
    .from("bank_alerts")
    .select("id, sender, subject, body, category, credit_card_id, bank_account_id")
    .eq("status", "new")
    .or(`parser_version.is.null,parser_version.lt.${PARSER_VERSION}`)
    .limit(200);
  if (!alerts?.length) return;

  const [{ data: cards }, { data: accounts }, { data: learnedCategories }, { data: learnedAccounts }] =
    await Promise.all([
      supabase.from("credit_cards").select("id, name, issuer"),
      supabase.from("bank_accounts").select("id, name"),
      supabase.from("merchant_categories").select("merchant_key, category"),
      supabase.from("alert_accounts").select("account_key, credit_card_id, bank_account_id"),
    ]);
  const categoryFor = new Map((learnedCategories ?? []).map((r) => [r.merchant_key, r.category as string]));
  const accountFor = new Map((learnedAccounts ?? []).map((r) => [r.account_key, r]));

  for (const alert of alerts) {
    const parsed = parseAlert(alert);
    const key = accountKey(parsed.bank, parsed.cardLast4);
    const learned = (key && accountFor.get(key)) || (parsed.bank && accountFor.get(parsed.bank)) || null;

    let creditCardId: string | null = alert.credit_card_id;
    let bankAccountId: string | null = alert.bank_account_id;
    if (!creditCardId && !bankAccountId) {
      if (learned) {
        creditCardId = learned.credit_card_id;
        bankAccountId = learned.bank_account_id;
      } else if (parsed.bank) {
        // Only when exactly one card (or account) fits the bank: two Citi
        // cards means asking, not guessing.
        const words = BANK_WORDS[parsed.bank];
        const pool: Account[] = isCardBank(parsed.bank) ? cards ?? [] : accounts ?? [];
        let fits = pool.filter((a) => words.test(`${a.name} ${a.issuer ?? ""}`));
        // Debit card alerts and Zelle come from checking, not savings.
        if (fits.length > 1 && !isCardBank(parsed.bank)) {
          fits = fits.filter((a) => /checking/i.test(a.name));
        }
        if (fits.length === 1) {
          if (isCardBank(parsed.bank)) creditCardId = fits[0].id;
          else bankAccountId = fits[0].id;
        }
      }
    }

    const category =
      alert.category ??
      (parsed.merchant && categoryFor.get(merchantKey(parsed.merchant))) ??
      guessCategory(parsed.merchant, parsed.kind);

    await supabase
      .from("bank_alerts")
      .update({
        kind: parsed.kind,
        amount: parsed.amount,
        merchant: parsed.merchant,
        bank: parsed.bank,
        card_last4: parsed.cardLast4,
        category,
        credit_card_id: creditCardId,
        bank_account_id: bankAccountId,
        parser_version: PARSER_VERSION,
      })
      .eq("id", alert.id);
  }
}

// How many alerts are waiting for review (for the badge on the dashboard).
export async function countWaitingAlerts(supabase: SupabaseClient): Promise<number> {
  const { count } = await supabase
    .from("bank_alerts")
    .select("id", { count: "exact", head: true })
    .eq("status", "new")
    .or("kind.is.null,kind.neq.ignore");
  return count ?? 0;
}
