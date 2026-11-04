-- 0003: 매대 구조(카테고리 > 구역)와 상품
--
-- 권한
-- - 읽기: 같은 매장의 승인 멤버 모두
-- - 카테고리 만들기·수정·삭제, 구역 추가·삭제: 점주
-- - 상품 등록·수정·삭제, 구역 "등록 완료" 표시: 점주 또는 그 카테고리 담당자

-- ── 테이블 ─────────────────────────────────────────────

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 30),
  -- 임박 기준일: 유통기한 − warn_days 가 되는 날 빼요
  warn_days int not null default 30 check (warn_days between 1 and 365),
  assignee_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (id, store_id)
);

create table public.zones (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  category_id uuid not null,
  name text not null check (char_length(trim(name)) between 1 and 10),
  sort_order int not null default 0,
  -- 첫 등록 진행률용: 이 구역 상품을 다 등록했는지
  setup_done boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (category_id, store_id) references public.categories (id, store_id) on delete cascade,
  unique (category_id, name),
  unique (id, category_id, store_id)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  category_id uuid not null,
  zone_id uuid not null,
  name text not null check (char_length(trim(name)) between 1 and 40),
  -- 매대에 남은 것 중 가장 빠른 유통기한. 재고 없음이면 비워 둬요.
  earliest_expiry date,
  out_of_stock boolean not null default false,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  -- 구역·카테고리·매장이 항상 서로 맞도록 묶어요
  foreign key (zone_id, category_id, store_id) references public.zones (id, category_id, store_id) on delete cascade,
  check (out_of_stock = (earliest_expiry is null))
);

create index categories_store_id_idx on public.categories (store_id);
create index zones_category_id_idx on public.zones (category_id);
create index products_category_expiry_idx on public.products (category_id, earliest_expiry);
create index products_store_expiry_idx on public.products (store_id, earliest_expiry);

alter table public.categories enable row level security;
alter table public.zones enable row level security;
alter table public.products enable row level security;

-- ── 자동 처리 트리거 ───────────────────────────────────────

-- 상품을 고친 사람·시각을 서버가 기록해요 (클라이언트 값은 무시)
create function public.stamp_product()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

create trigger products_stamp
  before insert or update on public.products
  for each row execute function public.stamp_product();

-- 담당자는 그 매장의 승인 멤버만 지정할 수 있어요
create function public.check_category_assignee()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.assignee_id is not null and not exists (
    select 1 from public.store_members
    where store_id = new.store_id and user_id = new.assignee_id and status = 'approved'
  ) then
    raise exception '승인된 매장 멤버만 담당자로 지정할 수 있어요';
  end if;
  return new;
end;
$$;

create trigger categories_check_assignee
  before insert or update of assignee_id on public.categories
  for each row execute function public.check_category_assignee();

-- ── 권한 확인 함수 ───────────────────────────────────────

-- 이 카테고리의 상품을 고칠 수 있나? (점주 또는 담당자)
create function public.can_edit_category(p_category_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.categories c
    where c.id = p_category_id
      and (
        public.is_store_owner(c.store_id)
        or (c.assignee_id = auth.uid() and public.is_store_member(c.store_id))
      )
  );
$$;

-- ── RLS 정책 ──────────────────────────────────────────

create policy "멤버는 카테고리 읽기" on public.categories for select
  to authenticated using (public.is_store_member(store_id));
create policy "점주는 카테고리 추가" on public.categories for insert
  to authenticated with check (public.is_store_owner(store_id));
create policy "점주는 카테고리 수정" on public.categories for update
  to authenticated using (public.is_store_owner(store_id)) with check (public.is_store_owner(store_id));
create policy "점주는 카테고리 삭제" on public.categories for delete
  to authenticated using (public.is_store_owner(store_id));

create policy "멤버는 구역 읽기" on public.zones for select
  to authenticated using (public.is_store_member(store_id));
create policy "점주는 구역 추가" on public.zones for insert
  to authenticated with check (public.is_store_owner(store_id));
create policy "점주·담당자는 구역 수정" on public.zones for update
  to authenticated using (public.can_edit_category(category_id)) with check (public.can_edit_category(category_id));
create policy "점주는 구역 삭제" on public.zones for delete
  to authenticated using (public.is_store_owner(store_id));

create policy "멤버는 상품 읽기" on public.products for select
  to authenticated using (public.is_store_member(store_id));
create policy "점주·담당자는 상품 추가" on public.products for insert
  to authenticated with check (public.can_edit_category(category_id));
create policy "점주·담당자는 상품 수정" on public.products for update
  to authenticated using (public.can_edit_category(category_id)) with check (public.can_edit_category(category_id));
create policy "점주·담당자는 상품 삭제" on public.products for delete
  to authenticated using (public.can_edit_category(category_id));

-- ── 퇴사 처리 시 담당자도 비워요 (점주 화면에 "담당자 없음" 경고가 떠요) ──

create or replace function public.remove_member(p_store_id uuid, p_user_id uuid)
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

  update public.categories set assignee_id = null
  where store_id = p_store_id and assignee_id = p_user_id;
end;
$$;

-- ── 함수 실행 권한 ────────────────────────────────────────
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
