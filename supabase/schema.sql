--
-- PostgreSQL database dump
--

\restrict nq6z0y34ORMabZ0lO66BC8JLxQb5LbpZbVEsUoBGC7N4BifDF7fRg4gMbFAEj5q

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: bank_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    starting_balance numeric(12,2) DEFAULT 0 NOT NULL,
    paycheck_split_percent numeric(5,2) DEFAULT 0 NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT accounts_paycheck_split_percent_check CHECK (((paycheck_split_percent >= (0)::numeric) AND (paycheck_split_percent <= (100)::numeric))),
    CONSTRAINT accounts_type_check CHECK ((type = ANY (ARRAY['checking'::text, 'saving'::text])))
);


--
-- Name: credit_card_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_card_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    credit_card_id uuid NOT NULL,
    bank_account_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    payment_date date DEFAULT CURRENT_DATE NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT credit_card_payments_amount_check CHECK ((amount > (0)::numeric))
);


--
-- Name: credit_cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_cards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    issuer text NOT NULL,
    credit_limit numeric(12,2) DEFAULT 0 NOT NULL,
    starting_balance_owed numeric(12,2) DEFAULT 0 NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    payment_due_day integer,
    CONSTRAINT credit_cards_credit_limit_check CHECK ((credit_limit >= (0)::numeric)),
    CONSTRAINT credit_cards_payment_due_day_check CHECK (((payment_due_day >= 1) AND (payment_due_day <= 31))),
    CONSTRAINT credit_cards_starting_balance_owed_check CHECK ((starting_balance_owed >= (0)::numeric))
);


--
-- Name: expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    description text NOT NULL,
    amount numeric(10,2) NOT NULL,
    category text NOT NULL,
    payment_method text NOT NULL,
    expense_date date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    bank_account_id uuid,
    credit_card_id uuid,
    CONSTRAINT expenses_amount_check CHECK ((amount > (0)::numeric))
);


--
-- Name: fixed_expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fixed_expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    amount numeric(12,2) NOT NULL,
    category text DEFAULT 'other'::text NOT NULL,
    bank_account_id uuid NOT NULL,
    billing_day integer NOT NULL,
    active boolean DEFAULT true NOT NULL,
    notes text,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT fixed_expenses_amount_check CHECK ((amount >= (0)::numeric)),
    CONSTRAINT fixed_expenses_billing_day_check CHECK (((billing_day >= 1) AND (billing_day <= 31))),
    CONSTRAINT fixed_expenses_category_check CHECK ((category = ANY (ARRAY['rent'::text, 'utility'::text, 'food'::text, 'transport'::text, 'subscription'::text, 'insurance'::text, 'other'::text])))
);


--
-- Name: income_deposits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.income_deposits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    income_id uuid NOT NULL,
    bank_account_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT income_deposits_amount_check CHECK ((amount > (0)::numeric))
);


--
-- Name: incomes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.incomes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    source text DEFAULT 'Salary'::text NOT NULL,
    income_date date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT incomes_amount_check CHECK ((amount > (0)::numeric))
);


--
-- Name: loan_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loan_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    loan_id uuid NOT NULL,
    bank_account_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    payment_date date DEFAULT CURRENT_DATE NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT loan_payments_amount_check CHECK ((amount > (0)::numeric))
);


--
-- Name: loans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    lender text NOT NULL,
    loan_type text NOT NULL,
    original_amount numeric(12,2) NOT NULL,
    interest_rate numeric(5,2) DEFAULT 0 NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    emi_amount numeric(12,2),
    emi_start_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tenure_months integer,
    interest_compounding text DEFAULT 'daily'::text,
    disbursement_date date,
    moratorium_end_date date,
    force_include_in_plan boolean DEFAULT false NOT NULL,
    payoff_target_months integer DEFAULT 24 NOT NULL,
    CONSTRAINT loans_currency_check CHECK ((currency = ANY (ARRAY['USD'::text, 'INR'::text]))),
    CONSTRAINT loans_interest_compounding_check CHECK ((interest_compounding = ANY (ARRAY['daily'::text, 'monthly'::text, 'simple'::text, 'none'::text]))),
    CONSTRAINT loans_interest_rate_check CHECK ((interest_rate >= (0)::numeric)),
    CONSTRAINT loans_loan_type_check CHECK ((loan_type = ANY (ARRAY['education'::text, 'family'::text, 'other'::text]))),
    CONSTRAINT loans_original_amount_check CHECK ((original_amount > (0)::numeric)),
    CONSTRAINT loans_payoff_target_months_check CHECK ((payoff_target_months > 0))
);


