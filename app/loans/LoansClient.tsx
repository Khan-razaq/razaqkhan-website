"use client";

// Tailwind scanner hints for dynamic classes
// text-amber-600 dark:text-amber-400 text-red-600 dark:text-red-400 text-green-600 dark:text-green-400

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type LoanType = "education" | "family" | "other";
type Compounding = "daily" | "monthly" | "simple" | "none";
type Currency = "USD" | "INR";

type Loan = {
  id: string;
  name: string;
  lender: string;
  loan_type: LoanType;
  original_amount: number;
  interest_rate: number;
  currency: Currency;
  emi_amount: number | null;
  emi_start_date: string | null;
  tenure_months: number | null;
  interest_compounding: Compounding;
  disbursement_date: string | null;
  moratorium_end_date: string | null;
  notes: string | null;
};

type BankAccount = {
  id: string;
  name: string;
};

type LoanPayment = {
  id: string;
  loan_id: string;
  bank_account_id: string;
  amount: number;
  payment_date: string;
  notes: string | null;
};

// Compute current balance for a loan as of today.
// Handles compound daily accrual from disbursement_date, then EMI amortization after emi_start_date.
function computeCurrentBalance(loan: Loan, payments: LoanPayment[]): number {
  const principal = Number(loan.original_amount);
  const rate = Number(loan.interest_rate) / 100;
  const disbursement = loan.disbursement_date ? new Date(loan.disbursement_date) : new Date();
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const totalPaid = payments
    .filter((p) => p.loan_id === loan.id)
    .reduce((sum, p) => sum + Number(p.amount), 0);

  if (loan.interest_compounding === "none" || rate === 0) {
    return Math.max(0, principal - totalPaid);
  }

  // Determine the date interest stops capitalizing (EMI start)
  const emiStart = loan.emi_start_date ? new Date(loan.emi_start_date) : null;

  // Phase 1: compound accrual from disbursement to min(today, emiStart)
  const phase1End = emiStart && emiStart < todayMidnight ? emiStart : todayMidnight;
  const daysPhase1 = Math.max(
    0,
    Math.round((phase1End.getTime() - disbursement.getTime()) / (1000 * 60 * 60 * 24))
  );

  let balance = principal;
  if (loan.interest_compounding === "daily") {
    balance = principal * Math.pow(1 + rate / 365, daysPhase1);
  } else if (loan.interest_compounding === "monthly") {
    const months = daysPhase1 / 30;
    balance = principal * Math.pow(1 + rate / 12, months);
  } else if (loan.interest_compounding === "simple") {
    balance = principal * (1 + (rate * daysPhase1) / 365);
  }

  // Phase 2: if EMI has started, apply EMI payments + ongoing interest
  if (emiStart && emiStart < todayMidnight) {
    const daysSinceEMI = Math.round(
      (todayMidnight.getTime() - emiStart.getTime()) / (1000 * 60 * 60 * 24)
    );
    const monthsSinceEMI = Math.floor(daysSinceEMI / 30);
    const monthlyRate = rate / 12;
    const emi = Number(loan.emi_amount) || 0;

    // For each month elapsed, apply: balance = balance * (1 + monthlyRate) - emi
    for (let i = 0; i < monthsSinceEMI; i++) {
      balance = balance * (1 + monthlyRate) - emi;
      if (balance < 0) balance = 0;
    }
  }

  // Subtract recorded extra payments
  balance -= totalPaid;
  return Math.max(0, balance);
}

// Project full payoff date assuming standard EMI continues
function projectedPayoffDate(loan: Loan, currentBalance: number): Date | null {
  if (!loan.emi_amount || !loan.emi_start_date || loan.interest_compounding === "none") {
    return null;
  }

  const rate = Number(loan.interest_rate) / 100;
  const monthlyRate = rate / 12;
  const emi = Number(loan.emi_amount);

  // Solve: 0 = balance * (1+r)^n - emi * ((1+r)^n - 1) / r
  // n = log(emi / (emi - balance * r)) / log(1 + r)
  if (emi <= currentBalance * monthlyRate) return null; // EMI doesn't cover interest
  if (monthlyRate === 0) {
    const months = Math.ceil(currentBalance / emi);
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    return d;
  }
  const n = Math.log(emi / (emi - currentBalance * monthlyRate)) / Math.log(1 + monthlyRate);
  const months = Math.ceil(n);
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d;
}

