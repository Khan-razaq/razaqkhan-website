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

type SavingsGoal = {
  id: string;
  name: string;
  target_amount: number;
  currency: Currency;
  target_date: string | null;
  monthly_contribution_usd: number | null;
  notes: string | null;
  display_order: number;
};

type SavingsContribution = {
  id: string;
  goal_id: string;
  bank_account_id: string;
  amount: number;
  contribution_date: string;
  notes: string | null;
};

type LoanPayment = {
  id: string;
  loan_id: string;
  bank_account_id: string;
  amount: number;
  payment_date: string;
  notes: string | null;
};

type FixedExpense = {
  id: string;
  name: string;
  amount: number;
  bank_account_id: string;
  billing_day: number;
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
  inrToUsdRate: initialInrRate,
  monthlyBuffer: initialBuffer,
  expectedMonthlyIncome: initialIncome,
  goals: initialGoals,
  contributions: initialContributions,
  fixedExpenses,
}: {
  bankAccounts: BankAccount[];
  loans: Loan[];
  payments: LoanPayment[];
  inrToUsdRate: number;
  monthlyBuffer: number;
  expectedMonthlyIncome: number;
  goals: SavingsGoal[];
  contributions: SavingsContribution[];
  fixedExpenses: FixedExpense[];
}) {
  const router = useRouter();
  const supabase = createClient();

  // Calculator settings state
  const [inrToUsdRate, setInrToUsdRate] = useState(initialInrRate);
  const [monthlyBuffer, setMonthlyBuffer] = useState(initialBuffer);
  const [expectedIncome, setExpectedIncome] = useState(initialIncome);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  
  const [loans, setLoans] = useState<Loan[]>(initialLoans);
  const [payments, setPayments] = useState<LoanPayment[]>(initialPayments);
  const [showLoanForm, setShowLoanForm] = useState(initialLoans.length === 0);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentLoanId, setPaymentLoanId] = useState<string>("");
  const [error, setError] = useState("");
  
  // Goals state
  const [goals, setGoals] = useState<SavingsGoal[]>(initialGoals);
  const [contributions, setContributions] = useState<SavingsContribution[]>(initialContributions);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [showContribForm, setShowContribForm] = useState(false);
  const [contribGoalId, setContribGoalId] = useState<string>("");

  // Goal form fields
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalCurrency, setGoalCurrency] = useState<Currency>("USD");
  const [goalTargetDate, setGoalTargetDate] = useState("");
  const [goalNotes, setGoalNotes] = useState("");

  // Contribution form fields
  const [contribBankId, setContribBankId] = useState(bankAccounts[0]?.id || "");
  const [contribAmount, setContribAmount] = useState("");
  const [contribDate, setContribDate] = useState(new Date().toISOString().split("T")[0]);
  const [contribNotes, setContribNotes] = useState("");

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

  const resetGoalForm = () => {
    setGoalName("");
    setGoalTarget("");
    setGoalCurrency("USD");
    setGoalTargetDate("");
    setGoalNotes("");
    setEditingGoal(null);
  };

  const startEditGoal = (goal: SavingsGoal) => {
    setEditingGoal(goal);
    setGoalName(goal.name);
    setGoalTarget(goal.target_amount.toString());
    setGoalCurrency(goal.currency);
    setGoalTargetDate(goal.target_date || "");
    setGoalNotes(goal.notes || "");
    setShowGoalForm(true);
  };

  const handleSaveGoal = async () => {
    setError("");

    if (!goalName.trim()) {
      setError("Goal name required.");
      return;
    }
    if (!goalTarget || parseFloat(goalTarget) <= 0) {
      setError("Target amount must be > 0.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const payload = {
      user_id: user.id,
      name: goalName.trim(),
      target_amount: parseFloat(goalTarget),
      currency: goalCurrency,
      target_date: goalTargetDate || null,
      notes: goalNotes.trim() || null,
      display_order: goals.length,
    };

    if (editingGoal) {
      const { data, error: e } = await supabase
        .from("savings_goals")
        .update(payload)
        .eq("id", editingGoal.id)
        .select()
        .single();
      if (e) {
        setError(e.message);
        return;
      }
      setGoals(goals.map((g) => (g.id === data.id ? data : g)));
    } else {
      const { data, error: e } = await supabase
        .from("savings_goals")
        .insert(payload)
        .select()
        .single();
      if (e) {
        setError(e.message);
        return;
      }
      setGoals([...goals, data]);
    }

    resetGoalForm();
    setShowGoalForm(false);
    router.refresh();
  };

  const handleDeleteGoal = async (id: string, name: string) => {
    if (!window.confirm(`Delete goal "${name}"? Linked contributions will also be deleted.`)) return;
    const { error: e } = await supabase.from("savings_goals").delete().eq("id", id);
    if (e) {
      window.alert(e.message);
      return;
    }
    setGoals(goals.filter((g) => g.id !== id));
    setContributions(contributions.filter((c) => c.goal_id !== id));
    router.refresh();
  };

  const handleAddContribution = async () => {
    setError("");

    if (!contribGoalId || !contribBankId || !contribAmount) {
      setError("All contribution fields required.");
      return;
    }
    if (parseFloat(contribAmount) <= 0) {
      setError("Amount must be > 0.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error: e } = await supabase
      .from("savings_contributions")
      .insert({
        user_id: user.id,
        goal_id: contribGoalId,
        bank_account_id: contribBankId,
        amount: parseFloat(contribAmount),
        contribution_date: contribDate,
        notes: contribNotes.trim() || null,
      })
      .select()
      .single();

    if (e) {
      setError(e.message);
      return;
    }

    setContributions([data, ...contributions]);
    setContribAmount("");
    setContribNotes("");
    setShowContribForm(false);
    router.refresh();
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setSettingsSaved(false);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSavingSettings(false);
      return;
    }

    const payload = {
      user_id: user.id,
      inr_to_usd_rate: inrToUsdRate,
      monthly_buffer_usd: monthlyBuffer,
      expected_monthly_income_usd: expectedIncome,
      updated_at: new Date().toISOString(),
    };

    // Try update first; if no row, insert
    const { error: updateError } = await supabase
      .from("user_settings")
      .update(payload)
      .eq("user_id", user.id);

    if (updateError) {
      // Row may not exist, try insert
      const { error: insertError } = await supabase.from("user_settings").insert(payload);
      if (insertError) {
        window.alert(`Failed to save settings: ${insertError.message}`);
        setSavingSettings(false);
        return;
      }
    }

    setSavingSettings(false);
    setSettingsSaved(true);
    router.refresh();
    setTimeout(() => setSettingsSaved(false), 2000);
  };

  const handleUndoLastContribution = async (goalId: string, goalName: string) => {
    // Contributions array is already sorted desc, so first match is the most recent
    const lastContrib = contributions.find((c) => c.goal_id === goalId);

    if (!lastContrib) {
      window.alert(`No contributions to undo for "${goalName}".`);
      return;
    }

    const bank = bankAccounts.find((b) => b.id === lastContrib.bank_account_id);
    const confirmed = window.confirm(
      `Undo last contribution to "${goalName}"?\n\n$${Number(lastContrib.amount).toFixed(
        2
      )} from ${bank?.name || "Unknown"} on ${lastContrib.contribution_date}`
    );

    if (!confirmed) return;

    const { error: e } = await supabase
      .from("savings_contributions")
      .delete()
      .eq("id", lastContrib.id);

    if (e) {
      window.alert(`Failed to undo: ${e.message}`);
      return;
    }

    setContributions(contributions.filter((c) => c.id !== lastContrib.id));
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

  // ===== PLAN CALCULATOR MATH =====
  const todayDate = new Date();

  // Total fixed expenses per month
  const monthlyFixedTotal = fixedExpenses.reduce(
    (sum, fe) => sum + Number(fe.amount),
    0
  );

  // Active EMI total (loans where EMI has started; convert INR EMI to USD)
  const activeEmiUSD = loans.reduce((sum, loan) => {
    if (!loan.emi_amount || !loan.emi_start_date) return sum;
    const emiStart = new Date(loan.emi_start_date);
    if (emiStart > todayDate) return sum;
    const emi = Number(loan.emi_amount);
    const emiInUSD = loan.currency === "INR" ? emi / inrToUsdRate : emi;
    return sum + emiInUSD;
  }, 0);

  // Free per month available for goals + bank loan extra
  const freePerMonth = expectedIncome - monthlyFixedTotal - activeEmiUSD - monthlyBuffer;

  // Required per goal (each in USD)
  const goalRequirements = goals.map((goal) => {
    // Sum of contributions to this goal so far
    const saved = contributions
      .filter((c) => c.goal_id === goal.id)
      .reduce((sum, c) => sum + Number(c.amount), 0);
    const savedUSD = goal.currency === "INR" ? saved / inrToUsdRate : saved;
    const targetUSD =
      goal.currency === "INR"
        ? Number(goal.target_amount) / inrToUsdRate
        : Number(goal.target_amount);

    let required = 0;
    let basis = "none";

    if (goal.monthly_contribution_usd && Number(goal.monthly_contribution_usd) > 0) {
      required = Number(goal.monthly_contribution_usd);
      basis = "manual";
    } else if (goal.target_date) {
      const remainingUSD = Math.max(0, targetUSD - savedUSD);
      const target = new Date(goal.target_date);
      const monthsLeft = Math.max(
        1,
        Math.round(
          (target.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
        )
      );
      required = remainingUSD / monthsLeft;
      basis = "deadline";
    }

    return { goal, required, savedUSD, targetUSD, basis };
  });

  const totalRequiredForGoals = goalRequirements.reduce((sum, g) => sum + g.required, 0);
  const surplusForBankLoan = Math.max(0, freePerMonth - totalRequiredForGoals);
  const shortfall = Math.max(0, totalRequiredForGoals - freePerMonth);

  let planStatus: "feasible" | "tight" | "infeasible";
  if (freePerMonth >= totalRequiredForGoals) {
    planStatus = surplusForBankLoan > 100 ? "feasible" : "tight";
  } else {
    planStatus = "infeasible";
  }
  // ===== END PLAN MATH =====
  
  // Compute goal totals
  const goalsWithMath = goals.map((goal) => {
    const saved = contributions
      .filter((c) => c.goal_id === goal.id)
      .reduce((sum, c) => sum + Number(c.amount), 0);
    const target = Number(goal.target_amount);
    const remaining = Math.max(0, target - saved);
    const percent = target > 0 ? Math.min((saved / target) * 100, 100) : 0;
    const savedUSD = toUSD(saved, goal.currency);
    const targetUSD = toUSD(target, goal.currency);
    return { goal, saved, target, remaining, percent, savedUSD, targetUSD };
  });

  const totalSavedUSD = goalsWithMath.reduce((sum, g) => sum + g.savedUSD, 0);
  const totalTargetUSD = goalsWithMath.reduce((sum, g) => sum + g.targetUSD, 0);

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

        {/* CALCULATOR SETTINGS */}
        <section className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 mb-6 mt-12">
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
            Calculator Settings
          </h2>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Monthly income ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={expectedIncome === 0 ? "" : expectedIncome}
                onChange={(e) => setExpectedIncome(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Buffer ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={monthlyBuffer === 0 ? "" : monthlyBuffer}
                onChange={(e) => setMonthlyBuffer(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                INR → USD rate
              </label>
              <input
                type="number"
                step="0.01"
                value={inrToUsdRate === 0 ? "" : inrToUsdRate}
                onChange={(e) => setInrToUsdRate(parseFloat(e.target.value) || 90)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
              />
            </div>
          </div>
          <button
            onClick={handleSaveSettings}
            disabled={savingSettings}
            className="text-xs px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer disabled:opacity-50"
          >
            {savingSettings ? "Saving..." : settingsSaved ? "✓ Saved" : "Save settings"}
          </button>
        </section>

        {/* PLAN CALCULATOR */}
        <section className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 mb-6">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">Plan</h2>
            <span
              className={`text-xs font-semibold uppercase tracking-wide ${
                planStatus === "feasible"
                  ? "text-green-600 dark:text-green-400"
                  : planStatus === "tight"
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {planStatus}
            </span>
          </div>

          {/* Math breakdown */}
          <div className="space-y-1.5 pb-4 border-b border-gray-200 dark:border-gray-800">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Monthly income</span>
              <span className="text-gray-900 dark:text-gray-100">+${expectedIncome.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Fixed expenses</span>
              <span className="text-red-600 dark:text-red-400">−${monthlyFixedTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Active loan EMIs</span>
              <span className="text-red-600 dark:text-red-400">−${activeEmiUSD.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Buffer (cushion)</span>
              <span className="text-red-600 dark:text-red-400">−${monthlyBuffer.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-gray-100 dark:border-gray-800 font-medium">
              <span className="text-gray-700 dark:text-gray-300">Free per month</span>
              <span
                className={
                  freePerMonth < 0
                    ? "text-red-600 dark:text-red-400"
                    : "text-gray-900 dark:text-gray-100"
                }
              >
                ${freePerMonth.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Diagnosis */}
          {planStatus === "feasible" && (
            <p className="text-sm text-green-700 dark:text-green-300 mt-4">
              All goals fundable. <strong>${surplusForBankLoan.toFixed(2)}/month</strong> extra recommended toward bank loan.
            </p>
          )}
          {planStatus === "tight" && (
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-4">
              Just barely fits — only ${surplusForBankLoan.toFixed(2)}/month surplus for bank loan. Consider tightening fixed expenses or increasing income.
            </p>
          )}
          {planStatus === "infeasible" && (
            <p className="text-sm text-red-700 dark:text-red-300 mt-4">
              Shortfall of <strong>${shortfall.toFixed(2)}/month</strong>. Goals can't all be met at this pace. Options: extend goal deadlines, reduce targets, lower buffer, or increase income.
            </p>
          )}

          {/* Per-goal recommendations */}
          {goalRequirements.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
              <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                Recommended monthly allocations
              </h3>
              <div className="space-y-1.5">
                {goalRequirements.map(({ goal, required, basis }) => (
                  <div key={goal.id} className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      {goal.name}
                      <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">
                        ({basis === "manual"
                          ? "fixed"
                          : basis === "deadline"
                          ? "by deadline"
                          : "no deadline, no amount set"})
                      </span>
                    </span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      ${required.toFixed(2)}
                    </span>
                  </div>
                ))}
                {surplusForBankLoan > 0 && (
                  <div className="flex justify-between text-sm pt-2 border-t border-gray-100 dark:border-gray-800">
                    <span className="text-gray-600 dark:text-gray-400">
                      Extra to bank loan{" "}
                      <span className="text-xs text-gray-400 dark:text-gray-500">(surplus)</span>
                    </span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      ${surplusForBankLoan.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
        
        {/* GOALS HEADER */}
        <header className="mb-4 mt-12">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Goals</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Money set aside for future spending.
          </p>
        </header>

        {/* Total saved summary */}
        {goals.length > 0 && (
          <section className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 mb-6">
            <div className="flex justify-between items-baseline">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Total saved
              </h3>
              <span className="text-2xl font-semibold text-green-600 dark:text-green-400">
                ${totalSavedUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              of ${totalTargetUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total target
            </p>
          </section>
        )}

        {/* Goal list */}
        {goalsWithMath.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-8 text-center mb-6">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">No goals yet.</p>
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            {goalsWithMath.map(({ goal, saved, target, remaining, percent }) => (
              <section
                key={goal.id}
                className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                      {goal.name}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Target: {formatCurrency(target, goal.currency)}
                      {goal.target_date && ` by ${goal.target_date}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setContribGoalId(goal.id);
                        setShowContribForm(true);
                        setShowGoalForm(false);
                      }}
                      className="text-xs px-3 py-1 rounded-md border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => handleUndoLastContribution(goal.id, goal.name)}
                      className="text-xs px-3 py-1 rounded-md border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                    >
                      Undo
                    </button>
                    <button
                      onClick={() => startEditGoal(goal)}
                      className="text-xs px-3 py-1 rounded-md border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteGoal(goal.id, goal.name)}
                      className="text-xs px-3 py-1 rounded-md border border-gray-300 dark:border-gray-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="space-y-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Saved</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {formatCurrency(saved, goal.currency)} / {formatCurrency(target, goal.currency)}{" "}
                      <span className="text-xs text-gray-400 dark:text-gray-500">({percent.toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden" style={{ height: "6px" }}>
                    <div
                      className="bg-green-500 transition-all"
                      style={{ width: `${percent}%`, height: "100%" }}
                    />
                  </div>
                  {remaining > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatCurrency(remaining, goal.currency)} remaining
                    </p>
                  )}
                </div>
              </section>
            ))}
          </div>
        )}

        <button
          onClick={() => {
            resetGoalForm();
            setShowGoalForm(!showGoalForm);
            setShowContribForm(false);
          }}
          className="w-full text-sm py-2 mb-6 rounded-md border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
        >
          {showGoalForm ? "Cancel" : "+ Add goal"}
        </button>

        {/* Goal add/edit form */}
        {showGoalForm && (
          <section className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 mb-6">
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
              {editingGoal ? "Edit Goal" : "Add Goal"}
            </h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Goal name (e.g. Car fund)"
                value={goalName}
                onChange={(e) => setGoalName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
              />

              <div className="grid grid-cols-3 gap-3">
                <input
                  type="number"
                  step="0.01"
                  placeholder="Target amount"
                  value={goalTarget}
                  onChange={(e) => setGoalTarget(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
                />
                <select
                  value={goalCurrency}
                  onChange={(e) => setGoalCurrency(e.target.value as Currency)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
                >
                  <option value="USD">USD</option>
                  <option value="INR">INR</option>
                </select>
                <input
                  type="date"
                  value={goalTargetDate}
                  onChange={(e) => setGoalTargetDate(e.target.value)}
                  placeholder="Target date"
                  className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
                />
              </div>

              <input
                type="text"
                placeholder="Notes (optional)"
                value={goalNotes}
                onChange={(e) => setGoalNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
              />

              {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

              <button
                onClick={handleSaveGoal}
                className="w-full bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 py-2 rounded-md text-sm font-medium cursor-pointer hover:bg-blue-600 dark:hover:bg-blue-500 hover:text-white transition-colors"
              >
                {editingGoal ? "Save changes" : "Add goal"}
              </button>
            </div>
          </section>
        )}

        {/* Contribution form */}
        {showContribForm && (
          <section className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 mb-6">
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
              Add Contribution
            </h2>
            <div className="space-y-3">
              <select
                value={contribGoalId}
                onChange={(e) => setContribGoalId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
              >
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>

              <select
                value={contribBankId}
                onChange={(e) => setContribBankId(e.target.value)}
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
                  value={contribAmount}
                  onChange={(e) => setContribAmount(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
                />
                <input
                  type="date"
                  value={contribDate}
                  onChange={(e) => setContribDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
                />
              </div>

              <input
                type="text"
                placeholder="Notes (optional)"
                value={contribNotes}
                onChange={(e) => setContribNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
              />

              {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

              <div className="flex gap-2">
                <button
                  onClick={handleAddContribution}
                  className="flex-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 py-2 rounded-md text-sm font-medium cursor-pointer hover:bg-blue-600 dark:hover:bg-blue-500 hover:text-white transition-colors"
                >
                  Record contribution
                </button>
                <button
                  onClick={() => setShowContribForm(false)}
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