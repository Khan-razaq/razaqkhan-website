// Where the "cash expense" Siri shortcut sends what was said ("12.50 at
// Trader Joe's"). Works out the amount and the store, then add_cash_expense
// checks the phone key and adds the expense. The reply is one sentence that
// Siri reads out.

import { createClient } from "@supabase/supabase-js";
import { merchantKey } from "@/lib/finance/alerts";
import { parseCashPhrase } from "@/lib/finance/cashSpeech";

const say = (text: string, status = 200) =>
  new Response(text, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

// Today in Boston, not on the server's clock (UTC), so a late-evening
// purchase isn't dated tomorrow.
function todayInBoston(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}

export async function POST(request: Request) {
  let key: unknown, text: unknown;
  try {
    ({ key, text } = await request.json());
  } catch {
    return say("Something went wrong sending that. Try again.", 400);
  }
  if (typeof key !== "string" || typeof text !== "string" || !text.trim()) {
    return say("I didn't catch that. Try: 12 dollars at Trader Joe's.", 400);
  }
  if (text.length > 300) return say("That was too long. Just say the amount and the store.", 413);

  const phrase = parseCashPhrase(text);
  if (!phrase.ok) return say(phrase.error);

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { data, error } = await supabase.rpc("add_cash_expense", {
    p_key: key,
    p_description: phrase.description,
    p_amount: phrase.amount,
    p_category: phrase.category,
    p_merchant_key: merchantKey(phrase.description),
    p_date: todayInBoston(),
  });
  if (error) {
    return error.message.includes("invalid key")
      ? say("The key in the shortcut is wrong. Copy the phone key from the Inbox page again.", 403)
      : say("Couldn't save it. Try again in a minute.", 500);
  }

  const result = data as { status: string; category: string };
  const money = `$${phrase.amount.toFixed(2)}`;
  if (result.status === "duplicate") return say(`Already added ${money} at ${phrase.description}.`);
  return say(`Added ${money} cash at ${phrase.description}, under ${result.category}.`);
}
