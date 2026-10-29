-- Bank alert inbox: transaction alert emails that a Google Apps Script copies
-- out of Gmail (label "Bank alerts"), what the site reads from them, and
-- whether they've been confirmed into expenses.
--
-- The Gmail script has no site login, so it doesn't write to the table
-- directly. It calls ingest_bank_alert() with a long random key that only
-- the user has; the function looks up whose key it is and saves the email
-- for that user. Only a hash of the key is stored.
--
-- Same rules as the finance tables otherwise: each row belongs to one user,
-- policies limit signed-in users to their own rows, and anon gets nothing
-- except the one ingest function.

begin;

-- Emails, plus what the site read from them -----------------------------

create table public.bank_alerts (
  id uuid default gen_random_uuid() not null primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  message_id text not null,
  sender text not null,
  subject text default '' not null,
  body text default '' not null,
  email_date timestamp with time zone not null,
  -- Filled in by the site's reader (lib/finance/alerts.ts)
  kind text,
  amount numeric(12,2),
  merchant text,
  bank text,
  card_last4 text,
  category text,
  credit_card_id uuid references public.credit_cards (id) on delete set null,
  bank_account_id uuid references public.bank_accounts (id) on delete set null,
  parser_version integer,
  -- Review
  status text default 'new' not null,
  expense_id uuid references public.expenses (id) on delete set null,
  card_payment_id uuid references public.credit_card_payments (id) on delete set null,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  constraint bank_alerts_kind_check check (kind is null or kind = any (array['purchase', 'refund', 'transfer', 'card_payment', 'income', 'ignore', 'unreadable'])),
  constraint bank_alerts_status_check check (status = any (array['new', 'accepted', 'dismissed'])),
  constraint bank_alerts_amount_check check (amount is null or amount >= 0)
);

create unique index bank_alerts_user_message_key on public.bank_alerts using btree (user_id, message_id);
create index bank_alerts_user_status_idx on public.bank_alerts using btree (user_id, status);

alter table public.bank_alerts enable row level security;

-- Rows arrive only through ingest_bank_alert(), so there's no insert policy.
create policy "Users can view own bank alerts" on public.bank_alerts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can update own bank alerts" on public.bank_alerts
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (credit_card_id is null or exists (select 1 from public.credit_cards c where c.id = credit_card_id and c.user_id = (select auth.uid())))
    and (bank_account_id is null or exists (select 1 from public.bank_accounts b where b.id = bank_account_id and b.user_id = (select auth.uid())))
    and (expense_id is null or exists (select 1 from public.expenses e where e.id = expense_id and e.user_id = (select auth.uid())))
    and (card_payment_id is null or exists (select 1 from public.credit_card_payments p where p.id = card_payment_id and p.user_id = (select auth.uid())))
  );
create policy "Users can delete own bank alerts" on public.bank_alerts
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.bank_alerts from anon, authenticated;
grant select, update, delete on table public.bank_alerts to authenticated;

-- What the site has learned from your choices ----------------------------

-- "STARBUCKS" -> Food, after you've filed it once.
create table public.merchant_categories (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  merchant_key text not null,
  category text not null,
  updated_at timestamp with time zone default now() not null,
  primary key (user_id, merchant_key)
);

-- "citi 1234" -> your Costco card, after you've picked it once.
create table public.alert_accounts (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_key text not null,
  credit_card_id uuid references public.credit_cards (id) on delete cascade,
  bank_account_id uuid references public.bank_accounts (id) on delete cascade,
  updated_at timestamp with time zone default now() not null,
  primary key (user_id, account_key),
  constraint alert_accounts_one_target check ((credit_card_id is null) <> (bank_account_id is null))
);

alter table public.merchant_categories enable row level security;
alter table public.alert_accounts enable row level security;

