-- ICOSIUM étape 5 : tables de Ronda.
-- Même principe que le domino : le serveur (fonction « ronda », avec la clé service) est le seul à
-- écrire. Les joueurs lisent la vue publique de leur table et UNIQUEMENT leur propre main (RLS).
-- L'état complet (mains de tous, pioche, mains de départ pour vérifier les annonces) vit dans le
-- schéma private, jamais exposé.
-- Migration additive : elle ne touche à aucune partie de domino ou de Ludo en cours, et branche
-- la Ronda sur le lobby (visibilité, personnes retirées, « Les tables du café »).

create table public.ronda_tables (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z]{4}$'),
  host_id uuid not null references auth.users (id) on delete cascade,
  options jsonb not null,
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  bot_allowed boolean not null default false,
  visibility text not null default 'friends' check (visibility in ('public', 'friends', 'private')),
  kicked uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index ronda_tables_host_created_idx on public.ronda_tables (host_id, created_at desc);

-- Une chaise : un humain (user_id) ou un bot (is_bot, sans user_id).
create table public.ronda_seats (
  table_id uuid not null references public.ronda_tables (id) on delete cascade,
  seat smallint not null check (seat between 0 and 3),
  user_id uuid references auth.users (id) on delete cascade,
  username text not null,
  is_bot boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (table_id, seat),
  unique (table_id, user_id),
  constraint ronda_seats_human_or_bot check ((is_bot and user_id is null) or (not is_bot and user_id is not null))
);
create index ronda_seats_user_idx on public.ronda_seats (user_id);

create table public.ronda_states (
  table_id uuid primary key references public.ronda_tables (id) on delete cascade,
  version integer not null,
  view jsonb not null,
  updated_at timestamptz not null default now()
);

-- La main de chaque joueur : chacun ne peut lire que la sienne.
create table public.ronda_hands (
  table_id uuid not null references public.ronda_tables (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  cards jsonb not null,
  version integer not null,
  primary key (table_id, user_id)
);
create index ronda_hands_user_idx on public.ronda_hands (user_id);

create table private.ronda_games (
  table_id uuid primary key references public.ronda_tables (id) on delete cascade,
  version integer not null,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

-- Est-ce que la personne connectée est assise à cette table ?
create or replace function public.is_ronda_member(p_table uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.ronda_seats s where s.table_id = p_table and s.user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_ronda_member(uuid) from public, anon;
grant execute on function public.is_ronda_member(uuid) to authenticated;

alter table public.ronda_tables enable row level security;
alter table public.ronda_seats enable row level security;
alter table public.ronda_states enable row level security;
alter table public.ronda_hands enable row level security;
alter table private.ronda_games enable row level security;

create policy "Members read their ronda table" on public.ronda_tables
  for select to authenticated using (public.is_ronda_member(id));
create policy "Members read the ronda seats" on public.ronda_seats
  for select to authenticated using (public.is_ronda_member(table_id));
create policy "Members read the public ronda view" on public.ronda_states
  for select to authenticated using (public.is_ronda_member(table_id));
create policy "Players read only their own ronda hand" on public.ronda_hands
  for select to authenticated using (user_id = (select auth.uid()));
-- Aucune politique d'écriture : seul le serveur (clé service) écrit.

-- Lecture de l'état complet, réservée au serveur.
create or replace function public.ronda_load(p_table uuid)
returns table (version integer, state jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select g.version, g.state from private.ronda_games g where g.table_id = p_table;
$$;

-- Enregistre un nouvel état d'un seul coup (état complet + vue publique), si personne n'a joué
-- entre-temps (contrôle de version). Renvoie false en cas de conflit.
create or replace function public.ronda_commit(
  p_table uuid,
  p_expected integer,
  p_state jsonb,
  p_view jsonb,
  p_hands jsonb,
  p_status text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_expected = 0 then
    insert into private.ronda_games (table_id, version, state) values (p_table, 1, p_state)
      on conflict (table_id) do nothing;
  else
    update private.ronda_games
       set version = version + 1, state = p_state, updated_at = now()
     where table_id = p_table and version = p_expected;
  end if;
  if not found then
    return false;
  end if;

  insert into public.ronda_states (table_id, version, view) values (p_table, p_expected + 1, p_view)
    on conflict (table_id) do update set version = excluded.version, view = excluded.view, updated_at = now();

  insert into public.ronda_hands (table_id, user_id, cards, version)
    select p_table, h.key::uuid, h.value, p_expected + 1 from jsonb_each(p_hands) as h
    on conflict (table_id, user_id) do update set cards = excluded.cards, version = excluded.version;

  update public.ronda_tables set status = p_status where id = p_table;
  return true;
end;
$$;

revoke all on function public.ronda_load(uuid) from public, anon, authenticated;
revoke all on function public.ronda_commit(uuid, integer, jsonb, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.ronda_load(uuid) to service_role;
grant execute on function public.ronda_commit(uuid, integer, jsonb, jsonb, jsonb, text) to service_role;

-- Temps réel : chaque joueur reçoit les changements des lignes qu'il a le droit de lire.
alter publication supabase_realtime add table public.ronda_tables, public.ronda_seats, public.ronda_states, public.ronda_hands;

-- Un invité qui change de pseudo : le nouveau nom s'affiche aussi aux tables de Ronda pas encore
-- commencées (même fonction qu'avant, avec une ligne en plus pour la Ronda).
create or replace function public.set_guest_username(name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null or not exists (select 1 from public.profiles p where p.id = me and p.is_guest) then
    return 'not_guest';
  end if;
  if name is null or name !~ '^[A-Za-z0-9_]{3,20}$' then
    return 'invalid';
  end if;
  if exists (select 1 from public.profiles p where lower(p.username) = lower(name) and p.id <> me) then
    return 'taken';
  end if;
  update public.profiles set username = name where id = me;
  update public.domino_seats s set username = name
    from public.domino_tables t
   where s.table_id = t.id and s.user_id = me and t.status = 'waiting';
  update public.ludo_seats s set username = name
    from public.ludo_tables t
   where s.table_id = t.id and s.user_id = me and t.status = 'waiting';
  update public.ronda_seats s set username = name
    from public.ronda_tables t
   where s.table_id = t.id and s.user_id = me and t.status = 'waiting';
  return 'ok';
exception when unique_violation then
  return 'taken';
end;
$$;

revoke all on function public.set_guest_username(text) from public, anon;
grant execute on function public.set_guest_username(text) to authenticated;

-- ---------- Le lobby ----------
create index ronda_tables_waiting_idx on public.ronda_tables (created_at desc) where status = 'waiting';

-- Une personne retirée par le Patron ne peut plus se rasseoir (même règle que domino et Ludo).
create trigger ronda_seats_refuse_kicked before insert on public.ronda_seats
  for each row execute function private.refuse_kicked_seat('ronda_tables');

-- La Ronda rejoint la liste des jeux du lobby : lobby(), set_table_visibility, kick_from_table
-- et leave_table la prennent en charge sans autre changement.
create or replace function private.lobby_games()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['domino', 'ludo', 'ronda']::text[];
$$;
