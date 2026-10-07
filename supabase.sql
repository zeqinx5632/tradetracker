-- TradeTrack database setup
-- Run this entire file in Supabase Dashboard -> SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[A-Za-z0-9_]{3,24}$'),
  share_performance boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trade_date date not null,
  pnl numeric(14,2) not null,
  reason text not null check (char_length(reason) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> addressee_id)
);

create unique index if not exists friendships_unique_pair
on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  base_username text;
  candidate text;
  suffix integer := 0;
begin
  base_username := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'username', split_part(coalesce(new.email,''),'@',1)), '[^a-zA-Z0-9_]', '', 'g'));
  base_username := left(base_username, 24);
  if char_length(base_username) < 3 then base_username := 'trader'; end if;
  candidate := base_username;
  while exists (select 1 from public.profiles where username = candidate) loop
    suffix := suffix + 1;
    candidate := left(base_username, 24 - char_length(suffix::text) - 1) || '_' || suffix::text;
  end loop;
  insert into public.profiles(id, username) values(new.id, candidate);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.trades enable row level security;
alter table public.friendships enable row level security;

drop policy if exists "Authenticated users can view profiles" on public.profiles;
create policy "Authenticated users can view profiles"
on public.profiles for select to authenticated using (true);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles for insert to authenticated with check (id = auth.uid());

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "Users can view own and shared friend trades" on public.trades;
create policy "Users can view own and shared friend trades"
on public.trades for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.friendships f
    join public.profiles p on p.id = trades.user_id
    where f.status = 'accepted'
      and p.share_performance = true
      and ((f.requester_id = auth.uid() and f.addressee_id = trades.user_id)
        or (f.addressee_id = auth.uid() and f.requester_id = trades.user_id))
  )
);

drop policy if exists "Users can insert own trades" on public.trades;
create policy "Users can insert own trades"
on public.trades for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "Users can update own trades" on public.trades;
create policy "Users can update own trades"
on public.trades for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Users can delete own trades" on public.trades;
create policy "Users can delete own trades"
on public.trades for delete to authenticated using (user_id = auth.uid());

drop policy if exists "Users can view their friendships" on public.friendships;
create policy "Users can view their friendships"
on public.friendships for select to authenticated
using (requester_id = auth.uid() or addressee_id = auth.uid());

drop policy if exists "Users can send friend requests" on public.friendships;
create policy "Users can send friend requests"
on public.friendships for insert to authenticated
with check (requester_id = auth.uid() and status = 'pending');

drop policy if exists "Recipients can respond to friend requests" on public.friendships;
create policy "Recipients can respond to friend requests"
on public.friendships for update to authenticated
using (addressee_id = auth.uid() and status = 'pending')
with check (addressee_id = auth.uid() and status in ('accepted','declined'));

drop policy if exists "Users can delete their friendships" on public.friendships;
create policy "Users can delete their friendships"
on public.friendships for delete to authenticated
using (requester_id = auth.uid() or addressee_id = auth.uid());

-- Helpful indexes
create index if not exists trades_user_date_idx on public.trades(user_id, trade_date desc);
create index if not exists friendships_addressee_idx on public.friendships(addressee_id, status);
create index if not exists friendships_requester_idx on public.friendships(requester_id, status);
