-- Remove table privileges the app never uses.
--
-- anon (logged-out visitors) needs no table access at all.
-- authenticated (signed-in users) only needs SELECT, INSERT, UPDATE, DELETE;
-- row-level security policies then limit those to the user's own rows.
-- TRUNCATE ignores row-level security, so it is the most important one to drop.
-- service_role is left unchanged.

begin;

revoke all on table
  public.bank_accounts,
  public.credit_card_payments,
  public.credit_cards,
  public.expenses,
  public.fixed_expenses,
  public.income_deposits,
  public.incomes,
  public.loan_payments,
  public.loans,
  public.savings_contributions,
  public.savings_goals,
  public.user_settings
from anon;

revoke truncate, references, trigger, maintain on table
  public.bank_accounts,
  public.credit_card_payments,
  public.credit_cards,
  public.expenses,
  public.fixed_expenses,
  public.income_deposits,
  public.incomes,
  public.loan_payments,
  public.loans,
  public.savings_contributions,
  public.savings_goals,
  public.user_settings
from authenticated;

commit;
