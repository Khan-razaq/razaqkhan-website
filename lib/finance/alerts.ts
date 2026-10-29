// Reads a bank alert email: is it a transaction, and if so how much, where,
// and on which card or account.
//
// Free and rule-based (no AI service): it looks for the phrases banks use in
// transaction alerts ("A $12.50 transaction was made at …", "You sent $40 to
// …") and skips promotions, statements and reminders. When it sees an amount
// but can't tell what the email is, it says "unreadable" rather than guess,
// so the email still shows up for a person to look at.
//
// Bump PARSER_VERSION after changing the rules: saved emails read with an
// older version are read again.

export const PARSER_VERSION = 1;

export type AlertKind = "purchase" | "refund" | "transfer" | "card_payment" | "income" | "ignore" | "unreadable";

export type Bank = "citi" | "amex" | "capitalone" | "discover" | "chase" | "santander";

export type ParsedAlert = {
  kind: AlertKind;
  amount: number | null;
  merchant: string | null;
  bank: Bank | null;
  cardLast4: string | null;
};

const BANKS: { bank: Bank; re: RegExp }[] = [
  { bank: "citi", re: /citi(bank|cards)?\.com/i },
  { bank: "amex", re: /americanexpress\.com|aexp\.com/i },
  { bank: "capitalone", re: /capitalone\.com/i },
  { bank: "discover", re: /discover\.com/i },
  { bank: "chase", re: /chase\.com/i },
  { bank: "santander", re: /santander/i },
];

export function bankOf(sender: string): Bank | null {
  return BANKS.find((b) => b.re.test(sender))?.bank ?? null;
}

// Newsletters, offers, statements, reminders, security notices.
const NOT_A_TRANSACTION =
  /\b(statement is (ready|available)|your (monthly )?statement|payment (is )?due|due date|upcoming payment|payment reminder|autopay (is )?(scheduled|set up|on)|scheduled payment|minimum payment|credit (score|limit increase)|offer|rewards?|earn \d|cash ?back|points|bonus|% (apr|off)|apply now|pre-?approved|upgrade|survey|feedback|tell us|how did we do|sign[- ]?in|log ?in|password|verification code|one-time (code|passcode)|security alert|new device|profile (was )?updated|e-?mail address (was )?(changed|updated)|paperless|privacy|terms|webinar|invite)\b/i;

const MONEY = String.raw`\$\s?([\d,]+(?:\.\d{2})?)`;

function money(s: string | undefined): number | null {
  if (!s) return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

// "STARBUCKS STORE 1234 on 10/29/2026 at 3:41 PM" -> "STARBUCKS STORE 1234"
function cleanMerchant(raw: string | undefined): string | null {
  if (!raw) return null;
  const m = raw
    .replace(/\s+/g, " ")
    .replace(/\s*\((?:confirmation|ref|reference)[^)]*\)/i, "")
    .split(/\s+(?:on|at \d|was|has|for|using|with your|from your|ending|card|account|\d{1,2}\/\d{1,2})\b|[.,;!|]\s|\s-\s|\s{2,}/i)[0]
    .replace(/[.,;:!]+$/, "")
    .trim();
  return m.length >= 2 && m.length <= 60 ? m : null;
}

function last4(text: string): string | null {
  return (
    text.match(/(?:ending(?: in)?|last (?:4|four)(?: digits)?(?: of)?|card|account)[^\d\n]{0,25}?(\d{4})\b/i)?.[1] ??
    text.match(/(?:\.{2,}|\*{2,}|x{2,})\s?(\d{4})\b/i)?.[1] ??
    null
  );
}