--
-- Name: savings_contributions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.savings_contributions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    goal_id uuid NOT NULL,
    bank_account_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    contribution_date date DEFAULT CURRENT_DATE NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT savings_contributions_amount_check CHECK ((amount > (0)::numeric))
);


--
-- Name: savings_goals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.savings_goals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    target_amount numeric(12,2) NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    target_date date,
    notes text,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    monthly_contribution_usd numeric(12,2),
    CONSTRAINT savings_goals_currency_check CHECK ((currency = ANY (ARRAY['USD'::text, 'INR'::text]))),
    CONSTRAINT savings_goals_monthly_contribution_usd_check CHECK ((monthly_contribution_usd >= (0)::numeric)),
    CONSTRAINT savings_goals_target_amount_check CHECK ((target_amount > (0)::numeric))
);


--
-- Name: user_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_settings (
    user_id uuid NOT NULL,
    inr_to_usd_rate numeric(10,4) DEFAULT 90 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    monthly_buffer_usd numeric(12,2) DEFAULT 500 NOT NULL,
    expected_monthly_income_usd numeric(12,2) DEFAULT 0 NOT NULL,
    CONSTRAINT user_settings_expected_monthly_income_usd_check CHECK ((expected_monthly_income_usd >= (0)::numeric)),
    CONSTRAINT user_settings_inr_to_usd_rate_check CHECK ((inr_to_usd_rate > (0)::numeric)),
    CONSTRAINT user_settings_monthly_buffer_usd_check CHECK ((monthly_buffer_usd >= (0)::numeric))
);


--
-- Name: bank_accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: credit_card_payments credit_card_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_card_payments
    ADD CONSTRAINT credit_card_payments_pkey PRIMARY KEY (id);


--
-- Name: credit_cards credit_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_cards
    ADD CONSTRAINT credit_cards_pkey PRIMARY KEY (id);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: fixed_expenses fixed_expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixed_expenses
    ADD CONSTRAINT fixed_expenses_pkey PRIMARY KEY (id);


--
-- Name: income_deposits income_deposits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.income_deposits
    ADD CONSTRAINT income_deposits_pkey PRIMARY KEY (id);


--
-- Name: incomes incomes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incomes
    ADD CONSTRAINT incomes_pkey PRIMARY KEY (id);


--
-- Name: loan_payments loan_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loan_payments
    ADD CONSTRAINT loan_payments_pkey PRIMARY KEY (id);


--
-- Name: loans loans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loans
    ADD CONSTRAINT loans_pkey PRIMARY KEY (id);


--
-- Name: savings_contributions savings_contributions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.savings_contributions
    ADD CONSTRAINT savings_contributions_pkey PRIMARY KEY (id);


--
-- Name: savings_goals savings_goals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.savings_goals
    ADD CONSTRAINT savings_goals_pkey PRIMARY KEY (id);


--
-- Name: user_settings user_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_pkey PRIMARY KEY (user_id);


--
-- Name: bank_accounts_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bank_accounts_user_id_idx ON public.bank_accounts USING btree (user_id);


--
-- Name: credit_card_payments_bank_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX credit_card_payments_bank_idx ON public.credit_card_payments USING btree (bank_account_id);


--
-- Name: credit_card_payments_card_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX credit_card_payments_card_idx ON public.credit_card_payments USING btree (credit_card_id);


--
-- Name: credit_cards_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX credit_cards_user_id_idx ON public.credit_cards USING btree (user_id);


