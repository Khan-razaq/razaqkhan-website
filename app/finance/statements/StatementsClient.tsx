"use client";

import { useState } from "react";
import Link from "next/link";
import ThemeToggle from "@/app/ThemeToggle";
import AppSwitcher from "@/app/AppSwitcher";
import { readStatementCsv, type StatementRow } from "@/lib/finance/statementCsv";
import type { CheckResult } from "@/lib/finance/statementMatch";
import { addMissingToInbox, runStatementCheck } from "./actions";

type Target = { key: string; name: string; kind: "card" | "account" };
type Check = { account_key: string; checked_at: string; through_date: string };

const inputClass =
  "w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300";
const primaryButton =
  "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer hover:bg-blue-600 dark:hover:bg-blue-500 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const card = "bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4";

const money = (n: number) => `${n < 0 ? "+" : ""}$${Math.abs(n).toFixed(2)}`;

export default function StatementsClient({ targets, checks }: { targets: Target[]; checks: Check[] }) {
  const [target, setTarget] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileText, setFileText] = useState("");
  const [flip, setFlip] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [added, setAdded] = useState<number | null>(null);

  // Read in the browser; only date, description and amount leave it.
  const read = fileText ? readStatementCsv(fileText, flip) : null;
  const lastCheck = (key: string) => checks.find((c) => c.account_key === key);

  const handleFile = (file: File | undefined) => {
    setResult(null);
    setAdded(null);
    setError("");
    setFlip(false);
    if (!file) return;
    setFileName(file.name);
    file.text().then(setFileText, () => setError("Couldn't open that file."));
  };

  const handleCheck = async () => {
    if (!read?.ok || !target) return;
    setBusy(true);
    setError("");
    setAdded(null);
    const { result: checked, error: failed } = await runStatementCheck(target, read.rows);
    setBusy(false);
    if (failed || !checked) {
      setError(failed ?? "Couldn't check it.");
      return;
    }
    setResult(checked);
    // Every missing line starts ticked.
    setChosen(new Set(checked.lines.flatMap((l, i) => (l.status === "missing" ? [i] : []))));
  };

  const handleAdd = async () => {
    if (!result) return;
    const rows: StatementRow[] = result.lines.filter((_, i) => chosen.has(i)).map((l) => l.row);
    setBusy(true);
    const { added: count, error: failed } = await addMissingToInbox(target, rows);
    setBusy(false);
    if (failed) setError(failed);
    else setAdded(count);
  };

  const missing = result?.lines.map((l, i) => ({ l, i })).filter(({ l }) => l.status === "missing") ?? [];
  const inInbox = result?.lines.filter((l) => l.status === "inbox") ?? [];
  const matched = result?.lines.filter((l) => l.status === "matched" || l.status === "fixed") ?? [];

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 sm:p-6 md:p-12">
      <div className="max-w-2xl mx-auto space-y-4">
        <header className="relative">
          <div className="absolute right-0 top-0 flex items-center gap-2">
            <AppSwitcher />
            <ThemeToggle />
          </div>
          <Link
            href="/finance/inbox"
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            ← Back to Inbox
          </Link>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mt-2">Check a statement</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Compare a bank&apos;s list of transactions with what&apos;s recorded here, to catch anything missed.
          </p>
        </header>

        <section className={`${card} space-y-3`}>
          <label className="block text-sm text-gray-700 dark:text-gray-300">
            Card or account
            <select
              value={target}
              onChange={(e) => {
                setTarget(e.target.value);
                setResult(null);
                setAdded(null);
              }}
              className={`${inputClass} mt-1`}
            >
              <option value="">Pick one…</option>
              {targets.map((t) => {
                const last = lastCheck(t.key);
                return (
                  <option key={t.key} value={t.key}>
                    {t.name}
                    {last ? ` (last checked ${new Date(last.checked_at).toLocaleDateString()})` : " (never checked)"}
                  </option>
                );
              })}
            </select>
          </label>

          <label className="block text-sm text-gray-700 dark:text-gray-300">
            Transactions file (CSV)
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => handleFile(e.target.files?.[0])}
              className="block w-full mt-1 text-sm text-gray-700 dark:text-gray-300 file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-gray-100 dark:file:bg-gray-800 file:text-gray-900 dark:file:text-gray-100 file:cursor-pointer"
            />
          </label>

          {read && !read.ok && <p className="text-xs text-red-600 dark:text-red-400">{read.error}</p>}
          {read?.ok && (
            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
              <p>
                {fileName}: {read.rows.length} transactions, {read.rows.map((r) => r.date).sort()[0]} to{" "}
                {read.rows.map((r) => r.date).sort().at(-1)}.
              </p>
              <p>
                First line: <span className="text-gray-900 dark:text-gray-100">{read.rows[0].description}</span>, read as{" "}
                <b>{read.rows[0].amount > 0 ? "money out" : "money in"}</b> ({money(read.rows[0].amount)}).{" "}
                <button
                  type="button"
                  onClick={() => {
                    setFlip(!flip);
                    setResult(null);
                  }}
                  className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  That&apos;s backwards, flip it
                </button>
              </p>
            </div>
          )}

          <button onClick={handleCheck} disabled={busy || !target || !read?.ok} className={primaryButton}>
            {busy && !result ? "Checking…" : "Check it"}
          </button>
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

          <p className="text-xs text-gray-500 dark:text-gray-400">
            The file is read on this device and isn&apos;t uploaded or kept. Only each line&apos;s date, description and
            amount are compared with your records.
          </p>
        </section>

        {result && (
          <section className={`${card} space-y-4`}>
            <p className="text-sm text-gray-900 dark:text-gray-100">
              {result.from} to {result.to}: <b>{matched.length}</b> recorded, <b>{inInbox.length}</b> waiting in the Inbox,{" "}
              <b className={missing.length ? "text-amber-600 dark:text-amber-400" : ""}>{missing.length}</b> missing.
            </p>

            {missing.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">Missing from your records</h2>
                <ul className="space-y-1">
                  {missing.map(({ l, i }) => (
                    <li key={i}>
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={chosen.has(i)}
                          onChange={(e) => {
                            const next = new Set(chosen);
                            if (e.target.checked) next.add(i);
                            else next.delete(i);
                            setChosen(next);
                          }}
                        />
                        <span className="text-gray-400 dark:text-gray-500">{l.row.date}</span>
                        <span className="flex-1 min-w-0 truncate text-gray-700 dark:text-gray-300">{l.row.description}</span>
                        <span className="text-gray-900 dark:text-gray-100">{money(l.row.amount)}</span>
                      </label>
                    </li>
                  ))}
                </ul>
                {added === null ? (
                  <button onClick={handleAdd} disabled={busy || chosen.size === 0} className={primaryButton}>
                    {busy ? "Adding…" : `Add ${chosen.size} to the Inbox`}
                  </button>
                ) : (
                  <p className="text-xs text-teal-600 dark:text-teal-400">
                    Added {added} to the{" "}
                    <Link href="/finance/inbox" className="underline">
                      Inbox
                    </Link>
                    : confirm them there as usual.
                  </p>
                )}
              </div>
            )}

            {result.notOnStatement.length > 0 && (
              <div className="space-y-1">
                <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">Recorded but not on the statement</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Maybe a duplicate, a wrong amount, or put on the wrong card. Fix it on the dashboard if so.
                </p>
                <ul className="space-y-1">
                  {result.notOnStatement.map((r) => (
                    <li key={`${r.kind}-${r.id}`} className="flex items-center gap-2 text-xs">
                      <span className="text-gray-400 dark:text-gray-500">{r.date}</span>
                      <span className="flex-1 min-w-0 truncate text-gray-700 dark:text-gray-300">{r.label}</span>
                      <span className="text-gray-900 dark:text-gray-100">{money(r.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {inInbox.length > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {inInbox.length} {inInbox.length === 1 ? "line is" : "lines are"} already waiting in the{" "}
                <Link href="/finance/inbox" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Inbox
                </Link>
                .
              </p>
            )}

            {matched.length > 0 && (
              <details className="text-xs text-gray-500 dark:text-gray-400">
                <summary className="cursor-pointer">{matched.length} already recorded</summary>
                <ul className="mt-2 space-y-1">
                  {matched.map((l, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="text-gray-400 dark:text-gray-500">{l.row.date}</span>
                      <span className="flex-1 min-w-0 truncate">
                        {l.row.description}
                        {l.status === "fixed" ? ` (monthly bill: ${l.bill.name})` : ""}
                      </span>
                      <span>{money(l.row.amount)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        )}

        <details className={`${card} text-sm text-gray-700 dark:text-gray-300`}>
          <summary className="cursor-pointer font-medium text-gray-900 dark:text-gray-100">Where to get the CSV</summary>
          <ul className="mt-3 space-y-1 text-xs list-disc pl-5">
            <li>
              <b>Chase</b> (website): open the account → the download icon above transactions → pick the dates → File type{" "}
              <b>CSV</b>.
            </li>
            <li>
              <b>Amex</b> (website): Statements &amp; Activity → Download → <b>CSV</b>.
            </li>
            <li>
              <b>Citi</b> (website): open the card → Download → <b>CSV</b>.
            </li>
            <li>
              <b>Capital One / Discover</b> (website): open the card → View transactions → Download → <b>CSV</b>.
            </li>
            <li>
              <b>Santander</b> (website): open the account → Download transactions → <b>CSV</b>.
            </li>
          </ul>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Use the CSV, not the PDF: it has only date, description and amount, no address or account number. Bank
            menus change; look for &quot;Download&quot; near the transactions.
          </p>
        </details>
      </div>
    </main>
  );
}
