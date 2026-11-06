-- 0006: 공지와 확인(읽음) 기록
--
-- - 공지 작성·수정·삭제: 점주
-- - 읽기: 같은 매장 승인 멤버
-- - 확인 기록: 본인 것만 남길 수 있고(함수), 점주는 누가 확인했는지 볼 수 있어요
-- - 알바는 다른 사람의 확인 여부 대신 "확인 N/M명" 숫자만 봐요

create table public.notices (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null default auth.uid(),
  title text not null check (char_length(trim(title)) between 1 and 60),
  body text not null default '' check (char_length(body) <= 2000),
  -- 필독: 알바가 '확인했어요'를 누를 때까지 홈에 배너로 남아요
  is_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notices_store_time_idx on public.notices (store_id, created_at desc);

create table public.notice_reads (
  notice_id uuid not null references public.notices (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notice_id, user_id)
);

create index notice_reads_store_idx on public.notice_reads (store_id);

alter table public.notices enable row level security;
alter table public.notice_reads enable row level security;

-- 수정 시각은 서버가 기록해요
create function public.touch_notice()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger notices_touch
  before update on public.notices
  for each row execute function public.touch_notice();

-- ── RLS ──────────────────────────────────────────────

create policy "멤버는 공지 읽기" on public.notices for select
  to authenticated using (public.is_store_member(store_id));
create policy "점주는 공지 작성" on public.notices for insert
  to authenticated with check (public.is_store_owner(store_id) and author_id = auth.uid());
create policy "점주는 공지 수정" on public.notices for update
  to authenticated using (public.is_store_owner(store_id)) with check (public.is_store_owner(store_id));
create policy "점주는 공지 삭제" on public.notices for delete
  to authenticated using (public.is_store_owner(store_id));

create policy "본인 확인 기록, 점주는 전체 읽기" on public.notice_reads for select
  to authenticated using (user_id = auth.uid() or public.is_store_owner(store_id));

-- ── 함수 ─────────────────────────────────────────────

-- '확인했어요'
create function public.mark_notice_read(p_notice_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_store_id uuid;
begin
  select store_id into v_store_id from public.notices where id = p_notice_id;
  if v_store_id is null or not public.is_store_member(v_store_id) then
    raise exception '공지를 찾을 수 없어요';
  end if;
  insert into public.notice_reads (notice_id, user_id, store_id)
  values (p_notice_id, auth.uid(), v_store_id)
  on conflict (notice_id, user_id) do nothing;
end;
$$;

-- 공지별 확인 인원: 대상은 지금 승인된 직원(점주 제외)
create function public.notice_read_summary(p_store_id uuid)
returns table (notice_id uuid, read_count int, target_count int)
language sql stable security definer set search_path = ''
as $$
  with staff as (
    select user_id from public.store_members
    where store_id = p_store_id and status = 'approved' and role = 'staff'
  )
  select n.id,
         (select count(*)::int from public.notice_reads r
          where r.notice_id = n.id and r.user_id in (select user_id from staff)),
         (select count(*)::int from staff)
  from public.notices n
  where n.store_id = p_store_id and public.is_store_member(p_store_id);
$$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