--
-- Name: expenses_bank_account_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX expenses_bank_account_idx ON public.expenses USING btree (bank_account_id);


--
-- Name: expenses_credit_card_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX expenses_credit_card_idx ON public.expenses USING btree (credit_card_id);


--
-- Name: expenses_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX expenses_date_idx ON public.expenses USING btree (expense_date DESC);


--
-- Name: expenses_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX expenses_user_id_idx ON public.expenses USING btree (user_id);


--
-- Name: fixed_expenses_bank_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fixed_expenses_bank_idx ON public.fixed_expenses USING btree (bank_account_id);


--
-- Name: fixed_expenses_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fixed_expenses_user_idx ON public.fixed_expenses USING btree (user_id);


--
-- Name: income_deposits_bank_account_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX income_deposits_bank_account_idx ON public.income_deposits USING btree (bank_account_id);


--
-- Name: income_deposits_income_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX income_deposits_income_idx ON public.income_deposits USING btree (income_id);


--
-- Name: incomes_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX incomes_date_idx ON public.incomes USING btree (income_date DESC);


--
-- Name: incomes_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX incomes_user_id_idx ON public.incomes USING btree (user_id);


--
-- Name: loan_payments_bank_account_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX loan_payments_bank_account_idx ON public.loan_payments USING btree (bank_account_id);


--
-- Name: loan_payments_loan_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX loan_payments_loan_idx ON public.loan_payments USING btree (loan_id);


--
-- Name: loans_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX loans_user_id_idx ON public.loans USING btree (user_id);


--
-- Name: savings_contributions_bank_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX savings_contributions_bank_idx ON public.savings_contributions USING btree (bank_account_id);


--
-- Name: savings_contributions_goal_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX savings_contributions_goal_idx ON public.savings_contributions USING btree (goal_id);


--
-- Name: savings_goals_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX savings_goals_user_id_idx ON public.savings_goals USING btree (user_id);


--
-- Name: bank_accounts accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_accounts
    ADD CONSTRAINT accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: credit_card_payments credit_card_payments_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_card_payments
    ADD CONSTRAINT credit_card_payments_bank_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES public.bank_accounts(id) ON DELETE CASCADE;


--
-- Name: credit_card_payments credit_card_payments_credit_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_card_payments
    ADD CONSTRAINT credit_card_payments_credit_card_id_fkey FOREIGN KEY (credit_card_id) REFERENCES public.credit_cards(id) ON DELETE CASCADE;


--
-- Name: credit_card_payments credit_card_payments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_card_payments
    ADD CONSTRAINT credit_card_payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: credit_cards credit_cards_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_cards
    ADD CONSTRAINT credit_cards_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: expenses expenses_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES public.bank_accounts(id) ON DELETE RESTRICT;


--
-- Name: expenses expenses_credit_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_credit_card_id_fkey FOREIGN KEY (credit_card_id) REFERENCES public.credit_cards(id) ON DELETE RESTRICT;


--
-- Name: expenses expenses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: fixed_expenses fixed_expenses_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixed_expenses
    ADD CONSTRAINT fixed_expenses_bank_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES public.bank_accounts(id) ON DELETE RESTRICT;


--
-- Name: fixed_expenses fixed_expenses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixed_expenses
    ADD CONSTRAINT fixed_expenses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: income_deposits income_deposits_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.income_deposits
    ADD CONSTRAINT income_deposits_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES public.bank_accounts(id) ON DELETE CASCADE;


--
-- Name: income_deposits income_deposits_income_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.income_deposits
    ADD CONSTRAINT income_deposits_income_id_fkey FOREIGN KEY (income_id) REFERENCES public.incomes(id) ON DELETE CASCADE;


--
-- Name: incomes incomes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incomes
    ADD CONSTRAINT incomes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: loan_payments loan_payments_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loan_payments
    ADD CONSTRAINT loan_payments_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES public.bank_accounts(id) ON DELETE CASCADE;


