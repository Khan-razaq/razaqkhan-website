"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "./ThemeToggle";

// Tailwind scanner hints: these classes are used dynamically, force generation
// text-amber-600 dark:text-amber-400 text-red-600 dark:text-red-400 text-green-600 dark:text-green-400
// bg-amber-500 bg-red-500 bg-green-500

type PaymentMethod = "Discover" | "Amex" | "Citi" | "Cash" | "Debit";

type BankAccount = {
  id: string;
  name: string;
  type: string;
  starting_balance: number;
  paycheck_split_percent: number;
  display_order: number;
};

type CreditCard = {
  id: string;
  name: string;
  issuer: string;
  credit_limit: number;
  starting_balance_owed: number;
  payment_due_day: number | null;
  display_order: number;
};

type Expense = {
  id: string;
  description: string;
  amount: number;
  category: string;
  payment_method: PaymentMethod;
  expense_date: string;
  bank_account_id: string | null;
  credit_card_id: string | null;
};

type Deposit = {
  id: string;
  income_id: string;
  bank_account_id: string;
  amount: number;
};

type LoanPayment = {
  id: string;
  bank_account_id: string;
  amount: number;
};

type CardPayment = {
  id: string;
  credit_card_id: string;
  bank_account_id: string;
  amount: number;
};

type Contribution = {
  id: string;
  bank_account_id: string;
  amount: number;
};

const CATEGORIES = ["Food", "Transport", "Shopping", "Bills", "Other"];
const PAYMENT_METHODS: PaymentMethod[] = ["Discover", "Amex", "Citi", "Cash", "Debit"];
const BANK_METHODS: PaymentMethod[] = ["Cash", "Debit"];
// Map a payment method to a card name (for auto-matching)
const METHOD_TO_CARD_NAME: Record<string, string> = {
  Discover: "Discover",
  Amex: "Amex",
  Citi: "Citi",
};

function nextDueDateInfo(dueDay: number | null): { days: number; date: Date } | null {
  if (!dueDay || dueDay < 1 || dueDay > 31) return null;

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const currentDay = today.getDate();

  let targetYear = currentYear;
  let targetMonth = currentMonth;
  if (currentDay > dueDay) {
    targetMonth += 1;
    if (targetMonth > 11) {
      targetMonth = 0;
      targetYear += 1;
    }
  }

  const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const actualDueDay = Math.min(dueDay, lastDayOfTargetMonth);

  const dueDate = new Date(targetYear, targetMonth, actualDueDay);
  const diffMs = dueDate.getTime() - new Date(currentYear, currentMonth, currentDay).getTime();
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24));

  return { days, date: dueDate };
}

