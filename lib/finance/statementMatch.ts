// Checks a statement against what's recorded for that card or account.
//
// A statement line matches a record with the same amount, going the same way
// (money out or in), dated within a few days (banks post a day or more after
// the purchase). Each record matches one line, so two identical coffees need
// two records.

import type { StatementRow } from "./statementCsv";

export type RecordKind = "expense" | "card_payment" | "income" | "loan_payment" | "savings" | "inbox";

export type MoneyRecord = {
  id: string;
  kind: RecordKind;
  date: string; // YYYY-MM-DD
  amount: number; // money out positive, money in negative (same as statement rows)
  label: string;
};

// Monthly bills recorded as a fixed expense (rent) have no row per month.
export type FixedBill = { name: string; amount: number };

export type LineResult =
  | { row: StatementRow; status: "matched"; record: MoneyRecord }
  | { row: StatementRow; status: "inbox"; record: MoneyRecord } // waiting in the Inbox
  | { row: StatementRow; status: "fixed"; bill: FixedBill }
  | { row: StatementRow; status: "missing" };

export type CheckResult = {
  lines: LineResult[];
  // Recorded in the statement's dates but not on it: maybe a duplicate, a
  // mistake, or on the wrong card.
  notOnStatement: MoneyRecord[];
  from: string;
  to: string;
};

const DAY = 24 * 60 * 60 * 1000;
const days = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / DAY;
export const MATCH_WINDOW_DAYS = 4;

export function checkStatement(rows: StatementRow[], records: MoneyRecord[], fixed: FixedBill[] = []): CheckResult {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const from = sorted[0]?.date ?? "";
  const to = sorted[sorted.length - 1]?.date ?? "";
  const used = new Set<string>();
  const key = (r: MoneyRecord) => `${r.kind}:${r.id}`;

  const pick = (row: StatementRow, inbox: boolean) =>
    records
      .filter(
        (r) =>
          (r.kind === "inbox") === inbox &&
          !used.has(key(r)) &&
          Math.abs(r.amount - row.amount) < 0.005 &&
          days(r.date, row.date) <= MATCH_WINDOW_DAYS
      )
      .sort((a, b) => days(a.date, row.date) - days(b.date, row.date))[0];

  // Recorded first, then waiting in the Inbox, then a monthly bill.
  const lines: LineResult[] = sorted.map((row) => {
    const record = pick(row, false);
    if (record) {
      used.add(key(record));
      return { row, status: "matched", record };
    }
    const waiting = pick(row, true);
    if (waiting) {
      used.add(key(waiting));
      return { row, status: "inbox", record: waiting };
    }
    const bill = row.amount > 0 ? fixed.find((f) => Math.abs(f.amount - row.amount) < 0.005) : undefined;
    if (bill) return { row, status: "fixed", bill };
    return { row, status: "missing" };
  });

  // Only records within the statement's dates: one before its first line
  // may be on the previous statement.
  const notOnStatement = records.filter(
    (r) => r.kind !== "inbox" && !used.has(key(r)) && r.date >= from && r.date <= to
  );

  return { lines, notOnStatement, from, to };
}
