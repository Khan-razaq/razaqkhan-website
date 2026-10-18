-- Wrap auth.uid() in a subquery in every policy.
--
-- (select auth.uid()) is evaluated once per query instead of once per row,
-- which Supabase recommends for performance. The conditions are otherwise
-- unchanged, so each policy allows exactly the same rows as before.
-- UPDATE policies keep no separate WITH CHECK, so USING still applies to the new row.

begin;

-- bank_accounts
alter policy "Users can delete own bank accounts" on public.bank_accounts
  using ((select auth.uid()) = user_id);
alter policy "Users can insert own bank accounts" on public.bank_accounts
  with check ((select auth.uid()) = user_id);
alter policy "Users can view own bank accounts" on public.bank_accounts
  using ((select auth.uid()) = user_id);
alter policy "Users can update own bank accounts" on public.bank_accounts
  using ((select auth.uid()) = user_id);

-- credit_card_payments
alter policy "Users can delete own card payments" on public.credit_card_payments
  using ((select auth.uid()) = user_id);
alter policy "Users can insert own card payments" on public.credit_card_payments
  with check ((select auth.uid()) = user_id);
alter policy "Users can view own card payments" on public.credit_card_payments
  using ((select auth.uid()) = user_id);
alter policy "Users can update own card payments" on public.credit_card_payments
  using ((select auth.uid()) = user_id);

-- credit_cards
alter policy "Users can delete own credit cards" on public.credit_cards
  using ((select auth.uid()) = user_id);
alter policy "Users can insert own credit cards" on public.credit_cards
  with check ((select auth.uid()) = user_id);
alter policy "Users can view own credit cards" on public.credit_cards
  using ((select auth.uid()) = user_id);
alter policy "Users can update own credit cards" on public.credit_cards
  using ((select auth.uid()) = user_id);

-- expenses
alter policy "Users can delete own expenses" on public.expenses
  using ((select auth.uid()) = user_id);
alter policy "Users can insert own expenses" on public.expenses
  with check ((select auth.uid()) = user_id);
alter policy "Users can view own expenses" on public.expenses
  using ((select auth.uid()) = user_id);
alter policy "Users can update own expenses" on public.expenses
  using ((select auth.uid()) = user_id);

-- fixed_expenses
alter policy "Users can delete own fixed expenses" on public.fixed_expenses
  using ((select auth.uid()) = user_id);
alter policy "Users can insert own fixed expenses" on public.fixed_expenses
  with check ((select auth.uid()) = user_id);
alter policy "Users can view own fixed expenses" on public.fixed_expenses
  using ((select auth.uid()) = user_id);
alter policy "Users can update own fixed expenses" on public.fixed_expenses
  using ((select auth.uid()) = user_id);

-- income_deposits
alter policy "Users can delete own income deposits" on public.income_deposits
  using (exists (select 1 from public.incomes where incomes.id = income_deposits.income_id and incomes.user_id = (select auth.uid())));
alter policy "Users can insert own income deposits" on public.income_deposits
  with check (exists (select 1 from public.incomes where incomes.id = income_deposits.income_id and incomes.user_id = (select auth.uid())));
alter policy "Users can view own income deposits" on public.income_deposits
  using (exists (select 1 from public.incomes where incomes.id = income_deposits.income_id and incomes.user_id = (select auth.uid())));
alter policy "Users can update own income deposits" on public.income_deposits
  using (exists (select 1 from public.incomes where incomes.id = income_deposits.income_id and incomes.user_id = (select auth.uid())));

-- incomes
alter policy "Users can delete own incomes" on public.incomes
  using ((select auth.uid()) = user_id);
alter policy "Users can insert own incomes" on public.incomes
  with check ((select auth.uid()) = user_id);
alter policy "Users can view own incomes" on public.incomes
  using ((select auth.uid()) = user_id);
alter policy "Users can update own incomes" on public.incomes
  using ((select auth.uid()) = user_id);

-- loan_payments
alter policy "Users can delete own loan payments" on public.loan_payments
  using ((select auth.uid()) = user_id);
alter policy "Users can insert own loan payments" on public.loan_payments
  with check ((select auth.uid()) = user_id);
alter policy "Users can view own loan payments" on public.loan_payments
  using ((select auth.uid()) = user_id);
alter policy "Users can update own loan payments" on public.loan_payments
  using ((select auth.uid()) = user_id);

-- loans
alter policy "Users can delete own loans" on public.loans
  using ((select auth.uid()) = user_id);
alter policy "Users can insert own loans" on public.loans
  with check ((select auth.uid()) = user_id);
alter policy "Users can view own loans" on public.loans
  using ((select auth.uid()) = user_id);
alter policy "Users can update own loans" on public.loans
  using ((select auth.uid()) = user_id);

-- savings_contributions
alter policy "Users can delete own contributions" on public.savings_contributions
  using ((select auth.uid()) = user_id);
alter policy "Users can insert own contributions" on public.savings_contributions
  with check ((select auth.uid()) = user_id);
alter policy "Users can view own contributions" on public.savings_contributions
  using ((select auth.uid()) = user_id);
alter policy "Users can update own contributions" on public.savings_contributions
  using ((select auth.uid()) = user_id);

-- savings_goals
alter policy "Users can delete own savings goals" on public.savings_goals
  using ((select auth.uid()) = user_id);
alter policy "Users can insert own savings goals" on public.savings_goals
  with check ((select auth.uid()) = user_id);
alter policy "Users can view own savings goals" on public.savings_goals
  using ((select auth.uid()) = user_id);
alter policy "Users can update own savings goals" on public.savings_goals
  using ((select auth.uid()) = user_id);

-- user_settings
alter policy "Users can insert own settings" on public.user_settings
  with check ((select auth.uid()) = user_id);
alter policy "Users can view own settings" on public.user_settings
  using ((select auth.uid()) = user_id);
alter policy "Users can update own settings" on public.user_settings
  using ((select auth.uid()) = user_id);

commit;
