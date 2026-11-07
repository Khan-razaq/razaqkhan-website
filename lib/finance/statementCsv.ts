// Reads a bank's "download transactions" CSV in the browser and keeps only
// what the statement check needs: date, description and amount. Anything
// else in the file (card number column, balance, category) is dropped here
// and never sent anywhere.
//
// Banks lay their CSVs out differently:
//   Chase card:    Transaction Date,Post Date,Description,Category,Type,Amount,Memo   (spending negative)
//   Chase account: Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #
//   Amex:          Date,Description,Amount                                        (spending positive)
//   Citi:          Status,Date,Description,Debit,Credit
//   Capital One:   Transaction Date,Posted Date,Card No.,Description,Category,Debit,Credit
//   Discover:      Trans. Date,Post Date,Description,Amount,Category              (spending positive)
// so columns are found by their header names, and which sign means spending
// is worked out from the file (and can be flipped by hand).

export type StatementRow = {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // money out positive (purchases, payments made); money in negative
};

export type ReadResult =
  | { ok: true; rows: StatementRow[]; flippedSigns: boolean; columns: { date: string; description: string; amount: string } }
  | { ok: false; error: string };

// One CSV line into fields, honouring "quoted, fields" and "" escapes.
function splitLine(line: string): string[] {
  const fields: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      fields.push(field);
      field = "";
    } else field += ch;
  }
  fields.push(field);
  return fields.map((f) => f.trim());
}

// Lines, keeping line breaks inside quotes as part of the field.
function splitLines(text: string): string[] {
  const lines: string[] = [];
  let line = "";
  let quoted = false;
  for (const ch of text.replace(/^﻿/, "")) {
    if (ch === '"') quoted = !quoted;
    if ((ch === "\n" || ch === "\r") && !quoted) {
      if (line.trim()) lines.push(line);
      line = "";
    } else line += ch;
  }
  if (line.trim()) lines.push(line);
  return lines;
}

// Paying off a card, as statements word it. ("Zelle payment to …" isn't.)
export const CARD_PAYMENT = /thank you|autopay|(online|mobile|internet|electronic) payment|payment received|pymt/i;

const find = (headers: string[], ...names: RegExp[]) => {
  for (const re of names) {
    const i = headers.findIndex((h) => re.test(h));
    if (i >= 0) return i;
  }
  return -1;
};

// "10/29/2026", "2026-10-29", "10/29/26", "29 Oct 2026" -> "2026-10-29"
function toDate(s: string): string | null {
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${year}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  const d = new Date(t);
  if (!Number.isNaN(d.getTime()) && /[a-z]/i.test(t)) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return null;
}

// "$1,234.56", "-12.50", "(12.50)", "" -> number or null
function toAmount(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const negative = /^\(.*\)$/.test(t) || /^-/.test(t) || /-$/.test(t);
  const n = Number(t.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n) || !/\d/.test(t)) return null;
  return Math.round((negative ? -n : n) * 100) / 100;
}

export function readStatementCsv(text: string, flip = false): ReadResult {
  const lines = splitLines(text);
  // The header is the first line naming a date and an amount-ish column
  // (some banks put a title or account line above it).
  const headerAt = lines.findIndex((l) => /date/i.test(l) && /(amount|debit|credit)/i.test(l));
  if (headerAt < 0) {
    return { ok: false, error: "This doesn't look like a transactions CSV: there's no Date and Amount header." };
  }
  const headers = splitLine(lines[headerAt]).map((h) => h.toLowerCase());

  const dateCol = find(headers, /^trans(action|\.)? ?date$/, /^date$/, /^post(ed|ing)? ?date$/, /date/);
  const descCol = find(headers, /^description$/, /^(merchant|payee|name)$/, /description|details|memo/);
  const amountCol = find(headers, /^amount$/, /amount/);
  const debitCol = find(headers, /^debit$/, /debit|withdrawal/);
  const creditCol = find(headers, /^credit$/, /credit|deposit/);
  if (dateCol < 0 || descCol < 0 || (amountCol < 0 && debitCol < 0)) {
    return { ok: false, error: "Couldn't find the Date, Description and Amount columns in this file." };
  }

  const rows: StatementRow[] = [];
  for (const line of lines.slice(headerAt + 1)) {
    const f = splitLine(line);
    const date = toDate(f[dateCol] ?? "");
    if (!date) continue; // totals, blank or footer lines
    const description = (f[descCol] ?? "").replace(/\s+/g, " ").trim();
    let amount: number | null;
    if (amountCol >= 0) {
      amount = toAmount(f[amountCol] ?? "");
    } else {
      // Separate columns: Debit is money out, Credit is money in.
      const debit = toAmount(f[debitCol] ?? "");
      const credit = creditCol >= 0 ? toAmount(f[creditCol] ?? "") : null;
      amount = debit !== null && debit !== 0 ? Math.abs(debit) : credit !== null ? -Math.abs(credit) : null;
    }
    if (amount === null || amount === 0) continue;
    rows.push({ date, description, amount });
  }
  if (!rows.length) return { ok: false, error: "Found the columns, but no transactions under them." };

  // One Amount column: banks disagree on the sign. A card payment ("Payment
  // Thank You", "AUTOPAY") is always money in, so its sign settles it; with
  // none, whichever sign most lines have is spending.
  let flippedSigns = false;
  if (amountCol >= 0) {
    const payments = rows.filter((r) => CARD_PAYMENT.test(r.description));
    flippedSigns = payments.length
      ? payments.filter((r) => r.amount > 0).length > payments.length / 2
      : rows.filter((r) => r.amount < 0).length > rows.length / 2;
  }
  if (flip) flippedSigns = !flippedSigns;
  if (flippedSigns) for (const r of rows) r.amount = -r.amount;

  return {
    ok: true,
    rows,
    flippedSigns,
    columns: {
      date: headers[dateCol],
      description: headers[descCol],
      amount: amountCol >= 0 ? headers[amountCol] : `${headers[debitCol]} / ${creditCol >= 0 ? headers[creditCol] : "-"}`,
    },
  };
}
