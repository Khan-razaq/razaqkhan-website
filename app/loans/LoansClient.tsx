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
  force_include_in_plan: boolean;
  payoff_target_months: number;
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

type FixedExpense = {
  id: string;
  name: string;
  amount: number;
  bank_account_id: string;
  billing_day: number;
};

// Compute current balance for a loan as of today.
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

  const emiStart = loan.emi_start_date ? new Date(loan.emi_start_date) : null;
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

  if (emiStart && emiStart < todayMidnight) {
    const daysSinceEMI = Math.round(
      (todayMidnight.getTime() - emiStart.getTime()) / (1000 * 60 * 60 * 24)
    );
    const monthsSinceEMI = Math.floor(daysSinceEMI / 30);
    const monthlyRate = rate / 12;
    const emi = Number(loan.emi_amount) || 0;

    for (let i = 0; i < monthsSinceEMI; i++) {
      balance = balance * (1 + monthlyRate) - emi;
      if (balance < 0) balance = 0;
    }
  }

  balance -= totalPaid;
  return Math.max(0, balance);
}

function projectedPayoffDate(loan: Loan, currentBalance: number): Date | null {
  if (!loan.emi_amount || !loan.emi_start_date || loan.interest_compounding === "none") {
    return null;
  }

  const rate = Number(loan.interest_rate) / 100;
  const monthlyRate = rate / 12;
  const emi = Number(loan.emi_amount);

  if (emi <= currentBalance * monthlyRate) return null;
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

type SimulationResult = {
  months: number;
  totalInterest: number;
  payoffDate: Date | null;
  status: "paid_off" | "interest_only" | "never";
};

function simulateLoanPayoff(params: {
  startingBalanceUSD: number;
  monthlyRate: number;
  baseEmiUSD: number;
  extraPerMonthUSD: number;
  fromDate: Date;
}): SimulationResult {
  let balance = params.startingBalanceUSD;
  const r = params.monthlyRate;
  const monthlyPayment = params.baseEmiUSD + params.extraPerMonthUSD;
  const safetyCap = 600;

  if (r === 0) {
    if (monthlyPayment <= 0) {
      return { months: 0, totalInterest: 0, payoffDate: null, status: "never" };
    }
    const months = Math.ceil(balance / monthlyPayment);
    const payoff = new Date(params.fromDate);
    payoff.setMonth(payoff.getMonth() + months);
    return { months, totalInterest: 0, payoffDate: payoff, status: "paid_off" };
  }

  if (monthlyPayment <= balance * r) {
    return { months: 0, totalInterest: 0, payoffDate: null, status: "interest_only" };
  }

  let totalInterest = 0;
  let months = 0;

  while (balance > 0 && months < safetyCap) {
    const interest = balance * r;
    totalInterest += interest;
    balance = balance + interest - monthlyPayment;
    if (balance < 0) balance = 0;
    months++;
  }

  if (months >= safetyCap) {
    return { months, totalInterest, payoffDate: null, status: "never" };
  }

  const payoff = new Date(params.fromDate);
  payoff.setMonth(payoff.getMonth() + months);
  return { months, totalInterest, payoffDate: payoff, status: "paid_off" };
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

  // Simulator state
  const [simulateFromEmiStart, setSimulateFromEmiStart] = useState(false);
  const [totalBudgetExtra, setTotalBudgetExtra] = useState("");
  const [priorityOrder, setPriorityOrder] = useState<string[]>([]);
  const [recommendationOverrides, setRecommendationOverrides] = useState<Record<string, string>>({});

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
  const [goalMonthlyContrib, setGoalMonthlyContrib] = useState("");
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
  const [forceInclude, setForceInclude] = useState(false);
  const [payoffTargetMonths, setPayoffTargetMonths] = useState("24");
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
    setForceInclude(false);
    setPayoffTargetMonths("24");
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
    setForceInclude(loan.force_include_in_plan || false);
    setPayoffTargetMonths(loan.payoff_target_months?.toString() || "24");
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
      force_include_in_plan: forceInclude,
      payoff_target_months: parseInt(payoffTargetMonths) || 24,
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
    setGoalMonthlyContrib("");
    setGoalNotes("");
    setEditingGoal(null);
  };

  const startEditGoal = (goal: SavingsGoal) => {
    setEditingGoal(goal);
    setGoalName(goal.name);
    setGoalTarget(goal.target_amount.toString());
    setGoalCurrency(goal.currency);
    setGoalTargetDate(goal.target_date || "");
    setGoalMonthlyContrib(goal.monthly_contribution_usd?.toString() || "");
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
      monthly_contribution_usd: goalMonthlyContrib ? parseFloat(goalMonthlyContrib) : null,
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

  const handleUndoLastContribution = async (goalId: string, goalName: string) => {
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

    const { error } = await supabase
      .from("user_settings")
      .upsert(payload, { onConflict: "user_id" });

    if (error) {
      window.alert(`Failed to save settings: ${error.message}`);
      setSavingSettings(false);
      return;
    }

    setSavingSettings(false);
    setSettingsSaved(true);
    router.refresh();
    setTimeout(() => setSettingsSaved(false), 2000);
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

  // Compute loan math
  const loansWithMath = loans.map((loan) => {
    const balance = computeCurrentBalance(loan, payments);
    const balanceUSD = toUSD(balance, loan.currency);
    const payoffDate = projectedPayoffDate(loan, balance);
    return { loan, balance, balanceUSD, payoffDate };
  });

  const totalDebtUSD = loansWithMath.reduce((sum, l) => sum + l.balanceUSD, 0);

  // Compute goal math
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

  // ===== PLAN CALCULATOR MATH =====
  const todayDate = new Date();

  const monthlyFixedTotal = fixedExpenses.reduce((sum, fe) => sum + Number(fe.amount), 0);

  const activeEmiUSD = loans.reduce((sum, loan) => {
    if (!loan.emi_amount || !loan.emi_start_date) return sum;
    const emiStart = new Date(loan.emi_start_date);
    if (emiStart > todayDate) return sum;
    const emi = Number(loan.emi_amount);
    const emiInUSD = loan.currency === "INR" ? emi / inrToUsdRate : emi;
    return sum + emiInUSD;
  }, 0);

  const freePerMonth = expectedIncome - monthlyFixedTotal - activeEmiUSD - monthlyBuffer;

  const goalRequirements = goals.map((goal) => {
    const saved = contributions
      .filter((c) => c.goal_id === goal.id)
      .reduce((sum, c) => sum + Number(c.amount), 0);
    const savedUSD = goal.currency === "INR" ? saved / inrToUsdRate : saved;
    const targetUSD = goal.currency === "INR" ? Number(goal.target_amount) / inrToUsdRate : Number(goal.target_amount);

    let required = 0;
    let basis = "none";

    if (goal.monthly_contribution_usd && Number(goal.monthly_contribution_usd) > 0) {
      required = Number(goal.monthly_contribution_usd);
      basis = "manual";
    } else if (goal.target_date) {
      const remainingUSD = Math.max(0, targetUSD - savedUSD);
      const target = new Date(goal.target_date);
      const monthsLeft = Math.max(1, Math.round((target.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24 * 30)));
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

  // ===== SIMULATOR & RECOMMENDATION MATH =====
  const loansForSim = loans
    .map((loan) => {
      const balanceNative = computeCurrentBalance(loan, payments);
      const balanceUSD = loan.currency === "INR" ? balanceNative / inrToUsdRate : balanceNative;
      const emiNative = Number(loan.emi_amount || 0);
      const emiUSD = loan.currency === "INR" ? emiNative / inrToUsdRate : emiNative;
      const monthlyRate = Number(loan.interest_rate) / 100 / 12;

      let fromDate = new Date();
      if (simulateFromEmiStart && loan.emi_start_date) {
        const emiStart = new Date(loan.emi_start_date);
        if (emiStart > fromDate) fromDate = emiStart;
      }

      let effectiveEmi = emiUSD;
      if (loan.emi_start_date && !simulateFromEmiStart) {
        const emiStart = new Date(loan.emi_start_date);
        if (emiStart > new Date()) effectiveEmi = 0;
      }

      return { loan, balanceUSD, emiUSD: effectiveEmi, monthlyRate, fromDate };
    })
    .filter((l) => l.balanceUSD > 0);

  const effectivePriorityOrder =
    priorityOrder.length === loansForSim.length
      ? priorityOrder
      : loansForSim.map((l) => l.loan.id);

  // Recommendation algorithm
  function computeRecommendation(): {
    perLoan: { loanId: string; recommendedUSD: number; reason: string }[];
    totalAllocated: number;
    unallocated: number;
    infeasible: boolean;
  } {
    const recommendations: { loanId: string; recommendedUSD: number; reason: string }[] = [];
    let remaining = freePerMonth - totalRequiredForGoals;

    if (remaining <= 0) {
      return { perLoan: [], totalAllocated: 0, unallocated: 0, infeasible: true };
    }

    const forceIncluded = loans.filter((l) => l.force_include_in_plan && !l.emi_amount);

    for (const loan of forceIncluded) {
      const balance = computeCurrentBalance(loan, payments);
      const balanceUSD = loan.currency === "INR" ? balance / inrToUsdRate : balance;
      const target = loan.payoff_target_months || 24;
      const recommendedUSD = balanceUSD / target;

      const allocated = Math.min(recommendedUSD, remaining);
      recommendations.push({
        loanId: loan.id,
        recommendedUSD: allocated,
        reason: `Clear $${balanceUSD.toFixed(0)} in ${target} months`,
      });
      remaining -= allocated;
    }

    if (remaining > 0) {
      const interestBearingLoans = loans
        .filter((l) => Number(l.interest_rate) > 0)
        .sort((a, b) => Number(b.interest_rate) - Number(a.interest_rate));

      if (interestBearingLoans.length > 0) {
        const target = interestBearingLoans[0];
        recommendations.push({
          loanId: target.id,
          recommendedUSD: remaining,
          reason: `Highest interest (${target.interest_rate}%) — math optimal`,
        });
        remaining = 0;
      }
    }

    const totalAllocated = recommendations.reduce((s, r) => s + r.recommendedUSD, 0);
    return { perLoan: recommendations, totalAllocated, unallocated: remaining, infeasible: false };
  }

  const recommendation = computeRecommendation();

  // Budget mode simulator
  function simulateBudgetMode(budgetUSD: number, order: string[]) {
    if (budgetUSD <= 0 || loansForSim.length === 0) {
      return { perLoan: [], totalMonths: 0 };
    }

    const state = loansForSim.map((l) => ({
      id: l.loan.id,
      balance: l.balanceUSD,
      rate: l.monthlyRate,
      emi: l.emiUSD,
      fromDate: l.fromDate,
      interestPaid: 0,
      monthsTaken: 0,
      finished: false,
    }));

    const orderedIds = order.filter((id) => state.find((s) => s.id === id));
    state.forEach((s) => {
      if (!orderedIds.includes(s.id)) orderedIds.push(s.id);
    });

    let month = 0;
    while (state.some((s) => !s.finished) && month < 600) {
      state.forEach((s) => {
        if (s.finished) return;
        const interest = s.balance * s.rate;
        s.interestPaid += interest;
        s.balance = s.balance + interest - s.emi;
        if (s.balance < 0) s.balance = 0;
      });

      let remaining = budgetUSD;
      for (const id of orderedIds) {
        if (remaining <= 0) break;
        const s = state.find((x) => x.id === id);
        if (!s || s.finished) continue;
        const payment = Math.min(remaining, s.balance);
        s.balance -= payment;
        remaining -= payment;
      }

      state.forEach((s) => {
        if (!s.finished && s.balance <= 0) {
          s.finished = true;
          s.monthsTaken = month + 1;
        }
      });

      month++;
    }

    const perLoan = state.map((s) => ({
      loanId: s.id,
      months: s.monthsTaken,
      payoffDate:
        s.monthsTaken > 0
          ? (() => {
              const d = new Date(s.fromDate);
              d.setMonth(d.getMonth() + s.monthsTaken);
              return d;
            })()
          : null,
      totalInterest: s.interestPaid,
    }));

    return { perLoan, totalMonths: month };
  }

  const budgetExtraValue = parseFloat(totalBudgetExtra) || 0;
  const modeBResults = simulateBudgetMode(budgetExtraValue, effectivePriorityOrder);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
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

        {/* Total debt */}
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-6">
            {loansWithMath.map(({ loan, balance, balanceUSD, payoffDate }) => (
              <section
                key={loan.id}
                className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{loan.name}</h3>
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

              <div className="border border-gray-200 dark:border-gray-800 rounded-md p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="force-include-check"
                    checked={forceInclude}
                    onChange={(e) => setForceInclude(e.target.checked)}
                    className="cursor-pointer"
                  />
                  <label
                    htmlFor="force-include-check"
                    className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer"
                  >
                    Force include in payoff plan
                  </label>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  If checked, the recommendation always allocates a monthly amount to this loan, even when math would skip it.
                </p>
                {forceInclude && (
                  <div className="flex gap-3 items-center">
                    <label className="text-xs text-gray-500 dark:text-gray-400">Target payoff in (months):</label>
                    <input
                      type="number"
                      min="1"
                      value={payoffTargetMonths}
                      onChange={(e) => setPayoffTargetMonths(e.target.value)}
                      className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
                    />
                  </div>
                )}
              </div>

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
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Log Payment</h2>
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

        {/* CALCULATOR SETTINGS + PLAN (side by side on desktop) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-12 mb-6">
          <section className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Calculator Settings</h2>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Monthly income ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={expectedIncome === 0 ? "" : expectedIncome}
                  onChange={(e) => setExpectedIncome(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Buffer ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={monthlyBuffer === 0 ? "" : monthlyBuffer}
                  onChange={(e) => setMonthlyBuffer(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">INR → USD rate</label>
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

          <section className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
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

            {planStatus === "feasible" && (
              <p className="text-sm text-green-700 dark:text-green-300 mt-4">
                All goals fundable. <strong>${surplusForBankLoan.toFixed(2)}/month</strong> extra recommended toward bank loan.
              </p>
            )}
            {planStatus === "tight" && (
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-4">
                Just barely fits — only ${surplusForBankLoan.toFixed(2)}/month surplus for bank loan.
              </p>
            )}
            {planStatus === "infeasible" && (
              <p className="text-sm text-red-700 dark:text-red-300 mt-4">
                Shortfall of <strong>${shortfall.toFixed(2)}/month</strong>. Goals can't all be met at this pace.
              </p>
            )}

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
                          ({basis === "manual" ? "fixed" : basis === "deadline" ? "by deadline" : "no deadline, no amount set"})
                        </span>
                      </span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">${required.toFixed(2)}</span>
                    </div>
                  ))}
                  {surplusForBankLoan > 0 && (
                    <div className="flex justify-between text-sm pt-2 border-t border-gray-100 dark:border-gray-800">
                      <span className="text-gray-600 dark:text-gray-400">
                        Extra to bank loan <span className="text-xs text-gray-400 dark:text-gray-500">(surplus)</span>
                      </span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">${surplusForBankLoan.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* RECOMMENDED PLAN + TRY DIFFERENT PRIORITIES (side by side on desktop) */}
        {loansForSim.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Recommended Plan */}
            <section className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
              <div className="flex justify-between items-baseline mb-2">
                <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">Recommended Plan</h2>
                {!recommendation.infeasible && recommendation.totalAllocated > 0 && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    ${recommendation.totalAllocated.toFixed(2)}/mo total
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Based on your ${freePerMonth.toFixed(2)}/mo free after fixed expenses, buffer, and goals.
              </p>

              {recommendation.infeasible ? (
                <p className="text-sm text-red-700 dark:text-red-300">
                  No free cash to allocate to loans.
                </p>
              ) : (
                <div className="space-y-3">
                  {loansForSim.map((info) => {
                    const rec = recommendation.perLoan.find((r) => r.loanId === info.loan.id);
                    const recommended = rec?.recommendedUSD || 0;
                    const overrideKey = info.loan.id;
                    const overrideVal = recommendationOverrides[overrideKey];
                    const actualUsed =
                      overrideVal !== undefined && overrideVal !== ""
                        ? parseFloat(overrideVal) || 0
                        : recommended;

                    const result = simulateLoanPayoff({
                      startingBalanceUSD: info.balanceUSD,
                      monthlyRate: info.monthlyRate,
                      baseEmiUSD: info.emiUSD,
                      extraPerMonthUSD: actualUsed,
                      fromDate: info.fromDate,
                    });

                    const tweaked =
                      overrideVal !== undefined &&
                      overrideVal !== "" &&
                      Math.abs(parseFloat(overrideVal) - recommended) > 0.01;

                    return (
                      <div
                        key={info.loan.id}
                        className="border border-gray-200 dark:border-gray-800 rounded-md p-4 space-y-3"
                      >
                        <div>
                          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">{info.loan.name}</h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            ${info.balanceUSD.toFixed(2)} @ {(info.monthlyRate * 12 * 100).toFixed(1)}% APR
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="bg-gray-50 dark:bg-gray-950 rounded p-3">
                            <p className="text-gray-500 dark:text-gray-400 mb-1">Recommended</p>
                            <p className="text-gray-900 dark:text-gray-100 font-medium">${recommended.toFixed(2)}/mo</p>
                            {rec && (
                              <p className="text-gray-500 dark:text-gray-400 mt-0.5">{rec.reason}</p>
                            )}
                          </div>
                          <div className={`${tweaked ? "bg-amber-50 dark:bg-amber-950/30" : "bg-gray-50 dark:bg-gray-950"} rounded p-3`}>
                            <p className="text-gray-500 dark:text-gray-400 mb-1">
                              Your amount {tweaked && "(tweaked)"}
                            </p>
                            <input
                              type="number"
                              step="0.01"
                              value={overrideVal ?? ""}
                              placeholder={recommended.toFixed(2)}
                              onChange={(e) =>
                                setRecommendationOverrides({
                                  ...recommendationOverrides,
                                  [overrideKey]: e.target.value,
                                })
                              }
                              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
                            />
                          </div>
                        </div>

                        {result.status === "paid_off" && result.payoffDate ? (
                          <p className="text-xs text-green-700 dark:text-green-300">
                            Pays off{" "}
                            <strong>
                              {result.payoffDate.toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                            </strong>{" "}
                            ({result.months} months){result.totalInterest > 0 && `, $${result.totalInterest.toFixed(0)} interest`}
                          </p>
                        ) : result.status === "interest_only" ? (
                          <p className="text-xs text-red-600 dark:text-red-400">
                            Amount doesn't cover interest — balance grows forever
                          </p>
                        ) : (
                          <p className="text-xs text-gray-500 dark:text-gray-400">No payoff date computed</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Try Different Priorities */}
            <section className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">Try Different Priorities</h2>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                What if you reorder which loan gets paid first?
              </p>

              <div className="mb-4 flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  id="sim-from-emi-start"
                  checked={simulateFromEmiStart}
                  onChange={(e) => setSimulateFromEmiStart(e.target.checked)}
                  className="cursor-pointer"
                />
                <label
                  htmlFor="sim-from-emi-start"
                  className="text-gray-600 dark:text-gray-400 cursor-pointer"
                >
                  Simulate from EMI start date (instead of today)
                </label>
              </div>

              <div className="space-y-4">
                <div className="flex gap-3 items-center">
                  <label className="text-sm text-gray-700 dark:text-gray-300">Total monthly $:</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder={surplusForBankLoan.toFixed(2)}
                    value={totalBudgetExtra}
                    onChange={(e) => setTotalBudgetExtra(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Calculator suggests <strong>${surplusForBankLoan.toFixed(2)}/mo</strong>. Money cascades by priority order — top loan gets paid first.
                </p>

                <div>
                  <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                    Priority order (top = paid first)
                  </h4>
                  <div className="space-y-1.5">
                    {effectivePriorityOrder.map((loanId, idx) => {
                      const info = loansForSim.find((l) => l.loan.id === loanId);
                      const result = modeBResults.perLoan.find((r) => r.loanId === loanId);
                      if (!info) return null;

                      return (
                        <div
                          key={loanId}
                          className="flex items-center gap-2 border border-gray-200 dark:border-gray-800 rounded-md p-3"
                        >
                          <div className="flex flex-col gap-0.5">
                            <button
                              onClick={() => {
                                if (idx === 0) return;
                                const newOrder = [...effectivePriorityOrder];
                                [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]];
                                setPriorityOrder(newOrder);
                              }}
                              disabled={idx === 0}
                              className="text-xs px-1 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-30 cursor-pointer"
                            >
                              ▲
                            </button>
                            <button
                              onClick={() => {
                                if (idx === effectivePriorityOrder.length - 1) return;
                                const newOrder = [...effectivePriorityOrder];
                                [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]];
                                setPriorityOrder(newOrder);
                              }}
                              disabled={idx === effectivePriorityOrder.length - 1}
                              className="text-xs px-1 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-30 cursor-pointer"
                            >
                              ▼
                            </button>
                          </div>

                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {idx + 1}. {info.loan.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              ${info.balanceUSD.toFixed(2)} @ {(info.monthlyRate * 12 * 100).toFixed(1)}% APR
                            </p>
                          </div>

                          <div className="text-right">
                            {result?.payoffDate ? (
                              <>
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                  {result.payoffDate.toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{result.months} months</p>
                              </>
                            ) : (
                              <p className="text-xs text-gray-500 dark:text-gray-400">Set amount above</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {modeBResults.totalMonths > 0 && (
                  <div className="pt-3 border-t border-gray-200 dark:border-gray-800">
                    <p className="text-sm text-green-700 dark:text-green-300">
                      All loans debt-free in <strong>{modeBResults.totalMonths} months</strong>{" "}
                      ({(() => {
                        const d = new Date();
                        d.setMonth(d.getMonth() + modeBResults.totalMonths);
                        return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
                      })()}).
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {/* GOALS HEADER */}
        <header className="mb-4 mt-12">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Goals</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Money set aside for future spending.</p>
        </header>

        {goals.length > 0 && (
          <section className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 mb-6">
            <div className="flex justify-between items-baseline">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Total saved</h3>
              <span className="text-2xl font-semibold text-green-600 dark:text-green-400">
                ${totalSavedUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              of ${totalTargetUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total target
            </p>
          </section>
        )}

        {goalsWithMath.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-8 text-center mb-6">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">No goals yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-6">
            {goalsWithMath.map(({ goal, saved, target, remaining, percent }) => (
              <section
                key={goal.id}
                className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{goal.name}</h3>
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
                  className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Monthly contribution ($, optional)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="If no target date, set how much to put toward this goal each month"
                  value={goalMonthlyContrib}
                  onChange={(e) => setGoalMonthlyContrib(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  If both target date AND monthly contribution are set, monthly contribution wins.
                </p>
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

        {showContribForm && (
          <section className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 mb-6">
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Add Contribution</h2>
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

        {payments.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Recent Payments</h2>
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