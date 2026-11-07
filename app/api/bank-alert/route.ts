// Where the iPhone shortcut sends a screenshot's text (double-tap the back of
// the phone on an Amex notification or transaction list).
//
// The phone has no site login, so it sends its phone key instead, the same
// way the Gmail script does; ingest_bank_alert checks the key and saves the
// text for the key's owner. The reply is a short line the shortcut shows as
// a notification.

import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { parseAlert } from "@/lib/finance/alerts";
import { SCREENSHOT_SENDER, SCREENSHOT_SUBJECT, readTransactionList } from "@/lib/finance/screenshot";

const reply = (text: string, status = 200) =>
  new Response(text, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

export async function POST(request: Request) {
  let key: unknown, text: unknown;
  try {
    ({ key, text } = await request.json());
  } catch {
    return reply("Send JSON with key and text.", 400);
  }
  if (typeof key !== "string" || typeof text !== "string" || !text.trim()) {
    return reply("Send JSON with key and text.", 400);
  }
  if (text.length > 20000) return reply("That's too much text for one screenshot.", 413);

  const now = new Date();
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { data: added, error } = await supabase.rpc("ingest_bank_alert", {
    p_key: key,
    // Named by its text: the same screenshot sent twice is saved once.
    p_message_id: `shot-${createHash("sha256").update(text).digest("hex").slice(0, 32)}`,
    p_sender: SCREENSHOT_SENDER,
    p_subject: SCREENSHOT_SUBJECT,
    p_body: text,
    p_email_date: now.toISOString(),
  });
  if (error) {
    return error.message.includes("invalid key")
      ? reply("Wrong key. Make a phone key on the Inbox page and paste it into the shortcut.", 403)
      : reply("Couldn't save it. Try again in a minute.", 500);
  }
  if (!added) return reply("Already sent this one.");

  const items = readTransactionList(text, now);
  // (Ones the Inbox already has are skipped when it's opened, so "new ones".)
  if (items.length) {
    return reply(`Found ${items.length} ${items.length === 1 ? "transaction" : "transactions"}. New ones are in your Inbox.`);
  }
  const { kind, amount } = parseAlert({ sender: SCREENSHOT_SENDER, subject: SCREENSHOT_SUBJECT, body: text });
  if (kind === "ignore") return reply("Sent, but I couldn't see a transaction on this screen.");
  return reply(amount ? `Sent $${amount.toFixed(2)} to your Inbox.` : "Sent to your Inbox.");
}
