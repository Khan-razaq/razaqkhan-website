"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type BankAccount = {
  id: string;
  name: string;
};

type CreditCard = {
  id: string;
  name: string;
  current_owed: number;
};

type Payment = {
  id: string;
  credit_card_id: string;
  bank_account_id: string;
  amount: number;
  payment_date: string;
  notes: string | null;
};

export default function PaymentsForm({
  bankAccounts,
  creditCards,
  initialPayments,
}: {
  bankAccounts: BankAccount[];
  creditCards: CreditCard[];
  initialPayments: Payment[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [creditCardId, setCreditCardId] = useState(creditCards[0]?.id || "");
  const [bankAccountId, setBankAccountId] = useState(bankAccounts[0]?.id || "");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [payments, setPayments] = useState<Payment[]>(initialPayments);

  // When user picks a card, auto-fill amount with current owed balance
  useEffect(() => {
    const card = creditCards.find((c) => c.id === creditCardId);
    if (card && card.current_owed > 0) {
      setAmount(card.current_owed.toFixed(2));
    } else {
      setAmount("");
    }
  }, [creditCardId, creditCards]);

  const selectedCard = creditCards.find((c) => c.id === creditCardId);
  const parsedAmount = parseFloat(amount) || 0;
  const willOverpay = selectedCard ? parsedAmount > selectedCard.current_owed : false;

  const handleSubmit = async () => {
    setError("");

    if (!creditCardId) {
      setError("Please select a credit card.");
      return;
    }
    if (!bankAccountId) {
      setError("Please select a bank account.");
      return;
    }
    if (parsedAmount <= 0) {
      setError("Amount must be greater than 0.");
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

    const { data, error: insertError } = await supabase
      .from("credit_card_payments")
      .insert({
        user_id: user.id,
        credit_card_id: creditCardId,
        bank_account_id: bankAccountId,
        amount: parsedAmount,
        payment_date: paymentDate,
        notes: notes.trim() || null,
      })
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setPayments([data, ...payments]);
    setAmount("");
    setNotes("");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setSaving(false);
    router.refresh();
  };

  const handleDelete = async (id: string, displayAmount: number) => {
    const confirmed = window.confirm(`Delete payment of $${displayAmount.toFixed(2)}?`);
    if (!confirmed) return;

    const { error: deleteError } = await supabase
      .from("credit_card_payments")
      .delete()
      .eq("id", id);

    if (deleteError) {
      window.alert(`Failed to delete: ${deleteError.message}`);
      return;
    }

    setPayments(payments.filter((p) => p.id !== id));
    router.refresh();
  };

  const cardNameById = (id: string) => creditCards.find((c) => c.id === id)?.name || "Unknown";
  const bankNameById = (id: string) => bankAccounts.find((b) => b.id === id)?.name || "Unknown";

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
            Credit Card Payments
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Log a payment when you pay off a credit card from a bank account.
          </p>
        </header>

        {/* Add payment */}
        <section className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 mb-6">
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
            Pay a Card
          </h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Which card?
              </label>
              <select
                value={creditCardId}
                onChange={(e) => setCreditCardId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
              >
                {creditCards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (owe ${c.current_owed.toFixed(2)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                From which bank account?
              </label>
              <select
                value={bankAccountId}
                onChange={(e) => setBankAccountId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
              >
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Notes (optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Statement payment for April"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
              />
            </div>

            {willOverpay && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                ⚠ Amount exceeds current balance owed (${selectedCard?.current_owed.toFixed(2)}).
                Overpayment will create a negative balance.
              </p>
            )}

            {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={saving}
              className="w-full bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 py-2 rounded-md text-sm font-medium cursor-pointer hover:bg-blue-600 dark:hover:bg-blue-500 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving…" : "Record Payment"}
            </button>
          </div>
        </section>

        {/* Payment history */}
        <section>
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Recent Payments
          </h2>
          {payments.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-8 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">No payments logged yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {cardNameById(payment.credit_card_id)} ← {bankNameById(payment.bank_account_id)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {payment.payment_date}
                      {payment.notes ? ` · ${payment.notes}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      ${Number(payment.amount).toFixed(2)}
                    </span>
                    <button
                      onClick={() => handleDelete(payment.id, Number(payment.amount))}
                      className="text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 text-sm cursor-pointer"
                      aria-label="Delete payment"
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