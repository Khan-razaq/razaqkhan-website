"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CATEGORIES } from "@/lib/finance/alerts";
import { gmailScript } from "@/lib/finance/gmailScript";
import { confirmAlert, createGmailKey, dismissAlert } from "./actions";

type Alert = {
  id: string;
  sender: string;
  subject: string;
  email_date: string;
  kind: string | null;
  amount: number | null;
  merchant: string | null;
  bank: string | null;
  card_last4: string | null;
  category: string | null;
  credit_card_id: string | null;
  bank_account_id: string | null;
};

type Card = { id: string; name: string; issuer: string };
type Account = { id: string; name: string };

const inputClass =
  "w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300";
const primaryButton =
  "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer hover:bg-blue-600 dark:hover:bg-blue-500 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const secondaryButton =
  "px-3 py-1.5 rounded-md text-sm border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

const BANK_NAMES: Record<string, string> = {
  citi: "Citi",
  amex: "Amex",
  capitalone: "Capital One",
  discover: "Discover",
  chase: "Chase",
  santander: "Santander",
};

const KIND_LABELS: Record<string, { label: string; className: string }> = {
  purchase: { label: "Purchase", className: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300" },
  transfer: { label: "Sent", className: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" },
  card_payment: { label: "Card payment", className: "bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300" },
  income: { label: "Money in", className: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300" },
  refund: { label: "Refund", className: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300" },
  unreadable: { label: "Couldn't read", className: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" },
  ignore: { label: "Not a transaction", className: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400" },
};

function localDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function InboxClient({
  alerts,
  creditCards,
  bankAccounts,
  gmailKey,
  supabaseUrl,
  publicKey,
}: {
  alerts: Alert[];
  creditCards: Card[];
  bankAccounts: Account[];
  gmailKey: { created_at: string; last_used_at: string | null } | null;
  supabaseUrl: string;
  publicKey: string;
}) {
  const waiting = useMemo(() => alerts.filter((a) => a.kind !== "ignore"), [alerts]);
  const skipped = useMemo(() => alerts.filter((a) => a.kind === "ignore"), [alerts]);
  const [showSkipped, setShowSkipped] = useState(false);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 sm:p-6 md:p-12">
      <div className="max-w-2xl mx-auto">
        <header className="mb-6">
          <Link
            href="/finance"
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            ← Back to dashboard
          </Link>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mt-2">Inbox</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Transactions read from your bank alert emails. Check each one, then add it to your expenses.
          </p>
        </header>

        {waiting.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-8 text-center mb-6">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {gmailKey ? "All caught up. New transactions show up here a few minutes after the bank emails you." : "Nothing yet. Set up the Gmail reader below to start."}
            </p>
          </div>
        ) : (
          <div className="space-y-2 mb-6">
            {waiting.map((alert) => (
              <AlertCard key={alert.id} alert={alert} creditCards={creditCards} bankAccounts={bankAccounts} />
            ))}
          </div>
        )}

        {skipped.length > 0 && (
          <section className="mb-6">
            <button
              onClick={() => setShowSkipped(!showSkipped)}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 cursor-pointer"
            >
              {showSkipped ? "▾" : "▸"} {skipped.length} bank {skipped.length === 1 ? "email" : "emails"} skipped as not
              a transaction (offers, statements, reminders)
            </button>
            {showSkipped && (
              <div className="space-y-2 mt-2">
                {skipped.map((alert) => (
                  <AlertCard key={alert.id} alert={alert} creditCards={creditCards} bankAccounts={bankAccounts} />
                ))}
              </div>
            )}
          </section>
        )}

        <GmailSetup gmailKey={gmailKey} supabaseUrl={supabaseUrl} publicKey={publicKey} />
      </div>
    </main>
  );
}

function AlertCard({ alert, creditCards, bankAccounts }: { alert: Alert; creditCards: Card[]; bankAccounts: Account[] }) {
  const router = useRouter();
  const kind = alert.kind ?? "unreadable";
  const isSkipped = kind === "ignore";
  const isMoneyIn = kind === "income" || kind === "refund";
  const isCardPayment = kind === "card_payment";

  // Skipped emails start folded: one tap opens the form if one was real.
  const [open, setOpen] = useState(!isSkipped);
  const [description, setDescription] = useState(alert.merchant ?? "");
  const [amount, setAmount] = useState(alert.amount?.toFixed(2) ?? "");
  const [date, setDate] = useState(localDate(alert.email_date));
  const [category, setCategory] = useState(alert.category ?? "Other");
  // One select covers both cards and accounts for purchases ("card:…" / "account:…").
  const [paidWith, setPaidWith] = useState(
    alert.credit_card_id ? `card:${alert.credit_card_id}` : alert.bank_account_id ? `account:${alert.bank_account_id}` : ""
  );
  const [paidCard, setPaidCard] = useState(alert.credit_card_id ?? "");
  const [fromAccount, setFromAccount] = useState(alert.bank_account_id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const from = BANK_NAMES[alert.bank ?? ""] ?? alert.sender.replace(/<.*>/, "").trim();
  const badge = KIND_LABELS[kind] ?? KIND_LABELS.unreadable;

  const handleConfirm = async () => {
    setBusy(true);
    setError("");
    const result = await confirmAlert({
      id: alert.id,
      description,
      amount: Number(amount),
      date,
      category,
      creditCardId: isCardPayment ? paidCard || null : paidWith.startsWith("card:") ? paidWith.slice(5) : null,
      bankAccountId: isCardPayment ? fromAccount || null : paidWith.startsWith("account:") ? paidWith.slice(8) : null,
    });
    setBusy(false);
    if (result.error) setError(result.error);
    else router.refresh();
  };

  const handleDismiss = async () => {
    setBusy(true);
    const result = await dismissAlert(alert.id);
    setBusy(false);
    if (result.error) setError(result.error);
    else router.refresh();
  };

  return (
    <article className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[11px] px-2 py-0.5 rounded-full ${badge.className}`}>{badge.label}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {from}
              {alert.card_last4 ? ` ••${alert.card_last4}` : ""} · {new Date(alert.email_date).toLocaleDateString()}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1 break-words">
            {alert.merchant ?? alert.subject}
          </p>        </div>
        {alert.amount !== null && (
          <span className="shrink-0 text-sm font-semibold text-gray-900 dark:text-gray-100">${alert.amount.toFixed(2)}</span>
        )}
      </div>

      {isSkipped && !open && (
        <button
          onClick={() => setOpen(true)}
          className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
        >
          This was a transaction, add it
        </button>
      )}

      {open && isMoneyIn && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Money coming in isn&apos;t an expense. Log it on the{" "}
            <Link href="/finance/income" className="text-blue-600 dark:text-blue-400 hover:underline">
              Income page
            </Link>{" "}
            if you want, then dismiss this.
          </p>
          <button onClick={handleDismiss} disabled={busy} className={secondaryButton}>
            Dismiss
          </button>
        </div>
      )}

      {open && !isMoneyIn && (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={isCardPayment ? "Card payment" : "What was it?"}
              aria-label="Description"
              className={`${inputClass} col-span-2`}
            />
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
              aria-label="Amount"
              className={inputClass}
            />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-label="Date"
              className={inputClass}
            />
          </div>

          {isCardPayment ? (
            <div className="grid grid-cols-2 gap-2">
              <select value={paidCard} onChange={(e) => setPaidCard(e.target.value)} aria-label="Card paid" className={inputClass}>
                <option value="">Card paid…</option>
                {creditCards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                value={fromAccount}
                onChange={(e) => setFromAccount(e.target.value)}
                aria-label="Paid from"
                className={inputClass}
              >
                <option value="">Paid from…</option>
                {bankAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category" className={inputClass}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select value={paidWith} onChange={(e) => setPaidWith(e.target.value)} aria-label="Paid with" className={inputClass}>
                <option value="">Paid with…</option>
                <optgroup label="Cards">
                  {creditCards.map((c) => (
                    <option key={c.id} value={`card:${c.id}`}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Accounts">
                  {bankAccounts.map((a) => (
                    <option key={a.id} value={`account:${a.id}`}>
                      {a.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          )}

          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleConfirm} disabled={busy} className={`${primaryButton} flex-1`}>
              {busy ? "Saving…" : isCardPayment ? "✓ Add card payment" : "✓ Add to expenses"}
            </button>
            <button onClick={handleDismiss} disabled={busy} className={secondaryButton}>
              ✕ Dismiss
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

function GmailSetup({
  gmailKey,
  supabaseUrl,
  publicKey,
}: {
  gmailKey: { created_at: string; last_used_at: string | null } | null;
  supabaseUrl: string;
  publicKey: string;
}) {
  const router = useRouter();
  const [script, setScript] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    if (gmailKey && !confirm("Make a new key? The script you set up before will stop working until you paste the new one.")) return;
    setBusy(true);
    setError("");
    const result = await createGmailKey();
    setBusy(false);
    if (!result.key) {
      setError(result.error ?? "Couldn't make a key.");
      return;
    }
    setScript(gmailScript({ key: result.key, supabaseUrl, publicKey }));
    router.refresh();
  };

  const handleCopy = async () => {
    if (!script) return;
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
    } catch {
      setError("Couldn't copy. Select the text and copy it instead.");
    }
  };

  return (
    <details
      open={!gmailKey}
      className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 text-sm text-gray-700 dark:text-gray-300"
    >
      <summary className="cursor-pointer font-medium text-gray-900 dark:text-gray-100">
        Gmail reader{" "}
        <span className="font-normal text-xs text-gray-500 dark:text-gray-400">
          {gmailKey
            ? gmailKey.last_used_at
              ? `· last sent emails ${new Date(gmailKey.last_used_at).toLocaleString()}`
              : "· key made, script hasn't run yet"
            : "· not set up"}
        </span>
      </summary>
      <div className="mt-4 space-y-3">
        <p>
          A small free Google script reads only emails labelled <b>Bank alerts</b> in your Gmail and sends them here
          every 5 minutes. Set it up once:
        </p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>
            Click <b>{gmailKey ? "Make a new key" : "Make my key"}</b> below, then <b>Copy script</b>.
          </li>
          <li>
            Open{" "}
            <a href="https://script.google.com/home" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
              script.google.com
            </a>{" "}
            signed in as your <b>main Gmail</b>, click <b>New project</b>, select everything in the editor, and paste.
          </li>
          <li>
            Click the 💾 save icon. In the function menu at the top choose <b>setup</b>, then click <b>▶ Run</b>.
          </li>
          <li>
            Google asks for permission: <b>Review permissions</b> → your account → <b>Advanced</b> →{" "}
            <b>Go to project (unsafe)</b> → <b>Allow</b>. (&quot;Unsafe&quot; only means Google hasn&apos;t reviewed a
            script you wrote yourself.)
          </li>
        </ol>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          The key lets the script add emails to your inbox here and nothing else. It&apos;s shown only once; making a new
          one turns the old one off.
        </p>
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        {!script ? (
          <button onClick={handleCreate} disabled={busy} className={primaryButton}>
            {busy ? "Making…" : gmailKey ? "Make a new key" : "Make my key"}
          </button>
        ) : (
          <div className="space-y-2">
            <button onClick={handleCopy} className={primaryButton}>
              {copied ? "Copied ✓" : "Copy script"}
            </button>
            <textarea
              readOnly
              value={script}
              rows={8}
              aria-label="Gmail script"
              className={`${inputClass} font-mono text-xs`}
              onFocus={(e) => e.target.select()}
            />
          </div>
        )}
      </div>
    </details>
  );
}