// The patterns banks use, most specific first. Each returns the amount and
// (when the email names one) the other party.
const PATTERNS: { kind: AlertKind; re: RegExp; amount: number; who?: number }[] = [
  // Paying off a card ("We received your $250.00 payment", "Payment of $250 posted")
  { kind: "card_payment", re: new RegExp(`(?:received|posted|processed|applied)[^.\\n]{0,40}?payment of ${MONEY}`, "i"), amount: 1 },
  { kind: "card_payment", re: new RegExp(`(?:received|posted|processed)[^.\\n]{0,20}?${MONEY}[^.\\n]{0,10}?payment`, "i"), amount: 1 },
  { kind: "card_payment", re: new RegExp(`payment of ${MONEY}[^.\\n]{0,40}?(?:has been |was )?(?:received|posted|processed|applied|credited)`, "i"), amount: 1 },
  { kind: "card_payment", re: new RegExp(`(?:your )?${MONEY} payment (?:has been |was )?(?:received|posted|processed|applied)`, "i"), amount: 1 },
  { kind: "card_payment", re: new RegExp(`thank you for (?:your|the) (?:${MONEY} )?payment`, "i"), amount: 1 },

  // Zelle / transfers out ("You sent $40.00 to Alex")
  { kind: "transfer", re: new RegExp(`you sent ${MONEY} to ([^\\n]+)`, "i"), amount: 1, who: 2 },
  { kind: "transfer", re: new RegExp(`(?:zelle|transfer|payment) of ${MONEY} (?:was )?sent to ([^\\n]+)`, "i"), amount: 1, who: 2 },
  { kind: "transfer", re: new RegExp(`${MONEY} (?:was )?sent to ([^\\n]+)`, "i"), amount: 1, who: 2 },

  // Money in ("deposited the $1500.00 payment from NAME", "You received $40 from")
  { kind: "income", re: new RegExp(`(?:deposited|received)(?: the)? ${MONEY}(?: payment)? from ([^\\n]+)`, "i"), amount: 1, who: 2 },
  { kind: "income", re: new RegExp(`(?:direct )?deposit of ${MONEY}(?: from ([^\\n]+))?`, "i"), amount: 1, who: 2 },

  // Refunds and credits
  { kind: "refund", re: new RegExp(`(?:refund|credit|return) of ${MONEY}(?: (?:from|at|by) ([^\\n]+))?`, "i"), amount: 1, who: 2 },
  { kind: "refund", re: new RegExp(`${MONEY} (?:refund|credit) (?:from|at|by) ([^\\n]+)`, "i"), amount: 1, who: 2 },

  // Purchases
  { kind: "purchase", re: new RegExp(`(?:a |an |your )?${MONEY} (?:transaction|purchase|charge|debit card transaction|card transaction)(?: was)?(?: made| approved| authorized)?(?: at| with| to| from)? ([^\\n]+)`, "i"), amount: 1, who: 2 },
  { kind: "purchase", re: new RegExp(`(?:transaction|purchase|charge|charged|spent)(?: of)? ${MONEY}(?: was made| was approved)? (?:at|with|to|from|on) ([^\\n]+)`, "i"), amount: 1, who: 2 },
  { kind: "purchase", re: new RegExp(`you made a ${MONEY} (?:transaction|purchase|payment) (?:with|at|to) ([^\\n]+)`, "i"), amount: 1, who: 2 },
  // "at STAR MARKET 123, a pending authorization or purchase in the amount of $54.12"
  { kind: "purchase", re: new RegExp(`\\bat ([^,\\n]{2,60}),? (?:a |an )?(?:pending authorization or purchase|purchase|charge|transaction|authorization) in the amount of ${MONEY}`, "i"), amount: 2, who: 1 },
  { kind: "purchase", re: new RegExp(`(?:purchase|charge|transaction|authorization) in the amount of ${MONEY}(?: (?:at|with) ([^\\n]+))?`, "i"), amount: 1, who: 2 },
  { kind: "purchase", re: new RegExp(`(?:merchant|description|where)\\s*:?\\s*([^\\n$]{2,60})\\n?[^$]{0,80}?(?:amount|total)\\s*:?\\s*${MONEY}`, "i"), amount: 2, who: 1 },
  { kind: "purchase", re: new RegExp(`(?:amount|total)\\s*:?\\s*${MONEY}[^$]{0,80}?(?:merchant|description|where)\\s*:?\\s*([^\\n$]{2,60})`, "i"), amount: 1, who: 2 },
];

const LOOKS_LIKE_TRANSACTION = /\b(transaction|purchase|charge[ds]?|spent|approved|authori[sz]ed|debit|sent|zelle|deposit(ed)?|refund|payment (received|posted))\b/i;

