-- Phone screenshots for the bank alert inbox.
--
-- Amex sends purchase alerts only as app notifications, which nothing on an
-- iPhone can read. Instead an iPhone shortcut (run by double-tapping the
-- back of the phone) screenshots the notification or the Amex transaction
-- list, reads its text on the phone, and sends the text in like an email.
--
-- 1. One key per device ("gmail", "phone"), so setting up the phone doesn't
--    switch off the Gmail script.
-- 2. Room for longer emails: the Gmail script now sends the designed (HTML)
--    version's text as well as the plain one.
-- 3. Signed-in users may add their own alerts: one screenshot of the
--    transaction list holds several purchases, and the site splits it into
--    one alert per purchase.

begin;

-- 1. A key per device ------------------------------------------------------

alter table public.bank_alert_keys add column label text not null default 'gmail'
  check (label in ('gmail', 'phone'));
alter table public.bank_alert_keys drop constraint bank_alert_keys_pkey;
alter table public.bank_alert_keys add primary key (user_id, label);

grant select (label) on table public.bank_alert_keys to authenticated;

drop function public.create_bank_alert_key();

-- Makes a new key for the signed-in user's device (replacing that device's
-- old one) and returns it once. Only its hash is kept.
create function public.create_bank_alert_key(p_label text default 'gmail') returns text
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
  insert into public.bank_alert_keys (user_id, label, key_hash)
    values (auth.uid(), p_label, encode(extensions.digest(new_key, 'sha256'), 'hex'))
    on conflict (user_id, label) do update set key_hash = excluded.key_hash, created_at = now(), last_used_at = null;
  return new_key;
end;
$$;

revoke all on function public.create_bank_alert_key(text) from public, anon;
grant execute on function public.create_bank_alert_key(text) to authenticated;

-- 2. Longer emails ---------------------------------------------------------

create or replace function public.ingest_bank_alert(
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
      left(coalesce(p_body, ''), 20000),
      coalesce(p_email_date, now())
    )
    on conflict (user_id, message_id) do nothing;
  get diagnostics inserted = row_count;
  return inserted > 0;
end;
$$;

-- 3. Splitting a screenshot into purchases ---------------------------------

create policy "Users can add own bank alerts" on public.bank_alerts
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and status = 'new'
    and expense_id is null
    and card_payment_id is null
    and (credit_card_id is null or exists (select 1 from public.credit_cards c where c.id = credit_card_id and c.user_id = (select auth.uid())))
    and (bank_account_id is null or exists (select 1 from public.bank_accounts b where b.id = bank_account_id and b.user_id = (select auth.uid())))
  );
grant insert on table public.bank_alerts to authenticated;

commit;
