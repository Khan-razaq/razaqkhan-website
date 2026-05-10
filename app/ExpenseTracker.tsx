"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "./ThemeToggle";

type PaymentMethod = "Discover" | "Amex" | "Citi" | "Cash" | "Debit";

type Expense = {
  id: string;
  description: string;
  amount: number;
  category: string;
  paymentMethod: PaymentMethod;
  date: string;
};

const CATEGORIES = ["Food", "Transport", "Shopping", "Bills", "Other"];
const PAYMENT_METHODS: PaymentMethod[] = ["Discover", "Amex", "Citi", "Cash", "Debit"];

export default function ExpenseTracker() {
  const router = useRouter();
  const supabase = createClient();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PAYMENT_METHODS[0]);
  const [error, setError] = useState<{ field: string; message: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Load expenses from Supabase on mount
  useEffect(() => {
    const loadExpenses = async () => {
      const { data, error: fetchError } = await supabase
        .from("expenses")
        .select("*")
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (fetchError) {
        console.error("Failed to load expenses:", fetchError);
        setLoading(false);
        return;
      }

      const mapped: Expense[] = (data || []).map((row) => ({
        id: row.id,
        description: row.description,
        amount: parseFloat(row.amount),
        category: row.category,
        paymentMethod: row.payment_method as PaymentMethod,
        date: row.expense_date,
      }));

      setExpenses(mapped);
      setLoading(false);
    };

    loadExpenses();
  }, [supabase]);

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

    const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);

    // Get current user (needed for user_id field in DB)
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
      })
      .select()
      .single();

    if (insertError) {
      setError({ field: "description", message: insertError.message });
      return;
    }

    const newExpense: Expense = {
      id: data.id,
      description: data.description,
      amount: parseFloat(data.amount),
      category: data.category,
      paymentMethod: data.payment_method as PaymentMethod,
      date: data.expense_date,
    };

    setExpenses([newExpense, ...expenses]);
    setDescription("");
    setAmount("");
    setCategory(CATEGORIES[0]);
    setPaymentMethod(PAYMENT_METHODS[0]);
    setError(null);
  };

  const handleDelete = async (id: string) => {
    const expense = expenses.find((e) => e.id === id);
    if (!expense) return;

    const confirmed = window.confirm(
      `Delete "${expense.description}" ($${expense.amount.toFixed(2)})?`
    );

    if (!confirmed) return;

    const { error: deleteError } = await supabase
      .from("expenses")
      .delete()
      .eq("id", id);

    if (deleteError) {
      window.alert(`Failed to delete: ${deleteError.message}`);
      return;
    }

    setExpenses(expenses.filter((e) => e.id !== id));
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalsByMethod = PAYMENT_METHODS.map((method) => ({
    method,
    total: expenses
      .filter((e) => e.paymentMethod === method)
      .reduce((sum, e) => sum + e.amount, 0),
  })).filter((item) => item.total > 0);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6 md:p-12">
      <div className="max-w-2xl mx-auto">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">
              Expense Tracker
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
        </header>

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
            <button
              onClick={handleAddExpense}
              className="w-full bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 py-2 rounded-md text-sm font-medium cursor-pointer hover:bg-blue-600 dark:hover:bg-blue-500 hover:text-white active:bg-blue-700 transition-colors"
            >
              Add Expense
            </button>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 mb-6">
          <div className="flex justify-between items-baseline mb-3">
            <span className="text-sm text-gray-500 dark:text-gray-400">Total spent</span>
            <span className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              ${total.toFixed(2)}
            </span>
          </div>
          {totalsByMethod.length > 0 && (
            <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-1.5">
              {totalsByMethod.map(({ method, total }) => (
                <div
                  key={method}
                  className="flex justify-between items-baseline text-sm"
                >
                  <span className="text-gray-500 dark:text-gray-400">{method}</span>
                  <span className="text-gray-900 dark:text-gray-100 font-medium">
                    ${total.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Recent Expenses
          </h2>
          {loading ? (
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-8 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Loading…
              </p>
            </div>
          ) : expenses.length === 0 ? (
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
                      {expense.category} · {expense.paymentMethod} · {expense.date}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      ${expense.amount.toFixed(2)}
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