-- Friends paying the user back.
--
-- An expense can name the friend who spent it (expenses.spent_by). When that
-- friend sends money back (usually Zelle, confirmed from the Inbox), the
-- income names them here, so the Inbox can show what each friend still owes:
-- what they spent minus what they paid back.

begin;

alter table public.incomes add column paid_back_by text
  check (paid_back_by is null or char_length(paid_back_by) between 1 and 60);

commit;