export default function LoansClient({
  bankAccounts,
  loans: initialLoans,
  payments: initialPayments,
  inrToUsdRate,
}: {
  bankAccounts: BankAccount[];
  loans: Loan[];
  payments: LoanPayment[];
  inrToUsdRate: number;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [loans, setLoans] = useState<Loan[]>(initialLoans);
  const [payments, setPayments] = useState<LoanPayment[]>(initialPayments);
  const [showLoanForm, setShowLoanForm] = useState(initialLoans.length === 0);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentLoanId, setPaymentLoanId] = useState<string>("");
  const [error, setError] = useState("");

  // Loan form fields
  const [name, setName] = useState("");
  const [lender, setLender] = useState("");
  const [loanType, setLoanType] = useState<LoanType>("education");
  const [originalAmount, setOriginalAmount] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [currency, setCurrency] = useState<Currency>("INR");
  const [emiAmount, setEmiAmount] = useState("");
  const [emiStartDate, setEmiStartDate] = useState("");
  const [tenureMonths, setTenureMonths] = useState("");
  const [compounding, setCompounding] = useState<Compounding>("daily");
  const [disbursementDate, setDisbursementDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  // Payment form fields
  const [paymentBankId, setPaymentBankId] = useState(bankAccounts[0]?.id || "");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentNotes, setPaymentNotes] = useState("");

  const resetLoanForm = () => {
    setName("");
    setLender("");
    setLoanType("education");
    setOriginalAmount("");
    setInterestRate("");
    setCurrency("INR");
    setEmiAmount("");
    setEmiStartDate("");
    setTenureMonths("");
    setCompounding("daily");
    setDisbursementDate(new Date().toISOString().split("T")[0]);
    setNotes("");
    setEditingLoan(null);
  };

  const startEdit = (loan: Loan) => {
    setEditingLoan(loan);
    setName(loan.name);
    setLender(loan.lender);
    setLoanType(loan.loan_type);
    setOriginalAmount(loan.original_amount.toString());
    setInterestRate(loan.interest_rate.toString());
    setCurrency(loan.currency);
    setEmiAmount(loan.emi_amount?.toString() || "");
    setEmiStartDate(loan.emi_start_date || "");
    setTenureMonths(loan.tenure_months?.toString() || "");
    setCompounding(loan.interest_compounding);
    setDisbursementDate(loan.disbursement_date || new Date().toISOString().split("T")[0]);
    setNotes(loan.notes || "");
    setShowLoanForm(true);
  };

  const handleSaveLoan = async () => {
    setError("");

    if (!name.trim() || !lender.trim()) {
      setError("Name and lender required.");
      return;
    }
    if (!originalAmount || parseFloat(originalAmount) <= 0) {
      setError("Original amount must be > 0.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const payload = {
      user_id: user.id,
      name: name.trim(),
      lender: lender.trim(),
      loan_type: loanType,
      original_amount: parseFloat(originalAmount),
      interest_rate: parseFloat(interestRate) || 0,
      currency,
      emi_amount: emiAmount ? parseFloat(emiAmount) : null,
      emi_start_date: emiStartDate || null,
      tenure_months: tenureMonths ? parseInt(tenureMonths) : null,
      interest_compounding: compounding,
      disbursement_date: disbursementDate,
      notes: notes.trim() || null,
    };

    if (editingLoan) {
      const { data, error: e } = await supabase
        .from("loans")
        .update(payload)
        .eq("id", editingLoan.id)
        .select()
        .single();
      if (e) {
        setError(e.message);
        return;
      }
      setLoans(loans.map((l) => (l.id === data.id ? data : l)));
    } else {
      const { data, error: e } = await supabase.from("loans").insert(payload).select().single();
      if (e) {
        setError(e.message);
        return;
      }
      setLoans([...loans, data]);
    }

    resetLoanForm();
    setShowLoanForm(false);
    router.refresh();
  };

  const handleDeleteLoan = async (id: string, name: string) => {
    if (!window.confirm(`Delete loan "${name}"? Linked payments will also be deleted.`)) return;

    const { error: e } = await supabase.from("loans").delete().eq("id", id);
    if (e) {
      window.alert(e.message);
      return;
    }
    setLoans(loans.filter((l) => l.id !== id));
    setPayments(payments.filter((p) => p.loan_id !== id));
    router.refresh();
  };

  const handleAddPayment = async () => {
    setError("");

    if (!paymentLoanId || !paymentBankId || !paymentAmount) {
      setError("All payment fields required.");
      return;
    }
    if (parseFloat(paymentAmount) <= 0) {
      setError("Amount must be > 0.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error: e } = await supabase
      .from("loan_payments")
      .insert({
        user_id: user.id,
        loan_id: paymentLoanId,
        bank_account_id: paymentBankId,
        amount: parseFloat(paymentAmount),
        payment_date: paymentDate,
        notes: paymentNotes.trim() || null,
      })
      .select()
      .single();

    if (e) {
      setError(e.message);
      return;
    }

    setPayments([data, ...payments]);
    setPaymentAmount("");
    setPaymentNotes("");
    setShowPaymentForm(false);
    router.refresh();
  };

  const toUSD = (amount: number, fromCurrency: Currency): number => {
    if (fromCurrency === "USD") return amount;
    return amount / inrToUsdRate;
  };

  const formatCurrency = (amount: number, curr: Currency): string => {
    if (curr === "INR") {
      return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
    }
    return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Compute totals
  const loansWithMath = loans.map((loan) => {
    const balance = computeCurrentBalance(loan, payments);
    const balanceUSD = toUSD(balance, loan.currency);
    const payoffDate = projectedPayoffDate(loan, balance);
    return { loan, balance, balanceUSD, payoffDate };
  });

  const totalDebtUSD = loansWithMath.reduce((sum, l) => sum + l.balanceUSD, 0);

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
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mt-2">Loans</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Track outstanding debts and payments.
          </p>
        </header>

        {/* Total debt summary */}
        <section className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 mb-6">
          <div className="flex justify-between items-baseline">
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">Total debt</h2>
            <span
              className={`text-2xl font-semibold ${
                totalDebtUSD > 0
                  ? "text-red-600 dark:text-red-400"
                  : "text-gray-900 dark:text-gray-100"
              }`}
            >
              ${totalDebtUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            USD equivalent (INR converted at ₹{inrToUsdRate}/$)
          </p>
        </section>

        {/* Loan list */}
        {loansWithMath.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-8 text-center mb-6">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">No loans added yet.</p>
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            {loansWithMath.map(({ loan, balance, balanceUSD, payoffDate }) => (
              <section
                key={loan.id}
                className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                      {loan.name}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {loan.lender} · {loan.loan_type} · {loan.interest_rate}% {loan.interest_compounding}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setPaymentLoanId(loan.id);
                        setShowPaymentForm(true);
                        setShowLoanForm(false);
                      }}
                      className="text-xs px-3 py-1 rounded-md border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                    >
                      Pay
                    </button>
                    <button
                      onClick={() => startEdit(loan)}
                      className="text-xs px-3 py-1 rounded-md border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteLoan(loan.id, loan.name)}
                      className="text-xs px-3 py-1 rounded-md border border-gray-300 dark:border-gray-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Current balance</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {formatCurrency(balance, loan.currency)}
                      {loan.currency === "INR" && (
                        <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">
                          (${balanceUSD.toFixed(2)})
                        </span>
                      )}
                    </span>
                  </div>

                  {loan.emi_amount && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">EMI</span>
                      <span className="text-gray-700 dark:text-gray-300">
                        {formatCurrency(Number(loan.emi_amount), loan.currency)}/mo
                        {loan.emi_start_date && (
                          <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">
                            from {loan.emi_start_date}
                          </span>
                        )}
                      </span>
                    </div>
                  )}

                  {payoffDate && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Projected payoff</span>
                      <span className="text-gray-700 dark:text-gray-300">
                        {payoffDate.toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                      </span>
                    </div>
                  )}
                </div>
              </section>
            ))}
          </div>
        )}

        <button
          onClick={() => {
            resetLoanForm();
            setShowLoanForm(!showLoanForm);
            setShowPaymentForm(false);
          }}
          className="w-full text-sm py-2 mb-6 rounded-md border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
        >
          {showLoanForm ? "Cancel" : "+ Add loan"}
        </button>

        {/* Loan add/edit form */}
        {showLoanForm && (
          <section className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 mb-6">
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
              {editingLoan ? "Edit Loan" : "Add Loan"}
            </h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Loan name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
                />
                <input
                  type="text"
                  placeholder="Lender"
                  value={lender}
                  onChange={(e) => setLender(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <select
                  value={loanType}
                  onChange={(e) => setLoanType(e.target.value as LoanType)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
                >
                  <option value="education">Education</option>
                  <option value="family">Family</option>
                  <option value="other">Other</option>
                </select>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as Currency)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
                >
                  <option value="USD">USD</option>
                  <option value="INR">INR</option>
                </select>
                <select
                  value={compounding}
                  onChange={(e) => setCompounding(e.target.value as Compounding)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
                >
                  <option value="daily">Daily compound</option>
                  <option value="monthly">Monthly compound</option>
                  <option value="simple">Simple</option>
                  <option value="none">None (0%)</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <input
                  type="number"
                  step="0.01"
                  placeholder="Original amount"
                  value={originalAmount}
                  onChange={(e) => setOriginalAmount(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Interest rate %"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
                />
                <input
                  type="number"
                  placeholder="Tenure (months)"
                  value={tenureMonths}
                  onChange={(e) => setTenureMonths(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Disbursement date</label>
                  <input
                    type="date"
                    value={disbursementDate}
                    onChange={(e) => setDisbursementDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">EMI start date</label>
                  <input
                    type="date"
                    value={emiStartDate}
                    onChange={(e) => setEmiStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
                  />
                </div>
              </div>

              <input
                type="number"
                step="0.01"
                placeholder="EMI amount per month (optional)"
                value={emiAmount}
                onChange={(e) => setEmiAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
              />

              <input
                type="text"
                placeholder="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
              />

              {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

              <button
                onClick={handleSaveLoan}
                className="w-full bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 py-2 rounded-md text-sm font-medium cursor-pointer hover:bg-blue-600 dark:hover:bg-blue-500 hover:text-white transition-colors"
              >
                {editingLoan ? "Save changes" : "Add loan"}
              </button>
            </div>
          </section>
        )}

        {/* Payment form */}
        {showPaymentForm && (
          <section className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 mb-6">
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
              Log Payment
            </h2>
            <div className="space-y-3">
              <select
                value={paymentLoanId}
                onChange={(e) => setPaymentLoanId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
              >
                {loans.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>

              <select
                value={paymentBankId}
                onChange={(e) => setPaymentBankId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
              >
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    From {b.name}
                  </option>
                ))}
              </select>

              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  step="0.01"
                  placeholder="Amount"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
                />
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
                />
              </div>

              <input
                type="text"
                placeholder="Notes (optional)"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
              />

              {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

              <div className="flex gap-2">
                <button
                  onClick={handleAddPayment}
                  className="flex-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 py-2 rounded-md text-sm font-medium cursor-pointer hover:bg-blue-600 dark:hover:bg-blue-500 hover:text-white transition-colors"
                >
                  Record payment
                </button>
                <button
                  onClick={() => setShowPaymentForm(false)}
                  className="px-4 py-2 rounded-md text-sm font-medium border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Recent payments */}
        {payments.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Recent Payments
            </h2>
            <div className="space-y-2">
              {payments.slice(0, 10).map((p) => {
                const loan = loans.find((l) => l.id === p.loan_id);
                const bank = bankAccounts.find((b) => b.id === p.bank_account_id);
                return (
                  <div
                    key={p.id}
                    className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {loan?.name || "Unknown loan"} ← {bank?.name || "Unknown"}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {p.payment_date}
                        {p.notes ? ` · ${p.notes}` : ""}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 ml-4">
                      {loan ? formatCurrency(Number(p.amount), loan.currency) : `$${Number(p.amount).toFixed(2)}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}