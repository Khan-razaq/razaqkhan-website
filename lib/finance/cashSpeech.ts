// Understands what was said to Siri for a cash expense: "12.50 at Trader
// Joe's", "$8 for coffee at Dunkin", "Trader Joe's 20 dollars", "add 15
// bucks cash for groceries at Star Market". Siri writes spoken numbers as
// digits ("twelve fifty" -> "12.50", "twenty dollars" -> "$20"), so only
// digits are read; with no number, it asks again.

import { CATEGORIES, guessCategory, type Category } from "./alerts";

export type CashPhrase =
  | { ok: true; amount: number; description: string; category: Category | null }
  | { ok: false; error: string };

// Spoken filler around the store, taken off the ends only, so "Bank of
// America" and "The Home Depot" keep their words.
const FILLER = new Set(
  "hey siri add added log record a an the expense purchase paid pay spent spend bought buy i in with via by using cash money dollar dollars buck bucks usd cent cents today just please at from for on to of and".split(" ")
);

function trimFiller(s: string): string {
  const words = s.split(" ").filter(Boolean);
  while (words.length && FILLER.has(words[0].toLowerCase())) words.shift();
  while (words.length && FILLER.has(words[words.length - 1].toLowerCase().replace(/[.,!?]+$/, ""))) words.pop();
  return words.join(" ").replace(/[.,!?]+$/, "");
}

// A category named outright ("… for food") wins over guessing.
const SAID_CATEGORY: [RegExp, Category][] = [
  [/\b(food|groceries|grocery|lunch|dinner|breakfast|coffee|snacks?|meal)\b/i, "Food"],
  [/\b(transport|gas|fuel|uber|lyft|taxi|cab|bus|train|parking|toll)\b/i, "Transport"],
  [/\b(shopping|clothes|clothing)\b/i, "Shopping"],
  [/\b(bills?|rent|utilities|phone bill|haircut|laundry)\b/i, "Bills"],
];

// "trader joe's" -> "Trader Joe's", "bank of america atm" -> "Bank of
// America atm"; words Siri already capitalised ("ATM", "iPhone") stay.
const SMALL_WORDS = new Set(["of", "and", "the", "at", "on", "in", "for", "to", "a"]);
const titleCase = (s: string) =>
  s
    .split(" ")
    .map((w, i) =>
      w !== w.toLowerCase() ? w : i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)
    )
    .join(" ");

export function parseCashPhrase(spoken: string): CashPhrase {
  const text = spoken.replace(/\s+/g, " ").trim();

  // "$12.50", "12.50", "12 dollars 50 cents", "1,200"
  const m =
    text.match(/\$\s?(\d[\d,]*(?:\.\d{1,2})?)/) ??
    text.match(/\b(\d[\d,]*)\s*dollars?\s*(?:and\s*)?(\d{1,2})\s*cents?\b/i) ??
    text.match(/\b(\d[\d,]*(?:\.\d{1,2})?)\b/);
  if (!m) return { ok: false, error: "I didn't hear an amount. Try: 12 dollars at Trader Joe's." };
  const amount =
    m[2] !== undefined && /cents?/i.test(m[0])
      ? Number(m[1].replace(/,/g, "")) + Number(m[2]) / 100
      : Number(m[1].replace(/,/g, ""));
  if (!(amount > 0) || amount >= 100000) return { ok: false, error: "That amount doesn't look right. Try again." };

  // The store is what's left: after the last "at" or "from" if there is
  // one ("coffee at Dunkin" -> Dunkin), else after "for", else everything.
  const rest = text.replace(m[0], " ").replace(/\s+/g, " ").trim();
  const place = rest.match(/\b(?:at|from)\s+(.+)$/i)?.[1] ?? rest.match(/\bfor\s+(.+)$/i)?.[1] ?? rest;
  const description = titleCase(trimFiller(place));

  const said = SAID_CATEGORY.find(([re]) => re.test(text))?.[1] ?? null;
  const guessed = description ? guessCategory(description, "purchase") : null;
  const category = said ?? (guessed && guessed !== "Other" ? guessed : null);
  return {
    ok: true,
    amount: Math.round(amount * 100) / 100,
    description: description || "Cash",
    category: (category && (CATEGORIES as readonly string[]).includes(category) ? category : null) as Category | null,
  };
}
