"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CARD_PAYMENT, type StatementRow } from "@/lib/finance/statementCsv";
import { middayOf } from "@/lib/timeZone";
import { MATCH_WINDOW_DAYS, checkStatement, type CheckResult, type FixedBill, type MoneyRecord } from "@/lib/finance/statementMatch";

// "card:<id>" or "account:<id>"
type Target = string;

const MAX_ROWS = 3000;

function parseTarget(target: Target): { kind: "card" | "account"; id: string } | null {
  const m = target.match(/^(card|account):([0-9a-f-]{36})$/);
  return m ? { kind: m[1] as "card" | "account", id: m[2] } : null;
}

// Only well-formed lines get through: the browser sends date, description
// and amount, nothing else.
function cleanRows(rows: unknown): StatementRow[] | null {
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > MAX_ROWS) return null;
  const out: StatementRow[] = [];
  for (const r of rows) {
    const { date, description, amount } = (r ?? {}) as Record<string, unknown>;
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    if (typeof amount !== "number" || !Number.isFinite(amount)) return null;
    out.push({ date, description: String(description ?? "").slice(0, 200), amount: Math.round(amount * 100) / 100 });
  }
  return out;
}

const shift = (date: string, days: number) => new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10);

// Everything recorded for the card or account around the statement's dates,
// as money out (positive) or in (negative), plus what's waiting in the Inbox.
async function recordsFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  target: { kind: "card" | "account"; id: string },
  from: string,
  to: string
): Promise<{ records: MoneyRecord[]; fixed: FixedBill[] }> {
  const lo = shift(from, -MATCH_WINDOW_DAYS);
  const hi = shift(to, MATCH_WINDOW_DAYS);
  const column = target.kind === "card" ? "credit_card_id" : "bank_account_id";
  const records: MoneyRecord[] = [];

  const [expenses, cardPayments, alerts] = await Promise.all([
    supabase.from("expenses").select("id, description, amount, expense_date").eq(column, target.id).gte("expense_date", lo).lte("expense_date", hi),
    supabase.from("credit_card_payments").select("id, amount, payment_date").eq(column, target.id).gte("payment_date", lo).lte("payment_date", hi),
    supabase
      .from("bank_alerts")
      .select("id, kind, amount, merchant, subject, email_date")
      .eq("status", "new")
      .eq(column, target.id)
      .not("amount", "is", null)
      .gte("email_date", lo)
      .lte("email_date", `${hi}T23:59:59Z`),
  ]);

  for (const e of expenses.data ?? []) {
    records.push({ id: e.id, kind: "expense", date: e.expense_date, amount: Number(e.amount), label: e.description });
  }
  for (const p of cardPayments.data ?? []) {
    // A card payment is money into the card, and out of the account it came from.
    const amount = target.kind === "card" ? -Number(p.amount) : Number(p.amount);
    records.push({ id: p.id, kind: "card_payment", date: p.payment_date, amount, label: "Card payment" });
  }
  for (const a of alerts.data ?? []) {
    if (a.kind === "ignore" || a.kind === "own_transfer") continue;
    const moneyIn = a.kind === "income" || a.kind === "refund" || (a.kind === "card_payment" && target.kind === "card");
    records.push({
      id: a.id,
      kind: "inbox",
      date: a.email_date.slice(0, 10),
      amount: moneyIn ? -Number(a.amount) : Number(a.amount),
      label: a.merchant ?? a.subject,
    });
  }

  const fixed: FixedBill[] = [];
  if (target.kind === "account") {
    const [loans, savings, deposits, bills] = await Promise.all([
      supabase.from("loan_payments").select("id, amount, payment_date").eq("bank_account_id", target.id).gte("payment_date", lo).lte("payment_date", hi),
      supabase
        .from("savings_contributions")
        .select("id, amount, contribution_date")
        .eq("bank_account_id", target.id)
        .gte("contribution_date", lo)
        .lte("contribution_date", hi),
      supabase
        .from("income_deposits")
        .select("id, amount, incomes!inner(income_date, source)")
        .eq("bank_account_id", target.id)
        .gte("incomes.income_date", lo)
        .lte("incomes.income_date", hi),
      supabase.from("fixed_expenses").select("name, amount").eq("bank_account_id", target.id).eq("active", true),
    ]);
    for (const l of loans.data ?? []) {
      records.push({ id: l.id, kind: "loan_payment", date: l.payment_date, amount: Number(l.amount), label: "Loan payment" });
    }
    for (const s of savings.data ?? []) {
      records.push({ id: s.id, kind: "savings", date: s.contribution_date, amount: Number(s.amount), label: "Savings" });
    }
    for (const d of deposits.data ?? []) {
      const income = (Array.isArray(d.incomes) ? d.incomes[0] : d.incomes) as { income_date: string; source: string } | null;
      if (!income) continue;
      records.push({ id: d.id, kind: "income", date: income.income_date, amount: -Number(d.amount), label: income.source });
    }
    for (const b of bills.data ?? []) fixed.push({ name: b.name, amount: Number(b.amount) });
  }
  return { records, fixed };
}

