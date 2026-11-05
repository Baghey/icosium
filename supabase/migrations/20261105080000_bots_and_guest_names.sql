-- ICOSIUM : chaises tenues par des bots, et pseudo choisi par les invités.

-- 1. Bots : une chaise est soit un humain (user_id), soit un bot (is_bot, sans user_id).
--    Les bots ne viennent que si le Patron le demande (le serveur vérifie et passe bot_allowed à true).
alter table public.domino_seats alter column user_id drop not null;
alter table public.domino_seats add column is_bot boolean not null default false;
alter table public.domino_seats add constraint domino_seats_human_or_bot
  check ((is_bot and user_id is null) or (not is_bot and user_id is not null));

-- 2. Invités : ils choisissent leur pseudo à l'entrée (sinon guest_xxxxxxxx comme avant).
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  b date;
  years int;
  uname text;
begin
  if coalesce(new.is_anonymous, false) then
    -- Compte invité : la personne doit confirmer avoir 16 ans ou plus.
    if coalesce(meta ->> 'age_confirmed', '') <> 'true' then
      raise exception 'age_not_confirmed';
    end if;
    uname := nullif(trim(meta ->> 'username'), '');
    if uname is null then
      uname := 'guest_' || substr(replace(new.id::text, '-', ''), 1, 8);
    elsif uname !~ '^[A-Za-z0-9_]{3,20}$' then
      raise exception 'invalid_username';
    elsif exists (select 1 from public.profiles p where lower(p.username) = lower(uname)) then
      raise exception 'username_taken';
    end if;
    insert into public.profiles (id, username, is_guest) values (new.id, uname, true);
    return new;
  end if;

  begin
    b := (meta ->> 'birthdate')::date;
  exception when others then
    raise exception 'invalid_birthdate';
  end;
  if b is null or b > current_date then
    raise exception 'invalid_birthdate';
  end if;
  years := extract(year from age(current_date, b))::int;
  if years > 120 then
    raise exception 'invalid_birthdate';
  end if;
  if years < 16 then
    raise exception 'too_young';
  end if;

  uname := meta ->> 'username';
  if uname is null or uname !~ '^[A-Za-z0-9_]{3,20}$' then
    raise exception 'invalid_username';
  end if;

  insert into public.profiles (id, username, is_guest) values (new.id, uname, false);
  insert into private.birthdates (user_id, birthdate) values (new.id, b);
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

-- Un invité déjà connecté peut changer son pseudo (les comptes complets, non : pas encore prévu).
-- Renvoie 'ok', 'invalid', 'taken' ou 'not_guest'.
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
  -- Le nouveau pseudo s'affiche aussi aux tables qui n'ont pas encore commencé.
  update public.domino_seats s set username = name
    from public.domino_tables t
   where s.table_id = t.id and s.user_id = me and t.status = 'waiting';
  return 'ok';
exception when unique_violation then
  return 'taken';
end;
$$;

revoke all on function public.set_guest_username(text) from public, anon;
grant execute on function public.set_guest_username(text) to authenticated;
