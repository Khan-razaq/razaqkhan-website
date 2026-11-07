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
import { SCREENSHOT_SENDER, SCREENSHOT_SUBJECT, readTransactionList, screenshotBank } from "./screenshot";

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
//
// Order matters for screenshots: emails and notification screenshots are read
// first, so that when a transaction-list screenshot is split, the purchases
// the inbox already has (with their amounts) are there to be skipped. The
// purchases split out of it are then read in a second pass.
export async function readNewAlerts(supabase: SupabaseClient): Promise<void> {
  await readWaiting(supabase);
  const added = await splitScreenshots(supabase);
  // By id: the same query twice in one page load gets the first answer back
  // (Next reuses identical requests), which wouldn't include these.
  if (added.length) await readWaiting(supabase, added);
}

async function readWaiting(supabase: SupabaseClient, ids?: string[]): Promise<void> {
  let query = supabase
    .from("bank_alerts")
    .select("id, sender, subject, body, email_date, merchant, category, credit_card_id, bank_account_id")
    .eq("status", "new")
    .or(`parser_version.is.null,parser_version.lt.${PARSER_VERSION}`);
  if (ids) query = query.in("id", ids);
  const { data: waiting } = await query.limit(200);
  // Transaction-list screenshots are split into purchases, not read whole.
  const alerts = (waiting ?? []).filter(
    (a) =>
      !(a.sender === SCREENSHOT_SENDER && a.subject === SCREENSHOT_SUBJECT &&
        readTransactionList(a.body, new Date(a.email_date)).length)
  );
  if (!alerts.length) return;

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
        // Keep a name filled in by hand when the email itself has none.
        merchant: parsed.merchant ?? alert.merchant,
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

const BANK_NAMES: Record<Bank, string> = {
  amex: "Amex",
  citi: "Citi",
  capitalone: "Capital One",
  discover: "Discover",
  chase: "Chase",
  santander: "Santander",
};

// A screenshot of a bank app's transaction list holds several purchases.
// Each one the inbox doesn't already have becomes its own alert, written the
// way an alert email would say it, so the email reader reads it. The
// screenshot itself is then put away.
//
// "Already have" means an alert from the same bank for the same amount within
// a day of the purchase, from any source (a notification screenshot, an
// email, an earlier screenshot of the same list). Counting, not just
// matching: two $5.25 coffees on one day stay two.
// Returns the ids of the purchases added.
async function splitScreenshots(supabase: SupabaseClient): Promise<string[]> {
  const added: string[] = [];
  const { data: shots } = await supabase
    .from("bank_alerts")
    .select("id, user_id, message_id, body, email_date")
    .eq("status", "new")
    .eq("sender", SCREENSHOT_SENDER)
    .eq("subject", SCREENSHOT_SUBJECT)
    .is("parser_version", null)
    .order("email_date", { ascending: true })
    .limit(50);

  for (const shot of shots ?? []) {
    const items = readTransactionList(shot.body, new Date(shot.email_date));
    const bank = screenshotBank(shot.body);
    // Not a transaction list (a notification, say): the email reader reads it as it is.
    if (!items.length || !bank) continue;

    const dayMs = 24 * 60 * 60 * 1000;
    const noon = (date: string) => new Date(`${date}T17:00:00Z`); // midday in Boston
    const times = items.map((i) => noon(i.date).getTime());
    const { data: existing } = await supabase
      .from("bank_alerts")
      .select("id, amount, email_date, kind")
      .eq("bank", bank)
      .neq("id", shot.id)
      .gte("email_date", new Date(Math.min(...times) - 2 * dayMs).toISOString())
      .lte("email_date", new Date(Math.max(...times) + 2 * dayMs).toISOString());
    const known = (existing ?? []).filter((a) => a.kind !== "ignore" && a.amount !== null);
    const used = new Set<string>();

    const rows = [];
    for (const item of items) {
      const amount = Math.abs(item.amount);
      const at = noon(item.date).getTime();
      const match = known.find(
        (a) =>
          !used.has(a.id) &&
          Math.abs(Number(a.amount) - amount) < 0.005 &&
          Math.abs(new Date(a.email_date).getTime() - at) <= 1.5 * dayMs
      );
      if (match) {
        used.add(match.id);
        continue;
      }
      const money = `$${amount.toFixed(2)}`;
      const body =
        item.amount > 0
          ? `A ${money} purchase at ${item.merchant}`
          : /payment/i.test(item.merchant)
            ? `We received a payment. Payment Amount: ${money}`
            : `A credit of ${money} from ${item.merchant}`;
      rows.push({
        user_id: shot.user_id,
        // (The very same screenshot sent twice never gets this far: the
        // shortcut endpoint names a screenshot by its text.)
        message_id: `${shot.message_id}:${rows.length}`,
        sender: SCREENSHOT_SENDER,
        subject: `From a screenshot of the ${BANK_NAMES[bank]} app`,
        body: `${BANK_NAMES[bank]}\n${body}`,
        email_date: noon(item.date).toISOString(),
        // Known now, so the next screenshot split before these are read can skip them.
        bank,
        amount,
      });
    }

    if (rows.length) {
      const { data: inserted, error } = await supabase
        .from("bank_alerts")
        .upsert(rows, { onConflict: "user_id,message_id", ignoreDuplicates: true })
        .select("id");
      if (error) continue; // try again next time
      added.push(...(inserted ?? []).map((r) => r.id));
    }
    await supabase
      .from("bank_alerts")
      .update({ status: "dismissed", kind: "ignore", bank, parser_version: PARSER_VERSION, reviewed_at: new Date().toISOString() })
      .eq("id", shot.id);
  }
  return added;
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
