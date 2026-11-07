-- Two small additions to the finance tables.
--
-- 1. Who made a purchase. Friends can use the card too, so an expense can
--    name the person who spent it. Empty means the user themself. The Inbox
--    offers the names used most as one-tap buttons.
--
-- 2. Money moved between the user's own accounts (Chase checking to
--    Santander) is its own kind of bank alert: it isn't spending, so the
--    Inbox never offers to add it as an expense.

begin;

alter table public.expenses add column spent_by text
  check (spent_by is null or char_length(spent_by) between 1 and 60);

alter table public.bank_alerts drop constraint bank_alerts_kind_check;
alter table public.bank_alerts add constraint bank_alerts_kind_check
  check (kind is null or kind = any (array['purchase', 'refund', 'transfer', 'own_transfer', 'card_payment', 'income', 'ignore', 'unreadable']));

commit;
