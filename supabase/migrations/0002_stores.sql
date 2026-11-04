-- 0002: 매장, 매장 멤버(입장 요청·승인), 근무 요일
--
-- 원칙
-- - 같은 매장의 승인된(approved) 멤버만 그 매장 데이터를 읽을 수 있어요.
-- - 상태를 바꾸는 작업(개설, 입장 요청, 승인, 해제, 근무 요일)은 전부 아래 함수(RPC)로만 해요.
--   테이블에 insert/update/delete 정책이 없어서 클라이언트가 직접 고칠 수 없어요.

-- ── 테이블 ─────────────────────────────────────────────

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 30),
  owner_id uuid not null references public.profiles (id),
  invite_code text not null unique check (invite_code ~ '^[0-9]{6}$'),
  created_at timestamptz not null default now()
);

create table public.store_members (
  store_id uuid not null references public.stores (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'staff' check (role in ('owner', 'staff')),
  -- pending: 승인 대기 / approved: 승인 / rejected: 거절 / removed: 접근 해제(퇴사)
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'removed')),
  -- 근무 요일: 0=일 1=월 … 6=토
  work_days smallint[] not null default '{}' check (work_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  primary key (store_id, user_id)
);

create index store_members_user_id_idx on public.store_members (user_id);

alter table public.stores enable row level security;
alter table public.store_members enable row level security;

-- ── 권한 확인 함수 (RLS 정책에서 같이 써요) ──────────────────

create function public.is_store_member(p_store_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.store_members
    where store_id = p_store_id and user_id = auth.uid() and status = 'approved'
  );
$$;

create function public.is_store_owner(p_store_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.store_members
    where store_id = p_store_id and user_id = auth.uid() and status = 'approved' and role = 'owner'
  );
$$;

-- 내가 이 사람의 프로필(이름)을 볼 수 있나?
-- 같은 매장의 승인 멤버끼리는 서로 볼 수 있고(퇴사자 이름도 히스토리용으로 보여요),
-- 점주는 입장 요청한 사람의 이름도 볼 수 있어요.
create function public.can_view_profile(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.store_members me
    join public.store_members them on them.store_id = me.store_id
    where me.user_id = auth.uid()
      and me.status = 'approved'
      and them.user_id = p_user_id
      and (them.status in ('approved', 'removed') or me.role = 'owner')
  );
$$;

-- ── RLS 정책 ──────────────────────────────────────────

create policy "멤버는 매장 정보 읽기"
  on public.stores for select
  to authenticated
  using (public.is_store_member(id));

create policy "본인 멤버십, 같은 매장 멤버, 점주는 전체 읽기"
  on public.store_members for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_store_owner(store_id)
    or (status = 'approved' and public.is_store_member(store_id))
  );

create policy "같은 매장 멤버 프로필 읽기"
  on public.profiles for select
  to authenticated
  using (public.can_view_profile(id));

-- ── RPC 함수 ─────────────────────────────────────────

-- 겹치지 않는 6자리 숫자 초대코드
create function public.generate_invite_code()
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_code text;
begin
  loop
    v_code := lpad(floor(random() * 1000000)::int::text, 6, '0');
    exit when not exists (select 1 from public.stores where invite_code = v_code);
  end loop;
  return v_code;
end;
$$;

-- 매장 개설: 만든 사람이 점주(approved)가 돼요
create function public.create_store(p_name text)
returns public.stores
language plpgsql security definer set search_path = ''
as $$
declare
  v_store public.stores;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요해요';
  end if;
  if char_length(trim(coalesce(p_name, ''))) = 0 then
    raise exception '매장 이름을 입력해 주세요';
  end if;

  insert into public.stores (name, owner_id, invite_code)
  values (trim(p_name), auth.uid(), public.generate_invite_code())
  returning * into v_store;

  insert into public.store_members (store_id, user_id, role, status, decided_at)
  values (v_store.id, auth.uid(), 'owner', 'approved', now());

  return v_store;
end;
$$;

