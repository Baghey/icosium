-- ICOSIUM étape 3 : le lobby (les tables du café).
-- Additif : ne change aucune partie en cours. Chaque table de jeu gagne :
--   visibility : qui la voit dans le lobby ('public' = tout le café, 'friends' = les amis des joueurs assis,
--                'private' = seulement par le code, le lien ou une invitation) ;
--   kicked     : les personnes que le Patron a retirées (elles ne peuvent plus se rasseoir).
-- Les fonctions du lobby marchent pour tous les jeux listés dans private.lobby_games() :
-- un nouveau jeu n'a qu'à suivre le même schéma (<jeu>_tables, <jeu>_seats, <jeu>_states) et s'ajouter à la liste.

alter table public.domino_tables
  add column visibility text not null default 'friends' check (visibility in ('public', 'friends', 'private')),
  add column kicked uuid[] not null default '{}';
alter table public.ludo_tables
  add column visibility text not null default 'friends' check (visibility in ('public', 'friends', 'private')),
  add column kicked uuid[] not null default '{}';

-- Le lobby ne lit que les tables qui attendent : un index partiel suffit.
create index domino_tables_waiting_idx on public.domino_tables (created_at desc) where status = 'waiting';
create index ludo_tables_waiting_idx on public.ludo_tables (created_at desc) where status = 'waiting';
create index if not exists domino_seats_user_idx on public.domino_seats (user_id);

-- Les jeux qui ont des tables. Ajouter ici chaque nouveau jeu.
create or replace function private.lobby_games()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['domino', 'ludo']::text[];
$$;