--
-- Name: loan_payments loan_payments_loan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loan_payments
    ADD CONSTRAINT loan_payments_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES public.loans(id) ON DELETE CASCADE;


--
-- Name: loan_payments loan_payments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loan_payments
    ADD CONSTRAINT loan_payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: loans loans_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loans
    ADD CONSTRAINT loans_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: savings_contributions savings_contributions_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.savings_contributions
    ADD CONSTRAINT savings_contributions_bank_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES public.bank_accounts(id) ON DELETE CASCADE;


--
-- Name: savings_contributions savings_contributions_goal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.savings_contributions
    ADD CONSTRAINT savings_contributions_goal_id_fkey FOREIGN KEY (goal_id) REFERENCES public.savings_goals(id) ON DELETE CASCADE;


--
-- Name: savings_contributions savings_contributions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.savings_contributions
    ADD CONSTRAINT savings_contributions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: savings_goals savings_goals_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.savings_goals
    ADD CONSTRAINT savings_goals_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_settings user_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: bank_accounts Users can delete own bank accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own bank accounts" ON public.bank_accounts FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: credit_card_payments Users can delete own card payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own card payments" ON public.credit_card_payments FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: savings_contributions Users can delete own contributions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own contributions" ON public.savings_contributions FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: credit_cards Users can delete own credit cards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own credit cards" ON public.credit_cards FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: expenses Users can delete own expenses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own expenses" ON public.expenses FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: fixed_expenses Users can delete own fixed expenses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own fixed expenses" ON public.fixed_expenses FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: income_deposits Users can delete own income deposits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own income deposits" ON public.income_deposits FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.incomes
  WHERE ((incomes.id = income_deposits.income_id) AND (incomes.user_id = auth.uid())))));


--
-- Name: incomes Users can delete own incomes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own incomes" ON public.incomes FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: loan_payments Users can delete own loan payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own loan payments" ON public.loan_payments FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: loans Users can delete own loans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own loans" ON public.loans FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: savings_goals Users can delete own savings goals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own savings goals" ON public.savings_goals FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: bank_accounts Users can insert own bank accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own bank accounts" ON public.bank_accounts FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: credit_card_payments Users can insert own card payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own card payments" ON public.credit_card_payments FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: savings_contributions Users can insert own contributions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own contributions" ON public.savings_contributions FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: credit_cards Users can insert own credit cards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own credit cards" ON public.credit_cards FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: expenses Users can insert own expenses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own expenses" ON public.expenses FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: fixed_expenses Users can insert own fixed expenses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own fixed expenses" ON public.fixed_expenses FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: income_deposits Users can insert own income deposits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own income deposits" ON public.income_deposits FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.incomes
  WHERE ((incomes.id = income_deposits.income_id) AND (incomes.user_id = auth.uid())))));


--
-- Name: incomes Users can insert own incomes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own incomes" ON public.incomes FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: loan_payments Users can insert own loan payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own loan payments" ON public.loan_payments FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: loans Users can insert own loans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own loans" ON public.loans FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: savings_goals Users can insert own savings goals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own savings goals" ON public.savings_goals FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_settings Users can insert own settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own settings" ON public.user_settings FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: bank_accounts Users can update own bank accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own bank accounts" ON public.bank_accounts FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: credit_card_payments Users can update own card payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own card payments" ON public.credit_card_payments FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: savings_contributions Users can update own contributions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own contributions" ON public.savings_contributions FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: credit_cards Users can update own credit cards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own credit cards" ON public.credit_cards FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: expenses Users can update own expenses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own expenses" ON public.expenses FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: fixed_expenses Users can update own fixed expenses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own fixed expenses" ON public.fixed_expenses FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: income_deposits Users can update own income deposits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own income deposits" ON public.income_deposits FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.incomes
  WHERE ((incomes.id = income_deposits.income_id) AND (incomes.user_id = auth.uid())))));