-- 초대코드로 매장 이름 확인 (승인 전이라 stores 테이블을 직접 못 읽어요)
create function public.lookup_store_by_code(p_code text)
returns table (store_id uuid, store_name text)
language sql stable security definer set search_path = ''
as $$
  select id, name from public.stores
  where invite_code = p_code and auth.uid() is not null;
$$;

-- 입장 요청: 거절·해제됐던 사람은 다시 요청할 수 있어요
create function public.request_join(p_code text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_store_id uuid;
  v_status text;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요해요';
  end if;

  select id into v_store_id from public.stores where invite_code = p_code;
  if v_store_id is null then
    raise exception '초대코드에 맞는 매장이 없어요';
  end if;

  select status into v_status from public.store_members
  where store_id = v_store_id and user_id = auth.uid();

  if v_status = 'approved' then
    raise exception '이미 이 매장의 멤버예요';
  elsif v_status = 'pending' then
    return v_store_id;
  elsif v_status is not null then
    update public.store_members
    set status = 'pending', requested_at = now(), decided_at = null
    where store_id = v_store_id and user_id = auth.uid();
  else
    insert into public.store_members (store_id, user_id) values (v_store_id, auth.uid());
  end if;

  return v_store_id;
end;
$$;

-- 내 입장 요청 취소
create function public.cancel_join_request(p_store_id uuid)
returns void
language sql security definer set search_path = ''
as $$
  delete from public.store_members
  where store_id = p_store_id and user_id = auth.uid() and status = 'pending';
$$;

-- 점주: 입장 요청 승인/거절
create function public.decide_join_request(p_store_id uuid, p_user_id uuid, p_approve boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_store_owner(p_store_id) then
    raise exception '점주만 할 수 있어요';
  end if;

  update public.store_members
  set status = case when p_approve then 'approved' else 'rejected' end,
      decided_at = now()
  where store_id = p_store_id and user_id = p_user_id and status = 'pending';

  if not found then
    raise exception '처리할 입장 요청이 없어요';
  end if;
end;
$$;

-- 점주: 퇴사자 접근 해제
create function public.remove_member(p_store_id uuid, p_user_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_store_owner(p_store_id) then
    raise exception '점주만 할 수 있어요';
  end if;

  update public.store_members
  set status = 'removed', decided_at = now()
  where store_id = p_store_id and user_id = p_user_id and role = 'staff' and status = 'approved';

  if not found then
    raise exception '해제할 수 있는 직원이 아니에요';
  end if;
end;
$$;

-- 점주: 초대코드 새로 발급 (기존 코드는 더 이상 안 돼요)
create function public.regenerate_invite_code(p_store_id uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_code text;
begin
  if not public.is_store_owner(p_store_id) then
    raise exception '점주만 할 수 있어요';
  end if;

  v_code := public.generate_invite_code();
  update public.stores set invite_code = v_code where id = p_store_id;
  return v_code;
end;
$$;

-- 내 근무 요일 저장
create function public.set_work_days(p_store_id uuid, p_days smallint[])
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.store_members
  set work_days = (
    select coalesce(array_agg(distinct d order by d), '{}')
    from unnest(coalesce(p_days, '{}')) as d
  )
  where store_id = p_store_id and user_id = auth.uid() and status = 'approved';

  if not found then
    raise exception '승인된 매장 멤버만 근무 요일을 설정할 수 있어요';
  end if;
end;
$$;

-- 내 매장 목록 (승인 대기 중인 매장 이름도 보여줘요). 초대코드는 점주에게만.
create function public.my_memberships()
returns table (
  store_id uuid,
  store_name text,
  invite_code text,
  role text,
  status text,
  work_days smallint[]
)
language sql stable security definer set search_path = ''
as $$
  select m.store_id, s.name,
         case when m.role = 'owner' then s.invite_code end,
         m.role, m.status, m.work_days
  from public.store_members m
  join public.stores s on s.id = m.store_id
  where m.user_id = auth.uid() and m.status <> 'removed'
  order by m.requested_at;
$$;

-- ── 함수 실행 권한: 로그인한 사용자만 ─────────────────────
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