export async function runStatementCheck(
  target: Target,
  rawRows: unknown
): Promise<{ result: CheckResult | null; error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { result: null, error: "Signed out. Sign in and try again." };
  const parsed = parseTarget(target);
  const rows = cleanRows(rawRows);
  if (!parsed) return { result: null, error: "Pick the card or account this statement is for." };
  if (!rows) return { result: null, error: "The statement's lines didn't come through. Try the file again." };

  const dates = rows.map((r) => r.date).sort();
  const { records, fixed } = await recordsFor(supabase, parsed, dates[0], dates[dates.length - 1]);
  const result = checkStatement(rows, records, fixed);

  // Remember the check, for the monthly reminder.
  await supabase
    .from("statement_checks")
    .upsert({ user_id: user.id, account_key: target, checked_at: new Date().toISOString(), through_date: result.to });
  revalidatePath("/finance/inbox");
  return { result, error: null };
}

// Statement lines missing from the records go to the Inbox like any alert,
// already tied to the card or account, so they're confirmed the usual way.
export async function addMissingToInbox(target: Target, rawRows: unknown): Promise<{ added: number; error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { added: 0, error: "Signed out. Sign in and try again." };
  const parsed = parseTarget(target);
  const rows = cleanRows(rawRows);
  if (!parsed || !rows) return { added: 0, error: "Nothing to add." };

  const table = parsed.kind === "card" ? "credit_cards" : "bank_accounts";
  const { data: owner } = await supabase.from(table).select("name").eq("id", parsed.id).single();
  if (!owner) return { added: 0, error: "That card or account wasn't found." };

  const seen = new Map<string, number>();
  const alerts = rows.map((row) => {
    const money = `$${Math.abs(row.amount).toFixed(2)}`;
    const what = row.description || "Statement line";
    const body =
      row.amount > 0
        ? `A ${money} purchase at ${what}`
        : parsed.kind === "card" && CARD_PAYMENT.test(what)
          ? `We received a payment. Payment Amount: ${money}`
          : parsed.kind === "card"
            ? `A credit of ${money} from ${what}`
            : `We have successfully deposited the ${money} payment from ${what}`;
    // The same line added twice is one alert (two identical lines stay two).
    const base = `stmt:${target}:${row.date}:${row.amount}:${what.toLowerCase()}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return {
      user_id: user.id,
      message_id: `${base}:${n}`.slice(0, 200),
      sender: "Statement",
      subject: `From your ${owner.name} statement`,
      body,
      email_date: middayOf(row.date),
      amount: Math.abs(row.amount),
      credit_card_id: parsed.kind === "card" ? parsed.id : null,
      bank_account_id: parsed.kind === "account" ? parsed.id : null,
    };
  });

  const { data, error } = await supabase
    .from("bank_alerts")
    .upsert(alerts, { onConflict: "user_id,message_id", ignoreDuplicates: true })
    .select("id");
  revalidatePath("/finance/inbox");
  revalidatePath("/finance");
  return { added: data?.length ?? 0, error: error?.message ?? null };
}
