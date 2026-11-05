-- ICOSIUM étape 4 (première partie) : amis, blocages, signalements et messagerie privée.
-- Principe : on lit ses propres données grâce à la RLS ; toutes les écritures passent par des
-- fonctions qui vérifient tout (amis, blocages, anti-spam) au nom de la personne connectée.

-- ---------- Amis ----------

create table public.friendships (
  requester uuid not null references auth.users (id) on delete cascade,
  addressee uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (requester, addressee),
  check (requester <> addressee)
);
-- Une seule relation par paire, quel que soit le sens.
create unique index friendships_pair_idx on public.friendships (least(requester, addressee), greatest(requester, addressee));
create index friendships_addressee_idx on public.friendships (addressee);

create table public.blocks (
  blocker uuid not null references auth.users (id) on delete cascade,
  blocked uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
create index blocks_blocked_idx on public.blocks (blocked);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null references auth.users (id) on delete cascade,
  target uuid not null references auth.users (id) on delete cascade,
  message_id uuid,
  reason text not null check (char_length(reason) between 1 and 500),
  created_at timestamptz not null default now()
);
create index reports_reporter_idx on public.reports (reporter, created_at desc);

-- ---------- Conversations ----------

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  -- Conversation à deux : « idA:idB » (plus petit d'abord), pour la retrouver.
  pair_key text unique,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

-- state : active (dans mes messages), request (d'un inconnu, dans « Demandes »), declined (supprimée).
create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  state text not null default 'active' check (state in ('active', 'request', 'declined')),
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conversation_members_user_idx on public.conversation_members (user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'text' check (kind in ('text', 'invite')),
  body text not null default '' check (char_length(body) <= 1000),
  -- Invitation à une table : { "game": "domino", "code": "ABCD", "players": 4, "free": 2 }.
  meta jsonb,
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at desc);
create index messages_sender_idx on public.messages (sender_id, created_at desc);

-- ---------- Aides (privées) ----------

create or replace function private.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
     where (blocker = a and blocked = b) or (blocker = b and blocked = a)
  );
$$;

create or replace function private.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships
     where status = 'accepted'
       and least(requester, addressee) = least(a, b)
       and greatest(requester, addressee) = greatest(a, b)
  );
$$;

