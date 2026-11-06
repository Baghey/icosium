-- ICOSIUM étape 4 (deuxième partie) : groupes, réactions, messages vocaux, appels privés et
-- résultats de partie postés dans les conversations.
-- Même principe que la première partie : on lit grâce à la RLS, on écrit par des fonctions qui
-- vérifient tout (membres, amis, blocages, anti-spam).

-- ---------- Conversations de groupe ----------

alter table public.conversations
  add column kind text not null default 'direct' check (kind in ('direct', 'group')),
  add column title text check (title is null or char_length(title) between 1 and 40),
  add column created_by uuid references auth.users (id) on delete set null;
-- Une conversation à deux a toujours sa clé de paire ; un groupe n'en a jamais.
alter table public.conversations
  add constraint conversations_kind_pair check ((kind = 'direct') = (pair_key is not null));
create index conversations_created_by_idx on public.conversations (created_by);

-- ---------- Nouveaux genres de messages ----------
-- voice  : message vocal (meta : path, duration, peaks)
-- result : résultat d'une partie (meta : game, code, scores, winnerTeam, teams…), posté par le serveur
-- call   : trace d'un appel (meta : status, duration)
-- system : « X a créé le groupe », « X a ajouté Y », « X est parti »

alter table public.messages drop constraint messages_kind_check;
alter table public.messages
  add constraint messages_kind_check check (kind in ('text', 'invite', 'voice', 'result', 'call', 'system'));
alter table public.messages alter column sender_id drop not null;
alter table public.messages
  add constraint messages_sender_required check (sender_id is not null or kind in ('result', 'system'));

-- ---------- Réactions ----------

