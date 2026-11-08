-- Cash is paid from the wallet, not from a bank account.
--
-- Cash expenses (said to Siri, or entered on the dashboard) were tied to a
-- bank account and lowered its balance. Now they stand on their own: the
-- expense is recorded as Cash and no account is touched. Cash expenses
-- already saved are untied too.

begin;

create or replace function public.add_cash_expense(
  p_key text,
  p_description text,
  p_amount numeric,
  p_category text, -- a guess; a learned category wins
  p_merchant_key text,
  p_date date
) returns jsonb
  language plpgsql security definer
  set search_path = ''
  as $$
declare
  owner uuid;
  chosen text;
begin
  update public.bank_alert_keys
    set last_used_at = now()
    where key_hash = encode(extensions.digest(coalesce(p_key, ''), 'sha256'), 'hex')
    returning user_id into owner;
  if owner is null then
    raise exception 'invalid key' using errcode = '28000';
  end if;

  if p_amount is null or p_amount <= 0 or p_amount >= 100000 then
    raise exception 'bad amount';
  end if;

  select category into chosen from public.merchant_categories
    where user_id = owner and merchant_key = coalesce(p_merchant_key, '');
  chosen := coalesce(chosen, p_category, 'Other');
  if chosen not in ('Food', 'Transport', 'Shopping', 'Bills', 'Other') then
    chosen := 'Other';
  end if;

  -- Said twice (Siri retrying, or the shortcut run again): add it once.
  if exists (
    select 1 from public.expenses
    where user_id = owner and payment_method = 'Cash' and amount = round(p_amount, 2)
      and description = left(p_description, 200) and created_at > now() - interval '2 minutes'
  ) then
    return jsonb_build_object('status', 'duplicate', 'category', chosen);
  end if;

  insert into public.expenses (user_id, description, amount, category, payment_method, expense_date)
    values (owner, left(p_description, 200), round(p_amount, 2), chosen, 'Cash', coalesce(p_date, current_date));

  return jsonb_build_object('status', 'added', 'category', chosen);
end;
$$;

update public.expenses set bank_account_id = null where payment_method = 'Cash' and bank_account_id is not null;

commit;
