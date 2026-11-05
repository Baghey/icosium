-- ICOSIUM étape 2 : tables de domino.
-- Principe : le serveur (fonction « domino », avec la clé service) est le seul à écrire.
-- Les joueurs lisent la vue publique de leur table et UNIQUEMENT leur propre main (RLS).
-- L'état complet (mains de tous, pioche) vit dans le schéma private, jamais exposé.

create table public.domino_tables (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z]{4}$'),
  host_id uuid not null references auth.users (id) on delete cascade,
  options jsonb not null,
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  bot_allowed boolean not null default false,
  created_at timestamptz not null default now()
);
create index domino_tables_host_created_idx on public.domino_tables (host_id, created_at desc);

create table public.domino_seats (
  table_id uuid not null references public.domino_tables (id) on delete cascade,
  seat smallint not null check (seat between 0 and 3),
  user_id uuid not null references auth.users (id) on delete cascade,
  username text not null,
  joined_at timestamptz not null default now(),
  primary key (table_id, seat),
  unique (table_id, user_id)
);

create table public.domino_states (
  table_id uuid primary key references public.domino_tables (id) on delete cascade,
  version integer not null,
  view jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.domino_hands (
  table_id uuid not null references public.domino_tables (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  tiles jsonb not null,
  version integer not null,
  primary key (table_id, user_id)
);

create table private.domino_games (
  table_id uuid primary key references public.domino_tables (id) on delete cascade,
  version integer not null,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

-- Est-ce que la personne connectée est assise à cette table ?
create or replace function public.is_domino_member(p_table uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.domino_seats s where s.table_id = p_table and s.user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_domino_member(uuid) from public, anon;
grant execute on function public.is_domino_member(uuid) to authenticated;

alter table public.domino_tables enable row level security;
alter table public.domino_seats enable row level security;
alter table public.domino_states enable row level security;
alter table public.domino_hands enable row level security;

create policy "Members read their table" on public.domino_tables
  for select to authenticated using (public.is_domino_member(id));
create policy "Members read the seats" on public.domino_seats
  for select to authenticated using (public.is_domino_member(table_id));
create policy "Members read the public game view" on public.domino_states
  for select to authenticated using (public.is_domino_member(table_id));
create policy "Players read only their own hand" on public.domino_hands
  for select to authenticated using (user_id = (select auth.uid()));
-- Aucune politique d'écriture : seul le serveur (clé service) écrit.

-- Lecture de l'état complet, réservée au serveur.
create or replace function public.domino_load(p_table uuid)
returns table (version integer, state jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select g.version, g.state from private.domino_games g where g.table_id = p_table;
$$;

-- Enregistre un nouvel état d'un seul coup (état complet, vue publique, mains), si personne
-- n'a joué entre-temps (contrôle de version). Renvoie false en cas de conflit.
create or replace function public.domino_commit(
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
    insert into private.domino_games (table_id, version, state) values (p_table, 1, p_state)
      on conflict (table_id) do nothing;
  else
    update private.domino_games
       set version = version + 1, state = p_state, updated_at = now()
     where table_id = p_table and version = p_expected;
  end if;
  if not found then
    return false;
  end if;

  insert into public.domino_states (table_id, version, view) values (p_table, p_expected + 1, p_view)
    on conflict (table_id) do update set version = excluded.version, view = excluded.view, updated_at = now();

  insert into public.domino_hands (table_id, user_id, tiles, version)
    select p_table, h.key::uuid, h.value, p_expected + 1 from jsonb_each(p_hands) as h
    on conflict (table_id, user_id) do update set tiles = excluded.tiles, version = excluded.version;

  update public.domino_tables set status = p_status where id = p_table;
  return true;
end;
$$;

revoke all on function public.domino_load(uuid) from public, anon, authenticated;
revoke all on function public.domino_commit(uuid, integer, jsonb, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.domino_load(uuid) to service_role;
grant execute on function public.domino_commit(uuid, integer, jsonb, jsonb, jsonb, text) to service_role;

-- Temps réel : chaque joueur reçoit les changements des lignes qu'il a le droit de lire.
alter publication supabase_realtime add table public.domino_seats, public.domino_states, public.domino_hands;
