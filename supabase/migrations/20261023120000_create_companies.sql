-- Company tracker: companies saved from LinkedIn (by name or link) and what the
-- free lookup found about them (website, careers page, job board, summary).
--
-- Same rules as the finance tables: each row belongs to one user, only
-- signed-in users can touch the table, and policies limit them to their own rows.

begin;

create table public.companies (
  id uuid default gen_random_uuid() not null primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  source_url text,
  website text,
  careers_url text,
  ats text,
  ats_slug text,
  open_roles integer,
  summary text,
  status text default 'pending' not null,
  lookup_note text,
  notes text,
  checked_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint companies_name_check check (length(trim(name)) > 0),
  constraint companies_status_check check (status = any (array['pending', 'ready', 'needs_review'])),
  constraint companies_ats_check check (ats is null or ats = any (array['greenhouse', 'lever', 'ashby', 'workable', 'smartrecruiters', 'workday', 'other'])),
  constraint companies_open_roles_check check (open_roles is null or open_roles >= 0)
);

create index companies_user_id_idx on public.companies using btree (user_id);
create unique index companies_user_source_url_key on public.companies using btree (user_id, source_url);

alter table public.companies enable row level security;

create policy "Users can view own companies" on public.companies
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert own companies" on public.companies
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update own companies" on public.companies
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete own companies" on public.companies
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Explicit grants: anon gets nothing, authenticated gets only the four
-- operations the policies cover.
revoke all on table public.companies from anon, authenticated;
grant select, insert, update, delete on table public.companies to authenticated;

commit;