create policy "Users can view own merchant categories" on public.merchant_categories
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert own merchant categories" on public.merchant_categories
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update own merchant categories" on public.merchant_categories
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete own merchant categories" on public.merchant_categories
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users can view own alert accounts" on public.alert_accounts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert own alert accounts" on public.alert_accounts
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and (credit_card_id is null or exists (select 1 from public.credit_cards c where c.id = credit_card_id and c.user_id = (select auth.uid())))
    and (bank_account_id is null or exists (select 1 from public.bank_accounts b where b.id = bank_account_id and b.user_id = (select auth.uid())))
  );
create policy "Users can update own alert accounts" on public.alert_accounts
  for update to authenticated using ((select auth.uid()) = user_id) with check (
    (select auth.uid()) = user_id
    and (credit_card_id is null or exists (select 1 from public.credit_cards c where c.id = credit_card_id and c.user_id = (select auth.uid())))
    and (bank_account_id is null or exists (select 1 from public.bank_accounts b where b.id = bank_account_id and b.user_id = (select auth.uid())))
  );
create policy "Users can delete own alert accounts" on public.alert_accounts
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.merchant_categories, public.alert_accounts from anon, authenticated;
grant select, insert, update, delete on table public.merchant_categories, public.alert_accounts to authenticated;

-- The Gmail script's key -------------------------------------------------

create table public.bank_alert_keys (
  user_id uuid not null primary key references auth.users (id) on delete cascade,
  key_hash text not null unique,
  created_at timestamp with time zone default now() not null,
  last_used_at timestamp with time zone
);

alter table public.bank_alert_keys enable row level security;

-- Signed-in users can see whether they have a key (and when it was last
-- used), never the key itself; keys are created only by the function below.
create policy "Users can view own bank alert key" on public.bank_alert_keys
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can delete own bank alert key" on public.bank_alert_keys
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.bank_alert_keys from anon, authenticated;
grant select (user_id, created_at, last_used_at), delete on table public.bank_alert_keys to authenticated;

-- Makes a new key for the signed-in user (replacing any old one) and returns
-- it once. Only its hash is kept.
create function public.create_bank_alert_key() returns text
  language plpgsql security definer
  set search_path = ''
  as $$
declare
  new_key text;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  new_key := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.bank_alert_keys (user_id, key_hash)
    values (auth.uid(), encode(extensions.digest(new_key, 'sha256'), 'hex'))
    on conflict (user_id) do update set key_hash = excluded.key_hash, created_at = now(), last_used_at = null;
  return new_key;
end;
$$;

-- Called by the Gmail script for each alert email. Saves it for the key's
-- owner; the same email sent twice is saved once.
create function public.ingest_bank_alert(
  p_key text,
  p_message_id text,
  p_sender text,
  p_subject text,
  p_body text,
  p_email_date timestamp with time zone
) returns boolean
  language plpgsql security definer
  set search_path = ''
  as $$
declare
  owner uuid;
  inserted integer;
begin
  update public.bank_alert_keys
    set last_used_at = now()
    where key_hash = encode(extensions.digest(coalesce(p_key, ''), 'sha256'), 'hex')
    returning user_id into owner;
  if owner is null then
    raise exception 'invalid key' using errcode = '28000';
  end if;

  insert into public.bank_alerts (user_id, message_id, sender, subject, body, email_date)
    values (
      owner,
      left(p_message_id, 200),
      left(coalesce(p_sender, ''), 300),
      left(coalesce(p_subject, ''), 500),
      left(coalesce(p_body, ''), 8000),
      coalesce(p_email_date, now())
    )
    on conflict (user_id, message_id) do nothing;
  get diagnostics inserted = row_count;
  return inserted > 0;
end;
$$;

revoke all on function public.create_bank_alert_key() from public, anon;
grant execute on function public.create_bank_alert_key() to authenticated;
revoke all on function public.ingest_bank_alert(text, text, text, text, text, timestamp with time zone) from public;
grant execute on function public.ingest_bank_alert(text, text, text, text, text, timestamp with time zone) to anon, authenticated;

commit;
