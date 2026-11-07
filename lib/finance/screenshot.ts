// Reads the text of an iPhone screenshot sent by the phone shortcut.
//
// The shortcut sends whatever the phone's text recognition saw, top to
// bottom. Two kinds of screen are useful:
//
// - A bank app's transaction list (Amex):
//     Nov 2
//     APPLECOM - USA
//     $129.95
//     Plan It
//     EXXONMOBIL
//     CAT OUTSIDE
//     $70.94
//   Each date heading is followed by purchases: a name (sometimes wrapped
//   onto two lines) and its amount. One screenshot holds several purchases.
//
// - A notification ("Amex: We received a payment on your account ending in
//   01003 … Payment Amount: $1,157.79"). That reads like an alert email, so
//   it's left to the email reader.

import type { Bank } from "./alerts";

export const SCREENSHOT_SENDER = "iPhone screenshot";
// The screenshot as sent; the purchases split out of it have their own subject.
export const SCREENSHOT_SUBJECT = "Screenshot";

export type ScreenshotItem = {
  date: string; // YYYY-MM-DD
  merchant: string;
  amount: number; // negative: money back (payments, refunds)
};

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// "Nov 2", "November 2", "Nov 2, 2026", "Today", "Yesterday"
const DATE_HEADING = /^(?:(today|yesterday)|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? (\d{1,2})(?:,? (\d{4}))?)$/i;

// An amount on its own line, or at the end of a name: "$70.94", "-$1,157.79".
const AMOUNT = /(?:^|\s)([-–−]?)\$\s?([\d,]+\.\d{2})$/;

// Things on a bank app screen that aren't part of a purchase.
// (Short lines like "M" stay: they're often the end of a wrapped name.)
const NAV_WORD = "home|membership|offers|account|rewards|payments?|cards?|menu";
const NOISE = new RegExp(
  `^((${NAV_WORD})( (${NAV_WORD}))*|plan it|pending|posted|search|view all|see all|recent activity|transactions|activity|statement|done|back|\\d{1,3}%?)$|^\\d{1,2}:\\d{2}|[•·*]{3,}|^(verizon|at&t|t-mobile)`,
  "i"
);

export function screenshotBank(text: string): Bank | null {
  if (/\bamex\b|american express|skymiles/i.test(text)) return "amex";
  if (/\bciti\b|costco anywhere/i.test(text)) return "citi";
  if (/\bchase\b/i.test(text)) return "chase";
  if (/discover|capital ?one/i.test(text)) return "capitalone";
  if (/santander/i.test(text)) return "santander";
  return null;
}

function headingDate(m: RegExpMatchArray, takenAt: Date): string {
  const day = new Date(takenAt);
  if (m[1]) {
    if (m[1].toLowerCase() === "yesterday") day.setDate(day.getDate() - 1);
  } else {
    const month = MONTHS.indexOf(m[2].toLowerCase());
    let year = m[4] ? Number(m[4]) : takenAt.getFullYear();
    // "Dec 30" in a screenshot taken in January is last year.
    if (!m[4] && month > takenAt.getMonth()) year -= 1;
    day.setFullYear(year, month, Number(m[3]));
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

// The purchases in a transaction-list screenshot, or [] when the screen
// isn't one (no date headings with amounts under them).
export function readTransactionList(text: string, takenAt: Date): ScreenshotItem[] {
  return scanList(text, takenAt).items;
}

// Purchases above the first date heading: the list was scrolled so their
// date is off the top of the screen. Their date can't be known, so they're
// left out, and the phone says so.
export function undatedAtTop(text: string, takenAt: Date): number {
  const { items, undated } = scanList(text, takenAt);
  return items.length ? undated : 0;
}

function scanList(text: string, takenAt: Date): { items: ScreenshotItem[]; undated: number } {
  const items: ScreenshotItem[] = [];
  let undated = 0;
  let date: string | null = null;
  let name: string[] = [];

  for (const raw of text.split(/\n/)) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line) continue;

    const heading = line.match(DATE_HEADING);
    if (heading) {
      date = headingDate(heading, takenAt);
      name = [];
      continue;
    }
    const amount = line.match(AMOUNT);
    if (!date) {
      // Above the first heading: the app's title bar, or purchases whose date scrolled away.
      if (amount) undated++;
      continue;
    }
    if (amount) {
      // The name is on the lines before the amount, or on the same line.
      const before = line.slice(0, amount.index).trim();
      if (before) name.push(before);
      const merchant = joinWrapped(name);
      if (merchant) {
        const value = Number(amount[2].replace(/,/g, ""));
        items.push({ date, merchant, amount: amount[1] ? -value : value });
      }
      name = [];
      continue;
    }
    // Arrows and dots ("›", "•") aren't names.
    if (NOISE.test(line) || !/[\p{L}\d]/u.test(line)) continue;
    name.push(line);
  }
  return { items, undated };
}

// "WWW.BACKMARKET.CO" + "M" -> "WWW.BACKMARKET.COM"; "EXXONMOBIL" + "CAT
// OUTSIDE" -> "EXXONMOBIL CAT OUTSIDE". Only the last two lines count: more
// than that means stray text ended up in front of the name.
function joinWrapped(lines: string[]): string {
  const parts = lines.slice(-2);
  if (parts.length === 2 && parts[1].length <= 3 && !/\s/.test(parts[1])) return parts[0] + parts[1];
  return parts.join(" ").trim();
}