create table public.message_reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  emoji text not null check (emoji in ('❤️', '😂', '😮', '😢', '👍', '🔥')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
create index message_reactions_conversation_idx on public.message_reactions (conversation_id);
create index message_reactions_user_idx on public.message_reactions (user_id, created_at desc);

alter table public.message_reactions enable row level security;
create policy "Read reactions of my conversations" on public.message_reactions
  for select to authenticated using (public.is_conversation_member(conversation_id));

-- Une réaction par personne et par message ; le même emoji une deuxième fois la retire.
-- Renvoie l'emoji gardé, ou null s'il n'y en a plus.
create or replace function public.react_to_message(p_message uuid, p_emoji text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  conv uuid;
  current_emoji text;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  select m.conversation_id into conv from public.messages m where m.id = p_message;
  if conv is null or not exists (
    select 1 from public.conversation_members cm where cm.conversation_id = conv and cm.user_id = me
  ) then
    raise exception 'not_member';
  end if;
  select r.emoji into current_emoji from public.message_reactions r where r.message_id = p_message and r.user_id = me;
  if p_emoji is null or p_emoji = '' or p_emoji = current_emoji then
    delete from public.message_reactions where message_id = p_message and user_id = me;
    return null;
  end if;
  if p_emoji not in ('❤️', '😂', '😮', '😢', '👍', '🔥') then raise exception 'invalid_emoji'; end if;
  -- Anti-spam : 60 réactions par minute au plus.
  if (select count(*) from public.message_reactions where user_id = me and created_at > now() - interval '1 minute') >= 60 then
    raise exception 'rate_limited';
  end if;
  insert into public.message_reactions (message_id, user_id, conversation_id, emoji)
    values (p_message, me, conv, p_emoji)
    on conflict (message_id, user_id) do update set emoji = excluded.emoji, created_at = now();
  return p_emoji;
end;
$$;

-- ---------- Messages vocaux : fichiers audio à part, dans un espace privé ----------
-- Chemin d'un fichier : <conversation>/<auteur>/<id>.<ext>. 1 Mo au plus (60 s d'Opus ≈ 200 Ko).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('voice-notes', 'voice-notes', false, 1048576, array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/mpeg'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Est-ce que la personne connectée est membre de la conversation de ce fichier ?
-- (le premier dossier du chemin est l'id de la conversation ; un chemin bizarre est refusé).
create or replace function public.can_access_voice_note(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  conv uuid;
begin
  begin
    conv := split_part(object_name, '/', 1)::uuid;
  exception when others then
    return false;
  end;
  return exists (
    select 1 from public.conversation_members m where m.conversation_id = conv and m.user_id = (select auth.uid())
  );
end;
$$;

create policy "Members upload their own voice notes" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'voice-notes'
    and split_part(name, '/', 2) = (select auth.uid())::text
    and public.can_access_voice_note(name)
  );
create policy "Members listen to voice notes" on storage.objects
  for select to authenticated
  using (bucket_id = 'voice-notes' and public.can_access_voice_note(name));

-- ---------- Envoi de message : texte, invitation ou vocal ----------

create or replace function public.send_message(p_conversation uuid, p_body text, p_kind text default 'text', p_meta jsonb default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  conv_kind text;
  msg uuid;
  clean text := trim(coalesce(p_body, ''));
  clean_meta jsonb;
  voice_path text;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from public.conversation_members where conversation_id = p_conversation and user_id = me) then
    raise exception 'not_member';
  end if;
  select kind into conv_kind from public.conversations where id = p_conversation;
  if p_kind not in ('text', 'invite', 'voice') then raise exception 'invalid_kind'; end if;
  if p_kind = 'text' and (char_length(clean) = 0 or char_length(clean) > 1000) then raise exception 'invalid_body'; end if;

  if p_kind = 'invite' then
    if p_meta is null or coalesce(p_meta ->> 'code', '') !~ '^[A-Z]{4}$' then raise exception 'invalid_invite'; end if;
    clean_meta := jsonb_build_object(
      'game', 'domino',
      'code', p_meta ->> 'code',
      'players', least(4, greatest(2, coalesce((p_meta ->> 'players')::int, 4))),
      'free', least(3, greatest(0, coalesce((p_meta ->> 'free')::int, 0))));
  elsif p_kind = 'voice' then
    voice_path := coalesce(p_meta ->> 'path', '');
    -- Le fichier doit être dans le dossier de cette conversation, à mon nom, et exister.
    if voice_path !~ ('^' || p_conversation::text || '/' || me::text || '/[0-9a-f-]{36}\.(webm|ogg|m4a|mp4|aac|mp3)$')
       or not exists (select 1 from storage.objects o where o.bucket_id = 'voice-notes' and o.name = voice_path) then
      raise exception 'invalid_voice';
    end if;
    clean_meta := jsonb_build_object(
      'path', voice_path,
      'duration', round(least(60, greatest(0.5, coalesce((p_meta ->> 'duration')::numeric, 1))), 1),
      'peaks', coalesce((
        select jsonb_agg(least(100, greatest(0, round(v::numeric)))::int order by ord)
          from jsonb_array_elements_text(case when jsonb_typeof(p_meta -> 'peaks') = 'array' then p_meta -> 'peaks' else '[]'::jsonb end)
               with ordinality as a(v, ord)
         where ord <= 48 and v ~ '^[0-9]+(\.[0-9]+)?$'
      ), '[]'::jsonb));
  end if;

  -- À deux : personne de bloqué dans la conversation. En groupe, un blocage ne coupe pas tout le
  -- groupe : la RLS cache seulement les messages de la personne bloquée à celui qui l'a bloquée.
  if conv_kind = 'direct' and exists (
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
    values (p_conversation, me, p_kind, case when p_kind = 'text' then clean else '' end, clean_meta)
    returning id into msg;
  update public.conversations set last_message_at = now() where id = p_conversation;
  update public.conversation_members set last_read_at = now() where conversation_id = p_conversation and user_id = me;
  -- Si j'écris dans une demande reçue, je l'accepte.
  update public.conversation_members set state = 'active' where conversation_id = p_conversation and user_id = me and state = 'request';
  return msg;
end;
$$;

-- ---------- Groupes : créer, ajouter, quitter ----------

-- Message « système » dans un groupe (créé, ajouté, parti, renommé).
create or replace function private.post_system_message(p_conversation uuid, p_meta jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.messages (conversation_id, sender_id, kind, body, meta) values (p_conversation, null, 'system', '', p_meta);
  update public.conversations set last_message_at = now() where id = p_conversation;
$$;

create or replace function private.usernames(ids uuid[])
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(p.username order by p.username), '[]'::jsonb) from public.profiles p where p.id = any (ids);
$$;

-- Crée un groupe avec des amis (8 personnes au plus, moi compris). Renvoie son id.
create or replace function public.create_group(p_title text, p_members uuid[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  clean text := trim(coalesce(p_title, ''));
  others uuid[];
  conv uuid;
  m uuid;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if char_length(clean) < 1 or char_length(clean) > 40 then raise exception 'invalid_title'; end if;
  select coalesce(array_agg(distinct x), '{}') into others from unnest(coalesce(p_members, '{}')) as x where x <> me;
  if cardinality(others) < 1 or cardinality(others) > 7 then raise exception 'invalid_members'; end if;
  foreach m in array others loop
    if not private.are_friends(me, m) or private.is_blocked_between(me, m) then raise exception 'not_friends'; end if;
  end loop;
  -- Anti-spam : 10 groupes par jour au plus.
  if (select count(*) from public.conversations where created_by = me and kind = 'group' and created_at > now() - interval '1 day') >= 10 then
    raise exception 'rate_limited';
  end if;

  insert into public.conversations (kind, title, created_by) values ('group', clean, me) returning id into conv;
  insert into public.conversation_members (conversation_id, user_id, state)
    select conv, u, 'active' from unnest(others || me) as u;
  perform private.post_system_message(conv, jsonb_build_object('event', 'created', 'actor', me, 'actorName',
    (select username from public.profiles where id = me), 'title', clean));
  return conv;
end;
$$;

create or replace function public.add_group_members(p_conversation uuid, p_members uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  added uuid[];
  m uuid;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if not exists (
    select 1 from public.conversations c join public.conversation_members cm on cm.conversation_id = c.id
     where c.id = p_conversation and c.kind = 'group' and cm.user_id = me
  ) then
    raise exception 'not_member';
  end if;
  select coalesce(array_agg(distinct x), '{}') into added from unnest(coalesce(p_members, '{}')) as x
   where x <> me and not exists (select 1 from public.conversation_members cm where cm.conversation_id = p_conversation and cm.user_id = x);
  if cardinality(added) = 0 then return; end if;
  foreach m in array added loop
    if not private.are_friends(me, m) or private.is_blocked_between(me, m) then raise exception 'not_friends'; end if;
  end loop;
  if (select count(*) from public.conversation_members where conversation_id = p_conversation) + cardinality(added) > 8 then
    raise exception 'group_full';
  end if;
  insert into public.conversation_members (conversation_id, user_id, state)
    select p_conversation, u, 'active' from unnest(added) as u;
  perform private.post_system_message(p_conversation, jsonb_build_object('event', 'added', 'actor', me, 'actorName',
    (select username from public.profiles where id = me), 'names', private.usernames(added)));
end;
$$;

create or replace function public.leave_group(p_conversation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then raise exception 'not_signed_in'; end if;
  delete from public.conversation_members cm
   using public.conversations c
   where cm.conversation_id = p_conversation and cm.user_id = me and c.id = cm.conversation_id and c.kind = 'group';
  if not found then return; end if;
  if not exists (select 1 from public.conversation_members where conversation_id = p_conversation) then
    delete from public.conversations where id = p_conversation;
  else
    perform private.post_system_message(p_conversation, jsonb_build_object('event', 'left', 'actor', me, 'actorName',
      (select username from public.profiles where id = me)));
  end if;
end;
$$;

-- ---------- Liste des conversations (à deux et en groupe) ----------

drop function public.my_conversations();
create function public.my_conversations()
returns table (
  conversation_id uuid,
  kind text,
  title text,
  state text,
  other_id uuid,
  other_username text,
  members jsonb,
  last_body text,
  last_kind text,
  last_sender uuid,
  last_sender_name text,
  last_meta jsonb,
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
         c.kind,
         c.title,
         mine.state,
         o.user_id,
         o.username,
         coalesce(mem.list, '[]'::jsonb),
         lm.body,
         lm.kind,
         lm.sender_id,
         lp.username,
         case when lm.kind in ('call', 'system', 'result') then lm.meta end,
         coalesce(lm.created_at, c.created_at),
         (select count(*)::int from public.messages m
           where m.conversation_id = c.id and m.sender_id is distinct from mine.user_id and m.kind <> 'system'
             and m.created_at > mine.last_read_at
             and not exists (select 1 from public.blocks b where b.blocker = mine.user_id and b.blocked = m.sender_id)),
         coalesce(o.last_read_at, mem.max_read, c.created_at)
    from public.conversation_members mine
    join public.conversations c on c.id = mine.conversation_id
    left join lateral (
      select om.user_id, om.last_read_at, p.username
        from public.conversation_members om join public.profiles p on p.id = om.user_id
       where c.kind = 'direct' and om.conversation_id = c.id and om.user_id <> mine.user_id
       limit 1
    ) o on true
    left join lateral (
      select jsonb_agg(jsonb_build_object('id', om.user_id, 'username', p.username) order by p.username) as list,
             max(om.last_read_at) as max_read
        from public.conversation_members om join public.profiles p on p.id = om.user_id
       where om.conversation_id = c.id and om.user_id <> mine.user_id
    ) mem on true
    left join lateral (
      select m.body, m.kind, m.sender_id, m.meta, m.created_at from public.messages m
       where m.conversation_id = c.id
         and not exists (select 1 from public.blocks b where b.blocker = mine.user_id and b.blocked = m.sender_id)
       order by m.created_at desc limit 1
    ) lm on true
    left join public.profiles lp on lp.id = lm.sender_id
   where mine.user_id = (select auth.uid())
     and mine.state <> 'declined'
     and (c.kind = 'group'
          or (o.user_id is not null
              and not exists (select 1 from public.blocks b where b.blocker = mine.user_id and b.blocked = o.user_id)))
     -- Une demande vide (aucun message) n'apparaît pas encore chez l'autre.
     and (mine.state = 'active' or lm.created_at is not null)
   order by coalesce(lm.created_at, c.created_at) desc;
$$;

-- ---------- Appels vocaux privés entre amis ----------

create table public.calls (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  caller uuid not null references auth.users (id) on delete cascade,
  callee uuid not null references auth.users (id) on delete cascade,
  status text not null default 'ringing' check (status in ('ringing', 'active', 'declined', 'missed', 'ended')),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz,
  check (caller <> callee)
);
create index calls_conversation_idx on public.calls (conversation_id);
create index calls_caller_idx on public.calls (caller, created_at desc);
create index calls_callee_idx on public.calls (callee, created_at desc);

alter table public.calls enable row level security;
create policy "Read my calls" on public.calls
  for select to authenticated using ((select auth.uid()) in (caller, callee));

-- Termine un appel et laisse sa trace dans la conversation (appel manqué, refusé ou durée).
create or replace function private.finish_call(p_call uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.calls%rowtype;
begin
  update public.calls set status = p_status, ended_at = now()
   where id = p_call and status in ('ringing', 'active')
   returning * into c;
  if not found then return; end if;
  insert into public.messages (conversation_id, sender_id, kind, body, meta)
    values (c.conversation_id, c.caller, 'call', '', jsonb_build_object(
      'status', p_status,
      'duration', case when c.answered_at is null then 0 else greatest(0, extract(epoch from (now() - c.answered_at))::int) end));
  update public.conversations set last_message_at = now() where id = c.conversation_id;
end;
$$;

-- Les appels oubliés (personne n'a répondu, ou l'appli a été fermée) se terminent tout seuls.
create or replace function private.expire_calls(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  stale uuid;
begin
  for stale in
    select id from public.calls
     where p_user in (caller, callee)
       and ((status = 'ringing' and created_at < now() - interval '45 seconds')
         or (status = 'active' and answered_at < now() - interval '3 hours'))
  loop
    perform private.finish_call(stale, case when (select status from public.calls where id = stale) = 'ringing' then 'missed' else 'ended' end);
  end loop;
end;
$$;

-- Appelle l'autre personne d'une conversation à deux (amis seulement). Renvoie l'id de l'appel.
create or replace function public.start_call(p_conversation uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  other uuid;
  live uuid;
  call_id uuid;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  select o.user_id into other
    from public.conversations c
    join public.conversation_members mine on mine.conversation_id = c.id and mine.user_id = me
    join public.conversation_members o on o.conversation_id = c.id and o.user_id <> me
   where c.id = p_conversation and c.kind = 'direct';
  if other is null then raise exception 'not_member'; end if;
  if not private.are_friends(me, other) or private.is_blocked_between(me, other) then raise exception 'not_friends'; end if;
  -- Anti-spam : 10 appels par 10 minutes au plus.
  if (select count(*) from public.calls where caller = me and created_at > now() - interval '10 minutes') >= 10 then
    raise exception 'rate_limited';
  end if;
  perform private.expire_calls(me);
  perform private.expire_calls(other);
  -- Un appel à la fois : je raccroche mes appels en cours ; si l'autre est déjà en ligne, c'est occupé.
  for live in select id from public.calls where me in (caller, callee) and status in ('ringing', 'active') loop
    perform private.finish_call(live, case when (select status from public.calls where id = live) = 'ringing' then 'missed' else 'ended' end);
  end loop;
  if exists (select 1 from public.calls where other in (caller, callee) and status in ('ringing', 'active')) then
    raise exception 'busy';
  end if;
  insert into public.calls (conversation_id, caller, callee) values (p_conversation, me, other) returning id into call_id;
  return call_id;
end;
$$;

-- Répondre (true) ou refuser (false). Renvoie 'active', 'declined' ou 'gone' (appel fini entre-temps).
create or replace function public.answer_call(p_call uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then raise exception 'not_signed_in'; end if;
  perform private.expire_calls(me);
  if not exists (select 1 from public.calls where id = p_call and callee = me and status = 'ringing') then
    return 'gone';
  end if;
  if p_accept then
    update public.calls set status = 'active', answered_at = now() where id = p_call;
    return 'active';
  end if;
  perform private.finish_call(p_call, 'declined');
  return 'declined';
end;
$$;

-- Raccrocher (l'un ou l'autre). Si ça sonnait encore : appel manqué.
create or replace function public.end_call(p_call uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  current_status text;
begin
  select status into current_status from public.calls where id = p_call and me in (caller, callee);
  if current_status = 'ringing' then
    perform private.finish_call(p_call, case when (select callee from public.calls where id = p_call) = me then 'declined' else 'missed' end);
  elsif current_status = 'active' then
    perform private.finish_call(p_call, 'ended');
  end if;
end;
$$;

-- Le serveur vocal demande : cette personne a-t-elle le droit d'entrer dans le salon de cet appel ?
create or replace function public.can_join_call(p_call uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.calls
     where id = p_call and (select auth.uid()) in (caller, callee) and status = 'active'
  );
$$;

-- ---------- Résultat d'une partie, posté automatiquement ----------
-- Quand une table passe à « finished », le résultat (vainqueurs et score) est posté dans chaque
-- groupe dont tous les joueurs humains font partie, et dans la conversation à deux s'ils sont deux.

create or replace function private.post_domino_result()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  humans uuid[];
  v jsonb;
  meta jsonb;
  conv uuid;
  seat_count int;
begin
  if new.status <> 'finished' or old.status = 'finished' then return new; end if;
  select array_agg(s.user_id order by s.seat) filter (where s.user_id is not null), count(*)
    into humans, seat_count
    from public.domino_seats s where s.table_id = new.id;
  if coalesce(cardinality(humans), 0) < 2 then return new; end if;
  select st.view into v from public.domino_states st where st.table_id = new.id;
  if v is null or v -> 'winnerTeam' is null or jsonb_typeof(v -> 'winnerTeam') <> 'number' then return new; end if;

  meta := jsonb_build_object(
    'game', 'domino',
    'code', new.code,
    'players', seat_count,
    'scores', v -> 'scores',
    'winnerTeam', (v ->> 'winnerTeam')::int,
    'target', v -> 'options' -> 'targetScore',
    'teams', jsonb_build_array(
      (select coalesce(jsonb_agg(jsonb_build_object('id', s.user_id, 'name', s.username, 'bot', s.is_bot) order by s.seat), '[]'::jsonb)
         from public.domino_seats s where s.table_id = new.id and s.seat % 2 = 0),
      (select coalesce(jsonb_agg(jsonb_build_object('id', s.user_id, 'name', s.username, 'bot', s.is_bot) order by s.seat), '[]'::jsonb)
         from public.domino_seats s where s.table_id = new.id and s.seat % 2 = 1)));

  for conv in
    select c.id from public.conversations c
     where (c.kind = 'group'
            and not exists (
              select 1 from unnest(humans) as h(uid)
               where not exists (select 1 from public.conversation_members cm where cm.conversation_id = c.id and cm.user_id = h.uid)))
        or (cardinality(humans) = 2 and c.kind = 'direct'
            and c.pair_key = least(humans[1], humans[2])::text || ':' || greatest(humans[1], humans[2])::text)
  loop
    insert into public.messages (conversation_id, sender_id, kind, body, meta) values (conv, null, 'result', '', meta);
    update public.conversations set last_message_at = now() where id = conv;
  end loop;
  return new;
end;
$$;

create trigger domino_result_posted
  after update of status on public.domino_tables
  for each row execute function private.post_domino_result();

-- ---------- Droits ----------

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.react_to_message(uuid, text)',
    'public.send_message(uuid, text, text, jsonb)',
    'public.create_group(text, uuid[])',
    'public.add_group_members(uuid, uuid[])',
    'public.leave_group(uuid)',
    'public.my_conversations()',
    'public.start_call(uuid)',
    'public.answer_call(uuid, boolean)',
    'public.end_call(uuid)',
    'public.can_join_call(uuid)',
    'public.can_access_voice_note(text)'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;
revoke all on function private.post_system_message(uuid, jsonb) from public, anon, authenticated;
revoke all on function private.usernames(uuid[]) from public, anon, authenticated;
revoke all on function private.finish_call(uuid, text) from public, anon, authenticated;
revoke all on function private.expire_calls(uuid) from public, anon, authenticated;
revoke all on function private.post_domino_result() from public, anon, authenticated;

-- Temps réel : réactions et appels.
alter publication supabase_realtime add table public.message_reactions, public.calls;