create or replace function private.check_game(p_game text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_game is null or not (p_game = any (private.lobby_games())) then
    raise exception 'unknown_game' using errcode = '22023';
  end if;
end;
$$;

-- Une personne retirée par le Patron ne peut plus se rasseoir à cette table (même par le lien).
create or replace function private.refuse_kicked_seat()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kicked uuid[];
begin
  if new.user_id is null then
    return new;
  end if;
  execute format('select kicked from public.%I where id = $1', tg_argv[0]) into v_kicked using new.table_id;
  if new.user_id = any (coalesce(v_kicked, '{}')) then
    raise exception 'kicked' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger domino_seats_refuse_kicked before insert on public.domino_seats
  for each row execute function private.refuse_kicked_seat('domino_tables');
create trigger ludo_seats_refuse_kicked before insert on public.ludo_seats
  for each row execute function private.refuse_kicked_seat('ludo_tables');

-- ---------- Lire le lobby ----------
-- Une seule lecture pour l'écran « Jouer » : mes tables en cours, et les tables qui attendent
-- encore des joueurs et que j'ai le droit de voir. Seuls les pseudos des joueurs assis sortent :
-- aucune main, aucune information de partie.
create or replace function public.lobby()
returns table (
  game text,
  id uuid,
  code text,
  host_id uuid,
  host_name text,
  options jsonb,
  status text,
  visibility text,
  created_at timestamptz,
  seats jsonb,
  mine boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  g text;
  me uuid := (select auth.uid());
begin
  if me is null then
    return;
  end if;
  foreach g in array private.lobby_games() loop
    return query execute format(
      $q$
      with t as (
        select t.*,
               exists (select 1 from public.%2$I s where s.table_id = t.id and s.user_id = $1) as is_mine
          from public.%1$I t
         where t.status in ('waiting', 'playing')
           and t.created_at > now() - interval '12 hours'
      )
      select %4$L::text, t.id, t.code, t.host_id, p.username, t.options, t.status, t.visibility, t.created_at,
             coalesce((
               select jsonb_agg(jsonb_build_object('seat', s.seat, 'userId', s.user_id, 'username', s.username, 'isBot', s.is_bot) order by s.seat)
                 from public.%2$I s where s.table_id = t.id
             ), '[]'::jsonb),
             t.is_mine
        from t
        left join public.profiles p on p.id = t.host_id
        left join public.%3$I st on st.table_id = t.id
       where (
               t.is_mine
               and (
                 (t.status = 'waiting' and t.created_at > now() - interval '6 hours')
                 or (t.status = 'playing' and coalesce(st.updated_at, t.created_at) > now() - interval '2 hours')
               )
             )
          or (
               not t.is_mine
               and t.status = 'waiting'
               and t.created_at > now() - interval '3 hours'
               and not ($1 = any (t.kicked))
               and not private.is_blocked_between($1, t.host_id)
               and (select count(*) from public.%2$I s where s.table_id = t.id) < coalesce((t.options ->> 'players')::int, 4)
               and (
                 t.visibility = 'public'
                 or (
                   t.visibility = 'friends'
                   and exists (
                     select 1 from public.%2$I s
                      where s.table_id = t.id and s.user_id is not null and private.are_friends($1, s.user_id)
                   )
                 )
               )
             )
       order by t.created_at desc
       limit 40
      $q$,
      g || '_tables', g || '_seats', g || '_states', g
    ) using me;
  end loop;
end;
$$;
revoke all on function public.lobby() from public, anon;
grant execute on function public.lobby() to authenticated;

-- ---------- Le Patron règle sa table ----------

-- Qui voit la table dans le lobby. Seulement le Patron, et seulement avant le début de la partie.
create or replace function public.set_table_visibility(p_game text, p_table uuid, p_visibility text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  perform private.check_game(p_game);
  if p_visibility not in ('public', 'friends', 'private') then
    raise exception 'invalid_visibility' using errcode = '22023';
  end if;
  execute format(
    'update public.%I set visibility = $1 where id = $2 and host_id = $3 and status = ''waiting''',
    p_game || '_tables'
  ) using p_visibility, p_table, (select auth.uid());
  get diagnostics n = row_count;
  return n > 0;
end;
$$;
revoke all on function public.set_table_visibility(text, uuid, text) from public, anon;
grant execute on function public.set_table_visibility(text, uuid, text) to authenticated;

-- Le Patron retire quelqu'un avant le début de la partie. La personne ne peut plus revenir.
create or replace function public.kick_from_table(p_game text, p_table uuid, p_user uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  v_host uuid;
  v_status text;
  n integer;
begin
  perform private.check_game(p_game);
  execute format('select host_id, status from public.%I where id = $1 for update', p_game || '_tables')
    into v_host, v_status using p_table;
  if v_host is null or v_host <> me or v_status <> 'waiting' or p_user = me then
    return false;
  end if;
  execute format('delete from public.%I where table_id = $1 and user_id = $2', p_game || '_seats') using p_table, p_user;
  get diagnostics n = row_count;
  execute format(
    'update public.%I set kicked = array_append(kicked, $2) where id = $1 and not ($2 = any (kicked))',
    p_game || '_tables'
  ) using p_table, p_user;
  return n > 0;
end;
$$;
revoke all on function public.kick_from_table(text, uuid, uuid) from public, anon;
grant execute on function public.kick_from_table(text, uuid, uuid) to authenticated;

-- Je me lève de la table avant le début de la partie (ma chaise redevient libre).
-- Si j'étais le Patron, la table passe au joueur assis depuis le plus longtemps ; si je
-- suis le dernier, la table ferme. Pendant une partie, on ne se lève pas : on revient plus tard.
-- Renvoie 'left', 'closed', 'playing' ou 'not_seated'.
create or replace function public.leave_table(p_game text, p_table uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  v_host uuid;
  v_status text;
  v_next uuid;
  n integer;
begin
  perform private.check_game(p_game);
  execute format('select host_id, status from public.%I where id = $1 for update', p_game || '_tables')
    into v_host, v_status using p_table;
  if v_status is null then
    return 'not_seated';
  end if;
  if v_status <> 'waiting' then
    return 'playing';
  end if;
  execute format('delete from public.%I where table_id = $1 and user_id = $2', p_game || '_seats') using p_table, me;
  get diagnostics n = row_count;
  if n = 0 then
    return 'not_seated';
  end if;
  if v_host = me then
    execute format(
      'select user_id from public.%I where table_id = $1 and user_id is not null order by joined_at limit 1',
      p_game || '_seats'
    ) into v_next using p_table;
    if v_next is null then
      execute format('delete from public.%I where id = $1', p_game || '_tables') using p_table;
      return 'closed';
    end if;
    execute format('update public.%I set host_id = $2 where id = $1', p_game || '_tables') using p_table, v_next;
  end if;
  return 'left';
end;
$$;
revoke all on function public.leave_table(text, uuid) from public, anon;
grant execute on function public.leave_table(text, uuid) to authenticated;

-- Les joueurs déjà assis voient tout de suite le changement de Patron ou de visibilité.
alter publication supabase_realtime add table public.domino_tables, public.ludo_tables;