export default function ExpenseTracker({
  bankAccounts,
  creditCards,
  expenses: initialExpenses,
  deposits,
  loanPayments,
  cardPayments,
  contributions,
}: {
  bankAccounts: BankAccount[];
  creditCards: CreditCard[];
  expenses: Expense[];
  deposits: Deposit[];
  loanPayments: LoanPayment[];
  cardPayments: CardPayment[];
  contributions: Contribution[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PAYMENT_METHODS[0]);
  const [bankAccountId, setBankAccountId] = useState<string>(bankAccounts[0]?.id || "");
  const [creditCardId, setCreditCardId] = useState<string>(creditCards[0]?.id || "");
  const [error, setError] = useState<{ field: string; message: string } | null>(null);

  const isCardMethod = !BANK_METHODS.includes(paymentMethod);
  // Auto-match: find the card whose name matches the payment method
  const matchingCards = isCardMethod
    ? creditCards.filter((c) => c.name.toLowerCase() === METHOD_TO_CARD_NAME[paymentMethod]?.toLowerCase())
    : [];
  const autoMatchedCardId = matchingCards.length === 1 ? matchingCards[0].id : null;
  const showCardDropdown = isCardMethod && !autoMatchedCardId;

  // Bank account balances
  const bankBalances = bankAccounts.map((account) => {
    const incomeIn = deposits
      .filter((d) => d.bank_account_id === account.id)
      .reduce((sum, d) => sum + Number(d.amount), 0);

    const expensesOut = expenses
      .filter((e) => e.bank_account_id === account.id)
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const loansOut = loanPayments
      .filter((p) => p.bank_account_id === account.id)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const cardsOut = cardPayments
      .filter((p) => p.bank_account_id === account.id)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const contribsOut = contributions
      .filter((c) => c.bank_account_id === account.id)
      .reduce((sum, c) => sum + Number(c.amount), 0);

    const balance =
      Number(account.starting_balance) + incomeIn - expensesOut - loansOut - cardsOut - contribsOut;
    return { account, balance };
  });

  // Credit card balances owed
  const cardBalances = creditCards.map((card) => {
    const expensesOnCard = expenses
      .filter((e) => e.credit_card_id === card.id)
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const paymentsToCard = cardPayments
      .filter((p) => p.credit_card_id === card.id)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const owed = Number(card.starting_balance_owed) + expensesOnCard - paymentsToCard;
    const utilization = card.credit_limit > 0 ? (owed / Number(card.credit_limit)) * 100 : 0;
    return { card, owed, utilization };
  });

  const totalCash = bankBalances.reduce((sum, b) => sum + b.balance, 0);
  const totalCardsOwed = cardBalances.reduce((sum, c) => sum + c.owed, 0);
  const netWorth = totalCash - totalCardsOwed;

  const handleAddExpense = async () => {
    const trimmed = description.trim();

    if (!trimmed) {
      setError({ field: "description", message: "Please enter a description." });
      return;
    }
    if (!/[a-zA-Z]/.test(trimmed)) {
      setError({ field: "description", message: "Description must contain at least one letter." });
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      setError({ field: "amount", message: "Please enter an amount greater than 0." });
      return;
    }

    if (isCardMethod && !creditCardId) {
      setError({ field: "card", message: "Please select a credit card." });
      return;
    }
    if (!isCardMethod && !bankAccountId) {
      setError({ field: "account", message: "Please select a bank account." });
      return;
    }

    const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError({ field: "description", message: "Not signed in. Please reload." });
      return;
    }

    const { data, error: insertError } = await supabase
      .from("expenses")
      .insert({
        user_id: user.id,
        description: capitalized,
        amount: parseFloat(amount),
        category,
        payment_method: paymentMethod,
        expense_date: new Date().toISOString().split("T")[0],
        bank_account_id: isCardMethod ? null : bankAccountId,
        credit_card_id: isCardMethod ? (autoMatchedCardId || creditCardId) : null,
      })
      .select()
      .single();

    if (insertError) {
      setError({ field: "description", message: insertError.message });
      return;
    }

    setExpenses([data, ...expenses]);
    setDescription("");
    setAmount("");
    setCategory(CATEGORIES[0]);
    setPaymentMethod(PAYMENT_METHODS[0]);
    setError(null);
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    const expense = expenses.find((e) => e.id === id);
    if (!expense) return;

    const confirmed = window.confirm(
      `Delete "${expense.description}" ($${Number(expense.amount).toFixed(2)})?`
    );
    if (!confirmed) return;

    const { error: deleteError } = await supabase.from("expenses").delete().eq("id", id);
    if (deleteError) {
      window.alert(`Failed to delete: ${deleteError.message}`);
      return;
    }

    setExpenses(expenses.filter((e) => e.id !== id));
    router.refresh();
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const expenseSourceLabel = (e: Expense) => {
    if (e.bank_account_id) {
      return bankAccounts.find((a) => a.id === e.bank_account_id)?.name || "Unknown";
    }
    if (e.credit_card_id) {
      return creditCards.find((c) => c.id === e.credit_card_id)?.name || "Unknown";
    }
    return "—";
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6 md:p-12">
      <div className="max-w-2xl mx-auto">
        <header className="mb-8">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">
                Dashboard
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Track every penny.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <ThemeToggle />
              <button
                onClick={handleSignOut}
                className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 cursor-pointer transition-colors px-3 py-2"
              >
                Sign out
              </button>
            </div>
          </div>
          <nav className="flex gap-4 text-xs">
            <Link href="/income" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
              Income
            </Link>
            <Link href="/payments" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
              Payments
            </Link>
            <Link href="/loans" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
              Loans
            </Link>
            <Link href="/setup" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
              Setup
            </Link>
          </nav>
        </header>

        {/* Net cash */}
        <section className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 mb-6">
          <div className="flex justify-between items-baseline mb-4">
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">Net cash</h2>
            <span
              className={`text-2xl font-semibold ${
                netWorth < 0 ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-gray-100"
              }`}
            >
              ${netWorth.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 pt-3 border-t border-gray-100 dark:border-gray-800">
            <span>Cash ${totalCash.toFixed(2)} − Cards owed ${totalCardsOwed.toFixed(2)}</span>
          </div>
        </section>

        {/* Bank accounts */}
        <section className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 mb-6">
          <div className="flex justify-between items-baseline mb-3">
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Bank Accounts
            </h2>
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              ${totalCash.toFixed(2)}
            </span>
          </div>
          <div className="space-y-2">
            {bankBalances.map(({ account, balance }) => (
              <div key={account.id} className="flex justify-between items-baseline text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  {account.name}{" "}
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    ({account.type})
                  </span>
                </span>
                <span
                  className={`font-medium ${
                    balance < 0 ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-gray-100"
                  }`}
                >
                  ${balance.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Credit cards */}
        {creditCards.length > 0 && (
          <section className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 mb-6">
            <div className="flex justify-between items-baseline mb-3">
              <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Credit Cards
              </h2>
              <span
                className={`text-sm font-semibold ${
                  totalCardsOwed > 0
                    ? "text-red-600 dark:text-red-400"
                    : "text-gray-900 dark:text-gray-100"
                }`}
              >
                ${totalCardsOwed.toFixed(2)}
              </span>
            </div>
            <div className="space-y-3">
              {cardBalances.map(({ card, owed, utilization }) => {
                const dueInfo = nextDueDateInfo(card.payment_due_day);
                const showCountdown = owed > 0 && dueInfo !== null;
                const daysLeft = dueInfo?.days ?? null;
                const countdownColor =
                  daysLeft !== null && daysLeft <= 2
                    ? "text-red-600 dark:text-red-400"
                    : daysLeft !== null && daysLeft <= 7
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-green-600 dark:text-green-400";
                const dueDateLabel = dueInfo
                  ? dueInfo.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  : null;

                return (
                  <div key={card.id} className="space-y-1.5">
                    <div className="flex justify-between items-baseline text-sm">
                      <div className="flex items-baseline gap-2">
                        <span className="text-gray-600 dark:text-gray-400">{card.name}</span>
                        {showCountdown && (
                          <span className={`text-xs font-medium ${countdownColor}`}>
                            {daysLeft === 0
                              ? `Due today (${dueDateLabel})`
                              : daysLeft === 1
                              ? `Due tomorrow (${dueDateLabel})`
                              : `Due ${dueDateLabel} (${daysLeft} days)`}
                          </span>
                        )}
                      </div>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        ${owed.toFixed(2)}{" "}
                        {card.credit_limit > 0 && (
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            / ${Number(card.credit_limit).toFixed(2)} ({utilization.toFixed(1)}%)
                          </span>
                        )}
                      </span>
                    </div>
                    {card.credit_limit > 0 && (
                      <div className="bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden" style={{ height: "6px" }}>
                        <div
                          className={`transition-all ${
                            utilization > 80
                              ? "bg-red-500"
                              : utilization > 50
                              ? "bg-amber-500"
                              : "bg-green-500"
                          }`}
                          style={{ width: `${Math.min(utilization, 100)}%`, height: "100%" }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Add expense */}
        <section className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 mb-6">
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
            Add Expense
          </h2>
          <div className="space-y-3">
            <div>
              <input
                type="text"
                placeholder="What did you spend on?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={`w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 ${
                  error?.field === "description"
                    ? "border-red-500 focus:ring-red-500"
                    : "border-gray-300 dark:border-gray-700 focus:ring-gray-900 dark:focus:ring-gray-300"
                }`}
              />
              {error?.field === "description" && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error.message}</p>
              )}
            </div>
            <div>
              <div className="flex gap-3">
                <input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  step="0.01"
                  className={`flex-1 px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 ${
                    error?.field === "amount"
                      ? "border-red-500 focus:ring-red-500"
                      : "border-gray-300 dark:border-gray-700 focus:ring-gray-900 dark:focus:ring-gray-300"
                  }`}
                />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              {error?.field === "amount" && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error.message}</p>
              )}
            </div>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  Paid with {method}
                </option>
              ))}
            </select>

            {/* Conditional account/card selector */}
            {showCardDropdown ? (
              <div>
                <select
                  value={creditCardId}
                  onChange={(e) => setCreditCardId(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 ${
                    error?.field === "card"
                      ? "border-red-500 focus:ring-red-500"
                      : "border-gray-300 dark:border-gray-700 focus:ring-gray-900 dark:focus:ring-gray-300"
                  }`}
                >
                  {creditCards.length === 0 ? (
                    <option value="">No credit cards configured</option>
                  ) : (
                    creditCards.map((c) => (
                      <option key={c.id} value={c.id}>
                        Charged to {c.name}
                      </option>
                    ))
                  )}
                </select>
                {error?.field === "card" && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error.message}</p>
                )}
              </div>
            ) : !isCardMethod ? (
              <div>
                <select
                  value={bankAccountId}
                  onChange={(e) => setBankAccountId(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 ${
                    error?.field === "account"
                      ? "border-red-500 focus:ring-red-500"
                      : "border-gray-300 dark:border-gray-700 focus:ring-gray-900 dark:focus:ring-gray-300"
                  }`}
                >
                  {bankAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      From {a.name}
                    </option>
                  ))}
                </select>
                {error?.field === "account" && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error.message}</p>
                )}
              </div>
            ) : null}

            <button
              onClick={handleAddExpense}
              className="w-full bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 py-2 rounded-md text-sm font-medium cursor-pointer hover:bg-blue-600 dark:hover:bg-blue-500 hover:text-white active:bg-blue-700 transition-colors"
            >
              Add Expense
            </button>
          </div>
        </section>

        {/* Recent expenses */}
        <section>
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Recent Expenses
          </h2>
          {expenses.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-8 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No expenses yet. Add one above.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {expenses.map((expense) => (
                <div
                  key={expense.id}
                  className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {expense.description}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {expense.category} · {expense.payment_method} · {expenseSourceLabel(expense)} · {expense.expense_date}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      ${Number(expense.amount).toFixed(2)}
                    </span>
                    <button
                      onClick={() => handleDelete(expense.id)}
                      className="text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 text-sm cursor-pointer"
                      aria-label="Delete expense"
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