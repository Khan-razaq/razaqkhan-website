-- Apply every row-level security policy only to signed-in users.
--
-- Policies were created for the public role, which includes logged-out visitors.
-- Those could never match (auth.uid() is null for them), so behavior does not
-- change; this makes the intent explicit.

begin;

alter policy "Users can delete own bank accounts" on public.bank_accounts to authenticated;
alter policy "Users can insert own bank accounts" on public.bank_accounts to authenticated;
alter policy "Users can update own bank accounts" on public.bank_accounts to authenticated;
alter policy "Users can view own bank accounts" on public.bank_accounts to authenticated;
alter policy "Users can delete own card payments" on public.credit_card_payments to authenticated;
alter policy "Users can insert own card payments" on public.credit_card_payments to authenticated;
alter policy "Users can update own card payments" on public.credit_card_payments to authenticated;
alter policy "Users can view own card payments" on public.credit_card_payments to authenticated;
alter policy "Users can delete own credit cards" on public.credit_cards to authenticated;
alter policy "Users can insert own credit cards" on public.credit_cards to authenticated;
alter policy "Users can update own credit cards" on public.credit_cards to authenticated;
alter policy "Users can view own credit cards" on public.credit_cards to authenticated;
alter policy "Users can delete own expenses" on public.expenses to authenticated;
alter policy "Users can insert own expenses" on public.expenses to authenticated;
alter policy "Users can update own expenses" on public.expenses to authenticated;
alter policy "Users can view own expenses" on public.expenses to authenticated;
alter policy "Users can delete own fixed expenses" on public.fixed_expenses to authenticated;
alter policy "Users can insert own fixed expenses" on public.fixed_expenses to authenticated;
alter policy "Users can update own fixed expenses" on public.fixed_expenses to authenticated;
alter policy "Users can view own fixed expenses" on public.fixed_expenses to authenticated;
alter policy "Users can delete own income deposits" on public.income_deposits to authenticated;
alter policy "Users can insert own income deposits" on public.income_deposits to authenticated;
alter policy "Users can update own income deposits" on public.income_deposits to authenticated;
alter policy "Users can view own income deposits" on public.income_deposits to authenticated;
alter policy "Users can delete own incomes" on public.incomes to authenticated;
alter policy "Users can insert own incomes" on public.incomes to authenticated;
alter policy "Users can update own incomes" on public.incomes to authenticated;
alter policy "Users can view own incomes" on public.incomes to authenticated;
alter policy "Users can delete own loan payments" on public.loan_payments to authenticated;
alter policy "Users can insert own loan payments" on public.loan_payments to authenticated;
alter policy "Users can update own loan payments" on public.loan_payments to authenticated;
alter policy "Users can view own loan payments" on public.loan_payments to authenticated;
alter policy "Users can delete own loans" on public.loans to authenticated;
alter policy "Users can insert own loans" on public.loans to authenticated;
alter policy "Users can update own loans" on public.loans to authenticated;
alter policy "Users can view own loans" on public.loans to authenticated;
alter policy "Users can delete own contributions" on public.savings_contributions to authenticated;
alter policy "Users can insert own contributions" on public.savings_contributions to authenticated;
alter policy "Users can update own contributions" on public.savings_contributions to authenticated;
alter policy "Users can view own contributions" on public.savings_contributions to authenticated;
alter policy "Users can delete own savings goals" on public.savings_goals to authenticated;
alter policy "Users can insert own savings goals" on public.savings_goals to authenticated;
alter policy "Users can update own savings goals" on public.savings_goals to authenticated;
alter policy "Users can view own savings goals" on public.savings_goals to authenticated;
alter policy "Users can insert own settings" on public.user_settings to authenticated;
alter policy "Users can update own settings" on public.user_settings to authenticated;
alter policy "Users can view own settings" on public.user_settings to authenticated;

commit;