export function parseAlert(email: { sender: string; subject: string; body: string }): ParsedAlert {
  const bank = bankOf(email.sender);
  // Subject first: it's usually the clearest line.
  const text = `${email.subject}\n${email.body}`
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n");
  const card = last4(text);

  for (const p of PATTERNS) {
    // Every occurrence, not just the first: the subject often repeats the
    // body's words without the amount ("Thank you for your payment").
    for (const m of text.matchAll(new RegExp(p.re.source, `${p.re.flags}g`))) {
      const amount = money(m[p.amount]);
      if (amount === null) continue;
      return { kind: p.kind, amount, merchant: p.who ? cleanMerchant(m[p.who]) : null, bank, cardLast4: card };
    }
  }

  // No known pattern. Promotions and notices are skipped; something that has
  // an amount and transaction words is shown as "couldn't read".
  const amount = money(text.match(new RegExp(MONEY))?.[1]);
  if (amount !== null && LOOKS_LIKE_TRANSACTION.test(text) && !NOT_A_TRANSACTION.test(email.subject)) {
    return { kind: "unreadable", amount, merchant: null, bank, cardLast4: card };
  }
  return { kind: "ignore", amount: null, merchant: null, bank, cardLast4: card };
}

// ---------------------------------------------------------------------------
// Categories and payment methods, matching the expense form
// ---------------------------------------------------------------------------

export const CATEGORIES = ["Food", "Transport", "Shopping", "Bills", "Other"] as const;
export type Category = (typeof CATEGORIES)[number];

export function merchantKey(merchant: string): string {
  return merchant
    .toLowerCase()
    .replace(/\b(store|#|no\.?)\s*\d+\b/g, " ")
    .replace(/\d{3,}/g, " ")
    .replace(/[^a-z& ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const CATEGORY_WORDS: [Category, RegExp][] = [
  ["Food", /uber\W*eats|doordash|grubhub|instacart|starbucks|dunkin|coffee|caf[eé]|restaurant|kitchen|grill|pizza|burger|taco|sushi|ramen|thai|bakery|chipotle|mcdonald|subway|wendy|chick-?fil|panera|sweetgreen|shake shack|trader joe|whole foods|star market|stop ?& ?shop|wegmans|h ?mart|market basket|aldi|grocery|food|deli|bar\b|pub\b/],
  ["Transport", /\buber\b|lyft|mbta|charlie|transit|amtrak|parking|park(ing)? meter|\bgas\b|shell|exxon|mobil|chevron|sunoco|citgo|bp\b|airline|delta|jetblue|united|american air|southwest|spirit|frontier|toll|ez ?pass|zipcar|bluebikes/],
  ["Bills", /verizon|t-?mobile|at&t|total wireless|mint mobile|comcast|xfinity|eversource|national grid|electric|utility|water|insurance|geico|progressive|state farm|netflix|spotify|hulu|disney|youtube|apple\.com|icloud|google|adobe|chatgpt|openai|anthropic|claude|subscription|rent|landlord|gym|planet fitness/],
  ["Shopping", /amazon|amzn|target|walmart|costco|best buy|apple store|ikea|marshalls|tj ?maxx|home ?goods|nike|uniqlo|zara|h&m|macy|nordstrom|cvs|walgreens|ebay|etsy|shein|temu/],
];

export function guessCategory(merchant: string | null, kind: AlertKind): Category {
  if (kind === "transfer") return "Other";
  const m = merchant?.toLowerCase() ?? "";
  return CATEGORY_WORDS.find(([, re]) => re.test(m))?.[0] ?? "Other";
}

// The expense form's payment methods.
export type PaymentMethod = "Discover" | "Amex" | "Citi" | "Cash" | "Debit";

export function paymentMethodFor(bank: Bank | null): PaymentMethod {
  switch (bank) {
    case "citi":
      return "Citi";
    case "amex":
      return "Amex";
    case "discover":
    case "capitalone": // Discover is part of Capital One
      return "Discover";
    default:
      return "Debit";
  }
}

// Which card or account an alert belongs to, as a key that can be
// remembered: "citi 1234", or just "amex" when the email has no digits.
export function accountKey(bank: Bank | null, cardLast4: string | null): string | null {
  if (!bank) return null;
  return cardLast4 ? `${bank} ${cardLast4}` : bank;
}

export function isCardBank(bank: Bank | null): boolean {
  return bank === "citi" || bank === "amex" || bank === "discover" || bank === "capitalone";
}
