-- When each card or account was last checked against a statement, so the
-- Inbox can suggest checking again about a month later.
--
-- The statement file itself is never stored: it's read in the browser, and
-- only each line's date, description and amount are compared with what's
-- recorded. This table keeps just the date of the check and how far the
-- statement went.

begin;

create table public.statement_checks (
  user_id uuid not null references auth.users (id) on delete cascade,
  account_key text not null check (account_key ~ '^(card|account):[0-9a-f-]{36}$'), -- "card:<id>" or "account:<id>"
  checked_at timestamp with time zone default now() not null,
  through_date date not null, -- the statement's last transaction
  primary key (user_id, account_key)
);

alter table public.statement_checks enable row level security;

create policy "Users can view own statement checks" on public.statement_checks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert own statement checks" on public.statement_checks
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update own statement checks" on public.statement_checks
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete own statement checks" on public.statement_checks
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.statement_checks from anon, authenticated;
grant select, insert, update, delete on table public.statement_checks to authenticated;

commit;
