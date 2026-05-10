"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type BankAccount = {
  id: string;
  name: string;
  type: string;
  paycheck_split_percent: number;
};

type IncomeDeposit = {
  amount: number;
  bank_account_id: string;
};

type Income = {
  id: string;
  amount: number;
  source: string;
  income_date: string;
  income_deposits: IncomeDeposit[];
};

const DEFAULT_PAYCHECK = 2038.50;

export default function IncomeForm({
  bankAccounts,
  initialIncomes,
}: {
  bankAccounts: BankAccount[];
  initialIncomes: Income[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [amount, setAmount] = useState(DEFAULT_PAYCHECK.toFixed(2));
  const [source, setSource] = useState("Salary");
  const [incomeDate, setIncomeDate] = useState(new Date().toISOString().split("T")[0]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [incomes, setIncomes] = useState<Income[]>(initialIncomes);

  const parsedAmount = parseFloat(amount) || 0;
  const splitPreview = bankAccounts.map((a) => ({
    account: a,
    amount: (a.paycheck_split_percent / 100) * parsedAmount,
  }));

  const handleAddIncome = async () => {
    setError("");

    if (parsedAmount <= 0) {
      setError("Amount must be greater than 0.");
      return;
    }
    if (!source.trim()) {
      setError("Source is required.");
      return;
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

    const { data: incomeRow, error: incomeError } = await supabase
      .from("incomes")
      .insert({
        user_id: user.id,
        amount: parsedAmount,
        source: source.trim(),
        income_date: incomeDate,
      })
      .select()
      .single();

    if (incomeError || !incomeRow) {
      setError(incomeError?.message || "Failed to save income.");
      setSaving(false);
      return;
    }

    const deposits = bankAccounts
      .filter((a) => a.paycheck_split_percent > 0)
      .map((a) => ({
        income_id: incomeRow.id,
        bank_account_id: a.id,
        amount: (a.paycheck_split_percent / 100) * parsedAmount,
      }));

    if (deposits.length > 0) {
      const { error: depositsError } = await supabase
        .from("income_deposits")
        .insert(deposits);

      if (depositsError) {
        setError(`Income saved but split failed: ${depositsError.message}`);
        setSaving(false);
        return;
      }
    }

    const { data: refreshed } = await supabase
      .from("incomes")
      .select("*, income_deposits(amount, bank_account_id)")
      .order("income_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(10);

    setIncomes(refreshed || []);
    setAmount(DEFAULT_PAYCHECK.toFixed(2));
    setSource("Salary");
    setIncomeDate(new Date().toISOString().split("T")[0]);
    setSaving(false);
    router.refresh();
  };

  const handleDelete = async (id: string, displayAmount: number) => {
    const confirmed = window.confirm(
      `Delete paycheck of $${displayAmount.toFixed(2)}? This will also remove its account deposits.`
    );

    if (!confirmed) return;

    const { error: deleteError } = await supabase.from("incomes").delete().eq("id", id);

    if (deleteError) {
      window.alert(`Failed to delete: ${deleteError.message}`);
      return;
    }

    setIncomes(incomes.filter((i) => i.id !== id));
    router.refresh();
  };

  const accountNameById = (id: string) =>
    bankAccounts.find((a) => a.id === id)?.name || "Unknown";

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
            Income
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Log paychecks. They split automatically based on your setup.
          </p>
        </header>

        <section className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 mb-6">
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
            Add Paycheck
          </h2>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Date</label>
                <input
                  type="date"
                  value={incomeDate}
                  onChange={(e) => setIncomeDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Source</label>
              <input
                type="text"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Salary"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
              />
            </div>

            <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Will be split as:</p>
              <div className="space-y-1">
                {splitPreview.map(({ account, amount }) => (
                  <div key={account.id} className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      {account.name}{" "}
                      <span className="text-gray-400 dark:text-gray-500">
                        ({account.paycheck_split_percent}%)
                      </span>
                    </span>
                    <span className="text-gray-900 dark:text-gray-100 font-medium">
                      ${amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

            <button
              onClick={handleAddIncome}
              disabled={saving}
              className="w-full bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 py-2 rounded-md text-sm font-medium cursor-pointer hover:bg-blue-600 dark:hover:bg-blue-500 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving…" : "Add Paycheck"}
            </button>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Recent Income
          </h2>
          {incomes.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-8 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">No income logged yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {incomes.map((income) => (
                <div
                  key={income.id}
                  className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          ${Number(income.amount).toFixed(2)}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {income.source} · {income.income_date}
                        </span>
                      </div>
                      <div className="mt-2 space-y-0.5">
                        {income.income_deposits.map((d, i) => (
                          <div
                            key={i}
                            className="text-xs text-gray-500 dark:text-gray-400 flex justify-between max-w-xs"
                          >
                            <span>{accountNameById(d.bank_account_id)}</span>
                            <span className="font-medium text-gray-700 dark:text-gray-300">
                              +${Number(d.amount).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(income.id, Number(income.amount))}
                      className="text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 text-sm cursor-pointer ml-4"
                      aria-label="Delete income"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}