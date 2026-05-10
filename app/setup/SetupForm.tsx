"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type AccountType = "checking" | "saving";

type BankAccountRow = {
  id: string;
  name: string;
  type: AccountType;
  starting_balance: number;
  paycheck_split_percent: number;
  display_order: number;
};

type CreditCardRow = {
  id: string;
  name: string;
  issuer: string;
  credit_limit: number;
  starting_balance_owed: number;
  payment_due_day: number | null;
  display_order: number;
};

type BankAccountInput = {
  id?: string;
  name: string;
  type: AccountType;
  starting_balance: string;
  paycheck_split_percent: string;
};

type CreditCardInput = {
  id?: string;
  name: string;
  issuer: string;
  credit_limit: string;
  starting_balance_owed: string;
  payment_due_day: string;
};

const PAYCHECK_AMOUNT = 2038.50;

export default function SetupForm({
  initialBankAccounts,
  initialCreditCards,
}: {
  initialBankAccounts: BankAccountRow[];
  initialCreditCards: CreditCardRow[];
}) {
  const router = useRouter();
  const supabase = createClient();

  // Bank accounts state
  const initialBanks: BankAccountInput[] =
    initialBankAccounts.length > 0
      ? initialBankAccounts.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          starting_balance: a.starting_balance.toString(),
          paycheck_split_percent: a.paycheck_split_percent.toString(),
        }))
      : [
          { name: "", type: "checking", starting_balance: "0", paycheck_split_percent: "0" },
          { name: "", type: "checking", starting_balance: "0", paycheck_split_percent: "0" },
          { name: "", type: "saving", starting_balance: "0", paycheck_split_percent: "0" },
        ];

  // Credit cards state
  const initialCards: CreditCardInput[] =
    initialCreditCards.length > 0
      ? initialCreditCards.map((c) => ({
          id: c.id,
          name: c.name,
          issuer: c.issuer,
          credit_limit: c.credit_limit.toString(),
          starting_balance_owed: c.starting_balance_owed.toString(),
          payment_due_day: c.payment_due_day?.toString() || "",
        }))
      : [
          { name: "Discover", issuer: "Discover", credit_limit: "0", starting_balance_owed: "0", payment_due_day: "" },
          { name: "Amex", issuer: "American Express", credit_limit: "0", starting_balance_owed: "0", payment_due_day: "" },
          { name: "Citi", issuer: "Citibank", credit_limit: "0", starting_balance_owed: "0", payment_due_day: "" },
        ];

  const [banks, setBanks] = useState<BankAccountInput[]>(initialBanks);
  const [cards, setCards] = useState<CreditCardInput[]>(initialCards);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const updateBank = (idx: number, field: keyof BankAccountInput, value: string) => {
    setBanks(banks.map((a, i) => (i === idx ? { ...a, [field]: value } : a)));
  };

  const updateCard = (idx: number, field: keyof CreditCardInput, value: string) => {
    setCards(cards.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  };

  const totalSplitPercent = banks.reduce(
    (sum, a) => sum + (parseFloat(a.paycheck_split_percent) || 0),
    0
  );

  const splitPreview = banks.map((a) => ({
    name: a.name || "(unnamed)",
    amount: ((parseFloat(a.paycheck_split_percent) || 0) / 100) * PAYCHECK_AMOUNT,
  }));

  const handleSave = async () => {
    setError("");
    setSuccess(false);

    // Validate banks
    for (const a of banks) {
      if (!a.name.trim()) {
        setError("All bank accounts must have a name.");
        return;
      }
    }
    if (Math.abs(totalSplitPercent - 100) > 0.01) {
      setError(`Paycheck split must total 100%. Currently: ${totalSplitPercent.toFixed(2)}%`);
      return;
    }

    // Validate cards
    for (const c of cards) {
      if (!c.name.trim()) {
        setError("All credit cards must have a name.");
        return;
      }
    }

    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Not signed in.");
      setSaving(false);
      return;
    }

    // Upsert banks
    for (let i = 0; i < banks.length; i++) {
      const a = banks[i];
      const payload = {
        user_id: user.id,
        name: a.name.trim(),
        type: a.type,
        starting_balance: parseFloat(a.starting_balance) || 0,
        paycheck_split_percent: parseFloat(a.paycheck_split_percent) || 0,
        display_order: i,
      };
      if (a.id) {
        const { error: e } = await supabase.from("bank_accounts").update(payload).eq("id", a.id);
        if (e) {
          setError(`Failed to update ${a.name}: ${e.message}`);
          setSaving(false);
          return;
        }
      } else {
        const { data: row, error: e } = await supabase.from("bank_accounts").insert(payload).select().single();
        if (e || !row) {
          setError(`Failed to create ${a.name}: ${e?.message}`);
          setSaving(false);
          return;
        }
        // Store new ID locally
        setBanks((prev) => prev.map((b, idx) => (idx === i ? { ...b, id: row.id } : b)));
      }
    }

    // Upsert cards
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      const dueDayParsed = parseInt(c.payment_due_day);
      const payload = {
        user_id: user.id,
        name: c.name.trim(),
        issuer: c.issuer.trim() || c.name.trim(),
        credit_limit: parseFloat(c.credit_limit) || 0,
        starting_balance_owed: parseFloat(c.starting_balance_owed) || 0,
        payment_due_day: !isNaN(dueDayParsed) && dueDayParsed >= 1 && dueDayParsed <= 31 ? dueDayParsed : null,
        display_order: i,
      };
      if (c.id) {
        const { error: e } = await supabase.from("credit_cards").update(payload).eq("id", c.id);
        if (e) {
          setError(`Failed to update ${c.name}: ${e.message}`);
          setSaving(false);
          return;
        }
      } else {
        const { data: row, error: e } = await supabase.from("credit_cards").insert(payload).select().single();
        if (e || !row) {
          setError(`Failed to create ${c.name}: ${e?.message}`);
          setSaving(false);
          return;
        }
        setCards((prev) => prev.map((card, idx) => (idx === i ? { ...card, id: row.id } : card)));
      }
    }

    setSaving(false);
    setSuccess(true);
    router.refresh();
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6 md:p-12">
      <div className="max-w-2xl mx-auto">
        <header className="mb-8">
          <Link
            href="/"
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            ← Back to dashboard
          </Link>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mt-2">
            Setup
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Configure your bank accounts and credit cards.
          </p>
        </header>

        {/* Bank accounts */}
        <section className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 mb-6">
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
            Bank Accounts
          </h2>
          <div className="space-y-4">
            {banks.map((bank, idx) => (
              <div
                key={idx}
                className="border border-gray-200 dark:border-gray-800 rounded-md p-4 space-y-3"
              >
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Bank Account {idx + 1}
                </div>

                <input
                  type="text"
                  placeholder="Account name (e.g. Chase Checking)"
                  value={bank.name}
                  onChange={(e) => updateBank(idx, "name", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
                />

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Type
                    </label>
                    <select
                      value={bank.type}
                      onChange={(e) =>
                        updateBank(idx, "type", e.target.value as AccountType)
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
                    >
                      <option value="checking">Checking</option>
                      <option value="saving">Saving</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Starting balance
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={bank.starting_balance}
                      onChange={(e) => updateBank(idx, "starting_balance", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Paycheck %
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0"
                      value={bank.paycheck_split_percent}
                      onChange={(e) => updateBank(idx, "paycheck_split_percent", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Paycheck split preview */}
        <section className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 mb-6">
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Paycheck split preview
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Each paycheck of ${PAYCHECK_AMOUNT.toFixed(2)} will be split as:
          </p>
          <div className="space-y-1.5">
            {splitPreview.map((s, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">{s.name}</span>
                <span className="text-gray-900 dark:text-gray-100 font-medium">
                  ${s.amount.toFixed(2)}
                </span>
              </div>
            ))}
            <div className="flex justify-between text-sm pt-2 mt-2 border-t border-gray-200 dark:border-gray-800">
              <span
                className={
                  Math.abs(totalSplitPercent - 100) > 0.01
                    ? "text-red-600 dark:text-red-400"
                    : "text-gray-600 dark:text-gray-400"
                }
              >
                Total ({totalSplitPercent.toFixed(2)}%)
              </span>
              <span
                className={
                  Math.abs(totalSplitPercent - 100) > 0.01
                    ? "text-red-600 dark:text-red-400 font-medium"
                    : "text-gray-900 dark:text-gray-100 font-medium"
                }
              >
                ${((totalSplitPercent / 100) * PAYCHECK_AMOUNT).toFixed(2)}
              </span>
            </div>
          </div>
        </section>

        {/* Credit cards */}
        <section className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 mb-6">
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
            Credit Cards
          </h2>
          <div className="space-y-4">
            {cards.map((card, idx) => (
              <div
                key={idx}
                className="border border-gray-200 dark:border-gray-800 rounded-md p-4 space-y-3"
              >
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Credit Card {idx + 1}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Card name (e.g. Discover)"
                    value={card.name}
                    onChange={(e) => updateCard(idx, "name", e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
                  />
                  <input
                    type="text"
                    placeholder="Issuer (e.g. Discover Bank)"
                    value={card.issuer}
                    onChange={(e) => updateCard(idx, "issuer", e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Credit limit
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={card.credit_limit}
                      onChange={(e) => updateCard(idx, "credit_limit", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Balance owed
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={card.starting_balance_owed}
                      onChange={(e) => updateCard(idx, "starting_balance_owed", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Due day
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      placeholder="1–31"
                      value={card.payment_due_day}
                      onChange={(e) => updateCard(idx, "payment_due_day", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {error && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>}
        {success && (
          <p className="text-sm text-green-600 dark:text-green-400 mb-4">
            ✓ Saved successfully.
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 py-2 rounded-md text-sm font-medium cursor-pointer hover:bg-blue-600 dark:hover:bg-blue-500 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </main>
  );
}