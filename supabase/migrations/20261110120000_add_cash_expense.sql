-- Cash expenses said to Siri.
--
-- An iPhone shortcut ("Hey Siri, cash expense") asks what was bought, and
-- sends what was said to the website with the phone key, like the
-- screenshot shortcut. The site works out the amount and the store; this
-- function checks the key and adds the expense for the key's owner.
--
-- Like a cash expense entered on the dashboard, it comes out of a bank
-- account: the one the last cash expense used, or else the first checking
-- account. The category is the one learned for that store, if any.

begin;

create function public.add_cash_expense(
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
  account uuid;
  account_name text;
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

  select e.bank_account_id into account from public.expenses e
    where e.user_id = owner and e.payment_method = 'Cash' and e.bank_account_id is not null
    order by e.created_at desc limit 1;
  if account is null then
    select b.id into account from public.bank_accounts b
      where b.user_id = owner
      order by (b.type = 'checking') desc, b.display_order
      limit 1;
  end if;
  select name into account_name from public.bank_accounts where id = account;

  insert into public.expenses (user_id, description, amount, category, payment_method, expense_date, bank_account_id)
    values (owner, left(p_description, 200), round(p_amount, 2), chosen, 'Cash', coalesce(p_date, current_date), account);

  return jsonb_build_object('status', 'added', 'category', chosen, 'account', account_name);
end;
$$;

revoke all on function public.add_cash_expense(text, text, numeric, text, text, date) from public;
grant execute on function public.add_cash_expense(text, text, numeric, text, text, date) to anon, authenticated;

commit;