create or replace function public.is_conversation_member(p_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversation_members m
     where m.conversation_id = p_conversation and m.user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_conversation_member(uuid) from public, anon;
grant execute on function public.is_conversation_member(uuid) to authenticated;

-- ---------- RLS : chacun lit seulement ce qui le concerne ----------

alter table public.friendships enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

create policy "Read my friendships" on public.friendships
  for select to authenticated using ((select auth.uid()) in (requester, addressee));
create policy "Read my blocks" on public.blocks
  for select to authenticated using (blocker = (select auth.uid()));
-- reports : aucune lecture pour les membres (modération plus tard).
create policy "Read my conversations" on public.conversations
  for select to authenticated using (public.is_conversation_member(id));
create policy "Read members of my conversations" on public.conversation_members
  for select to authenticated using (public.is_conversation_member(conversation_id));
-- Les messages d'une personne que j'ai bloquée ne me parviennent plus.
create policy "Read messages of my conversations" on public.messages
  for select to authenticated using (
    public.is_conversation_member(conversation_id)
    and not exists (select 1 from public.blocks b where b.blocker = (select auth.uid()) and b.blocked = sender_id)
  );
-- Aucune politique d'écriture : tout passe par les fonctions ci-dessous.

-- ---------- Amis : demander, répondre, retirer, bloquer ----------

-- Renvoie 'sent', 'accepted' (il m'avait déjà demandé), 'already', 'not_found', 'self', 'blocked', 'rate_limited'.
create or replace function public.send_friend_request(target_username text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  target uuid;
  existing public.friendships%rowtype;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  select id into target from public.profiles where lower(username) = lower(trim(target_username));
  if target is null then return 'not_found'; end if;
  if target = me then return 'self'; end if;
  if private.is_blocked_between(me, target) then return 'blocked'; end if;
  -- Anti-spam : 30 demandes par heure au plus.
  if (select count(*) from public.friendships where requester = me and created_at > now() - interval '1 hour') >= 30 then
    return 'rate_limited';
  end if;
  select * into existing from public.friendships
   where least(requester, addressee) = least(me, target) and greatest(requester, addressee) = greatest(me, target);
  if found then
    if existing.status = 'accepted' then return 'already'; end if;
    if existing.requester = target then
      update public.friendships set status = 'accepted', accepted_at = now()
       where requester = target and addressee = me;
      update public.conversation_members set state = 'active'
       where user_id in (me, target) and state = 'request'
         and conversation_id = (select id from public.conversations where pair_key = least(me, target)::text || ':' || greatest(me, target)::text);
      return 'accepted';
    end if;
    return 'already';
  end if;
  insert into public.friendships (requester, addressee) values (me, target);
  return 'sent';
end;
$$;

create or replace function public.respond_friend_request(other uuid, accept boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if accept then
    update public.friendships set status = 'accepted', accepted_at = now()
     where requester = other and addressee = me and status = 'pending';
    if not found then return 'not_found'; end if;
    update public.conversation_members set state = 'active'
     where user_id in (me, other) and state = 'request'
       and conversation_id = (select id from public.conversations where pair_key = least(me, other)::text || ':' || greatest(me, other)::text);
    return 'accepted';
  end if;
  delete from public.friendships where requester = other and addressee = me and status = 'pending';
  return 'declined';
end;
$$;

-- Retire un ami, ou annule une demande envoyée.
create or replace function public.remove_friend(other uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.friendships
   where least(requester, addressee) = least((select auth.uid()), other)
     and greatest(requester, addressee) = greatest((select auth.uid()), other);
$$;

create or replace function public.block_user(other uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null or other = me then return; end if;
  delete from public.friendships
   where least(requester, addressee) = least(me, other) and greatest(requester, addressee) = greatest(me, other);
  insert into public.blocks (blocker, blocked) values (me, other) on conflict do nothing;
end;
$$;

create or replace function public.unblock_user(other uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.blocks where blocker = (select auth.uid()) and blocked = other;
$$;

-- Signaler une personne (et éventuellement un message). 20 signalements par jour au plus.
create or replace function public.report_user(other uuid, reason text, message uuid default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null or other = me then return 'invalid'; end if;
  if (select count(*) from public.reports where reporter = me and created_at > now() - interval '1 day') >= 20 then
    return 'rate_limited';
  end if;
  insert into public.reports (reporter, target, message_id, reason) values (me, other, message, left(trim(reason), 500));
  return 'ok';
end;
$$;

-- ---------- Messagerie ----------

-- Ouvre (ou retrouve) la conversation à deux avec cette personne. Null si l'un a bloqué l'autre.
create or replace function public.open_direct_conversation(other uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  key text;
  conv uuid;
begin
  if me is null or other is null or other = me then return null; end if;
  if not exists (select 1 from public.profiles where id = other) then return null; end if;
  if private.is_blocked_between(me, other) then return null; end if;
  key := least(me, other)::text || ':' || greatest(me, other)::text;
  select id into conv from public.conversations where pair_key = key;
  if conv is null then
    insert into public.conversations (pair_key) values (key)
      on conflict (pair_key) do update set pair_key = excluded.pair_key
      returning id into conv;
    -- Entre amis, la conversation est tout de suite dans « Messages » ; sinon elle arrivera
    -- chez l'autre dans « Demandes ».
    insert into public.conversation_members (conversation_id, user_id, state)
      values (conv, me, 'active'),
             (conv, other, case when private.are_friends(me, other) then 'active' else 'request' end)
      on conflict do nothing;
  else
    update public.conversation_members set state = 'active' where conversation_id = conv and user_id = me;
  end if;
  return conv;
end;
$$;

-- Envoie un message. Renvoie l'id du message, ou lève une erreur claire.
create or replace function public.send_message(p_conversation uuid, p_body text, p_kind text default 'text', p_meta jsonb default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  other uuid;
  msg uuid;
  clean text := trim(coalesce(p_body, ''));
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from public.conversation_members where conversation_id = p_conversation and user_id = me) then
    raise exception 'not_member';
  end if;
  if p_kind not in ('text', 'invite') then raise exception 'invalid_kind'; end if;
  if p_kind = 'text' and (char_length(clean) = 0 or char_length(clean) > 1000) then raise exception 'invalid_body'; end if;
  if p_kind = 'invite' and (p_meta is null or coalesce(p_meta ->> 'code', '') !~ '^[A-Z]{4}$') then raise exception 'invalid_invite'; end if;
  -- Personne de bloqué dans la conversation.
  if exists (
    select 1 from public.conversation_members m
     where m.conversation_id = p_conversation and m.user_id <> me and private.is_blocked_between(me, m.user_id)
  ) then
    raise exception 'blocked';
  end if;
  -- Anti-spam : 20 messages par minute au plus.
  if (select count(*) from public.messages where sender_id = me and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'rate_limited';
  end if;

  insert into public.messages (conversation_id, sender_id, kind, body, meta)
    values (p_conversation, me, p_kind, case when p_kind = 'text' then clean else '' end,
            case when p_kind = 'invite' then jsonb_build_object(
              'game', coalesce(p_meta ->> 'game', 'domino'),
              'code', p_meta ->> 'code',
              'players', coalesce((p_meta ->> 'players')::int, 4),
              'free', coalesce((p_meta ->> 'free')::int, 0)) end)
    returning id into msg;
  update public.conversations set last_message_at = now() where id = p_conversation;
  update public.conversation_members set last_read_at = now() where conversation_id = p_conversation and user_id = me;
  -- Si j'écris dans une demande reçue, je l'accepte.
  update public.conversation_members set state = 'active' where conversation_id = p_conversation and user_id = me and state = 'request';
  return msg;
end;
$$;

create or replace function public.mark_conversation_read(p_conversation uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.conversation_members set last_read_at = now()
   where conversation_id = p_conversation and user_id = (select auth.uid());
$$;

-- Accepter ('active') ou supprimer ('declined') une demande de message.
create or replace function public.set_conversation_state(p_conversation uuid, p_state text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_state not in ('active', 'declined') then raise exception 'invalid_state'; end if;
  update public.conversation_members set state = p_state
   where conversation_id = p_conversation and user_id = (select auth.uid());
end;
$$;

-- Mes conversations, avec l'autre personne, le dernier message et le nombre de non-lus.
create or replace function public.my_conversations()
returns table (
  conversation_id uuid,
  state text,
  other_id uuid,
  other_username text,
  last_body text,
  last_kind text,
  last_sender uuid,
  last_at timestamptz,
  unread integer,
  other_read_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id,
         mine.state,
         o.user_id,
         p.username,
         lm.body,
         lm.kind,
         lm.sender_id,
         coalesce(lm.created_at, c.created_at),
         (select count(*)::int from public.messages m
           where m.conversation_id = c.id and m.sender_id <> mine.user_id and m.created_at > mine.last_read_at
             and not exists (select 1 from public.blocks b where b.blocker = mine.user_id and b.blocked = m.sender_id)),
         o.last_read_at
    from public.conversation_members mine
    join public.conversations c on c.id = mine.conversation_id
    join public.conversation_members o on o.conversation_id = c.id and o.user_id <> mine.user_id
    join public.profiles p on p.id = o.user_id
    left join lateral (
      select m.body, m.kind, m.sender_id, m.created_at from public.messages m
       where m.conversation_id = c.id
       order by m.created_at desc limit 1
    ) lm on true
   where mine.user_id = (select auth.uid())
     and mine.state <> 'declined'
     and not exists (select 1 from public.blocks b where b.blocker = mine.user_id and b.blocked = o.user_id)
     -- Une demande vide (aucun message) n'apparaît pas encore chez l'autre.
     and (mine.state = 'active' or lm.created_at is not null)
   order by coalesce(lm.created_at, c.created_at) desc;
$$;

-- Mes amis et demandes, avec les pseudos.
create or replace function public.my_friends()
returns table (other_id uuid, username text, status text, incoming boolean, since timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select case when f.requester = (select auth.uid()) then f.addressee else f.requester end,
         p.username,
         f.status,
         f.addressee = (select auth.uid()) and f.status = 'pending',
         coalesce(f.accepted_at, f.created_at)
    from public.friendships f
    join public.profiles p on p.id = case when f.requester = (select auth.uid()) then f.addressee else f.requester end
   where (select auth.uid()) in (f.requester, f.addressee)
   order by p.username;
$$;

-- Droits : seules les personnes connectées appellent ces fonctions.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.send_friend_request(text)',
    'public.respond_friend_request(uuid, boolean)',
    'public.remove_friend(uuid)',
    'public.block_user(uuid)',
    'public.unblock_user(uuid)',
    'public.report_user(uuid, text, uuid)',
    'public.open_direct_conversation(uuid)',
    'public.send_message(uuid, text, text, jsonb)',
    'public.mark_conversation_read(uuid)',
    'public.set_conversation_state(uuid, text)',
    'public.my_conversations()',
    'public.my_friends()'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;
revoke all on function private.is_blocked_between(uuid, uuid) from public, anon, authenticated;
revoke all on function private.are_friends(uuid, uuid) from public, anon, authenticated;

-- Temps réel : nouveaux messages, demandes d'amis et accusés de lecture.
alter publication supabase_realtime add table public.messages, public.friendships, public.conversation_members;
