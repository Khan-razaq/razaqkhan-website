-- Rows that point at a bank account, credit card, loan, or savings goal may only
-- point at one the signed-in user owns.
--
-- Only INSERT and UPDATE policies change. INSERT policies keep their existing
-- owner check and add the reference checks. UPDATE policies keep USING (which
-- rows you may edit) and gain a WITH CHECK (what the edited row may contain).
-- SELECT and DELETE policies are unchanged.

begin;

-- credit_card_payments: credit_card_id, bank_account_id (both required)
alter policy "Users can insert own card payments" on public.credit_card_payments
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.credit_cards c where c.id = credit_card_id and c.user_id = (select auth.uid()))
    and exists (select 1 from public.bank_accounts b where b.id = bank_account_id and b.user_id = (select auth.uid()))
  );
alter policy "Users can update own card payments" on public.credit_card_payments
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.credit_cards c where c.id = credit_card_id and c.user_id = (select auth.uid()))
    and exists (select 1 from public.bank_accounts b where b.id = bank_account_id and b.user_id = (select auth.uid()))
  );

-- expenses: bank_account_id, credit_card_id (both optional)
alter policy "Users can insert own expenses" on public.expenses
  with check (
    (select auth.uid()) = user_id
    and (bank_account_id is null or exists (select 1 from public.bank_accounts b where b.id = bank_account_id and b.user_id = (select auth.uid())))
    and (credit_card_id is null or exists (select 1 from public.credit_cards c where c.id = credit_card_id and c.user_id = (select auth.uid())))
  );
alter policy "Users can update own expenses" on public.expenses
  with check (
    (select auth.uid()) = user_id
    and (bank_account_id is null or exists (select 1 from public.bank_accounts b where b.id = bank_account_id and b.user_id = (select auth.uid())))
    and (credit_card_id is null or exists (select 1 from public.credit_cards c where c.id = credit_card_id and c.user_id = (select auth.uid())))
  );

-- fixed_expenses: bank_account_id (required)
alter policy "Users can insert own fixed expenses" on public.fixed_expenses
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.bank_accounts b where b.id = bank_account_id and b.user_id = (select auth.uid()))
  );
alter policy "Users can update own fixed expenses" on public.fixed_expenses
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.bank_accounts b where b.id = bank_account_id and b.user_id = (select auth.uid()))
  );

-- income_deposits: income_id (already checked), bank_account_id (required)
alter policy "Users can insert own income deposits" on public.income_deposits
  with check (
    exists (select 1 from public.incomes i where i.id = income_id and i.user_id = (select auth.uid()))
    and exists (select 1 from public.bank_accounts b where b.id = bank_account_id and b.user_id = (select auth.uid()))
  );
alter policy "Users can update own income deposits" on public.income_deposits
  with check (
    exists (select 1 from public.incomes i where i.id = income_id and i.user_id = (select auth.uid()))
    and exists (select 1 from public.bank_accounts b where b.id = bank_account_id and b.user_id = (select auth.uid()))
  );

-- loan_payments: loan_id, bank_account_id (both required)
alter policy "Users can insert own loan payments" on public.loan_payments
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.loans l where l.id = loan_id and l.user_id = (select auth.uid()))
    and exists (select 1 from public.bank_accounts b where b.id = bank_account_id and b.user_id = (select auth.uid()))
  );
alter policy "Users can update own loan payments" on public.loan_payments
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.loans l where l.id = loan_id and l.user_id = (select auth.uid()))
    and exists (select 1 from public.bank_accounts b where b.id = bank_account_id and b.user_id = (select auth.uid()))
  );

-- savings_contributions: goal_id, bank_account_id (both required)
alter policy "Users can insert own contributions" on public.savings_contributions
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.savings_goals g where g.id = goal_id and g.user_id = (select auth.uid()))
    and exists (select 1 from public.bank_accounts b where b.id = bank_account_id and b.user_id = (select auth.uid()))
  );
alter policy "Users can update own contributions" on public.savings_contributions
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.savings_goals g where g.id = goal_id and g.user_id = (select auth.uid()))
    and exists (select 1 from public.bank_accounts b where b.id = bank_account_id and b.user_id = (select auth.uid()))
  );

commit;
