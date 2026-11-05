-- ICOSIUM : profils publics, date de naissance privée, âge minimum 16 ans vérifié par la base.
-- Appliquée au projet Supabase « icosium » le 5 novembre 2026.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  is_guest boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index profiles_username_lower_idx on public.profiles (lower(username));

alter table public.profiles enable row level security;
create policy "Signed-in users can read profiles"
  on public.profiles for select to authenticated using (true);
-- Pas de politique d'écriture : les profils sont créés par le trigger ci-dessous uniquement.

create table private.birthdates (
  user_id uuid primary key references auth.users (id) on delete cascade,
  birthdate date not null
);

-- Appelée à chaque création de compte. Une exception annule la création du compte.
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
    uname := 'guest_' || substr(replace(new.id::text, '-', ''), 1, 8);
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Permet à l'app de vérifier qu'un pseudo est libre avant l'inscription (ne renvoie qu'un booléen).
create or replace function public.username_available(name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select name ~ '^[A-Za-z0-9_]{3,20}$'
     and not exists (select 1 from public.profiles p where lower(p.username) = lower(name));
$$;

revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;