--
-- Name: incomes Users can update own incomes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own incomes" ON public.incomes FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: loan_payments Users can update own loan payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own loan payments" ON public.loan_payments FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: loans Users can update own loans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own loans" ON public.loans FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: savings_goals Users can update own savings goals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own savings goals" ON public.savings_goals FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: user_settings Users can update own settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own settings" ON public.user_settings FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: bank_accounts Users can view own bank accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own bank accounts" ON public.bank_accounts FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: credit_card_payments Users can view own card payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own card payments" ON public.credit_card_payments FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: savings_contributions Users can view own contributions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own contributions" ON public.savings_contributions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: credit_cards Users can view own credit cards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own credit cards" ON public.credit_cards FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: expenses Users can view own expenses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own expenses" ON public.expenses FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: fixed_expenses Users can view own fixed expenses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own fixed expenses" ON public.fixed_expenses FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: income_deposits Users can view own income deposits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own income deposits" ON public.income_deposits FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.incomes
  WHERE ((incomes.id = income_deposits.income_id) AND (incomes.user_id = auth.uid())))));


--
-- Name: incomes Users can view own incomes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own incomes" ON public.incomes FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: loan_payments Users can view own loan payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own loan payments" ON public.loan_payments FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: loans Users can view own loans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own loans" ON public.loans FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: savings_goals Users can view own savings goals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own savings goals" ON public.savings_goals FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_settings Users can view own settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own settings" ON public.user_settings FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: bank_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: credit_card_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.credit_card_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: credit_cards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;

--
-- Name: expenses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

--
-- Name: fixed_expenses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fixed_expenses ENABLE ROW LEVEL SECURITY;

--
-- Name: income_deposits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.income_deposits ENABLE ROW LEVEL SECURITY;

--
-- Name: incomes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.incomes ENABLE ROW LEVEL SECURITY;

--
-- Name: loan_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.loan_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: loans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

--
-- Name: savings_contributions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.savings_contributions ENABLE ROW LEVEL SECURITY;

--
-- Name: savings_goals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;

--
-- Name: user_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: TABLE bank_accounts; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.bank_accounts TO anon;
GRANT ALL ON TABLE public.bank_accounts TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.bank_accounts TO service_role;


--
-- Name: TABLE credit_card_payments; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.credit_card_payments TO anon;
GRANT ALL ON TABLE public.credit_card_payments TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.credit_card_payments TO service_role;


--
-- Name: TABLE credit_cards; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.credit_cards TO anon;
GRANT ALL ON TABLE public.credit_cards TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.credit_cards TO service_role;


--
-- Name: TABLE expenses; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.expenses TO anon;
GRANT ALL ON TABLE public.expenses TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.expenses TO service_role;


--
-- Name: TABLE fixed_expenses; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.fixed_expenses TO anon;
GRANT ALL ON TABLE public.fixed_expenses TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.fixed_expenses TO service_role;


--
-- Name: TABLE income_deposits; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.income_deposits TO anon;
GRANT ALL ON TABLE public.income_deposits TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.income_deposits TO service_role;


--
-- Name: TABLE incomes; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.incomes TO anon;
GRANT ALL ON TABLE public.incomes TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.incomes TO service_role;


--
-- Name: TABLE loan_payments; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.loan_payments TO anon;
GRANT ALL ON TABLE public.loan_payments TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.loan_payments TO service_role;


--
-- Name: TABLE loans; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.loans TO anon;
GRANT ALL ON TABLE public.loans TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.loans TO service_role;


--
-- Name: TABLE savings_contributions; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.savings_contributions TO anon;
GRANT ALL ON TABLE public.savings_contributions TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.savings_contributions TO service_role;


--
-- Name: TABLE savings_goals; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.savings_goals TO anon;
GRANT ALL ON TABLE public.savings_goals TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.savings_goals TO service_role;


--
-- Name: TABLE user_settings; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.user_settings TO anon;
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.user_settings TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.user_settings TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict nq6z0y34ORMabZ0lO66BC8JLxQb5LbpZbVEsUoBGC7N4BifDF7fRg4gMbFAEj5q

