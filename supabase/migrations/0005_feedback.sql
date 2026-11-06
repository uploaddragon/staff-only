-- 0005: 사용해 본 뒤 수정사항
-- - 가입 후 점주/알바 선택 (첫 화면 안내용. 실제 권한은 매장별 store_members.role)
-- - 구글·카카오 가입 대응 (이름이 길거나 이메일이 없어도 프로필이 만들어지게)
-- - 매대·상품 메모
-- - 유통기한 지난 상품의 "폐기함" 처리

-- ── 프로필: 가입 유형 ───────────────────────────────────
alter table public.profiles
  add column user_type text check (user_type in ('owner', 'staff'));

-- 소셜 로그인은 이름이 metadata의 여러 키로 오고, 카카오는 이메일이 없을 수 있어요.
-- 이름은 20자로 자르고, 아무것도 없으면 '사용자'로 만들어요.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'nickname'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'preferred_username'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    '사용자'
  );
  insert into public.profiles (id, display_name) values (new.id, left(v_name, 20));
  return new;
end;
$$;

-- ── 메모 ────────────────────────────────────────────
alter table public.categories
  add column memo text check (char_length(memo) <= 500);
alter table public.products
  add column memo text check (char_length(memo) <= 200);

-- 매대 메모는 점주뿐 아니라 담당자도 쓸 수 있어요 (카테고리 수정 권한은 점주만이라 함수로 열어요)
create function public.set_category_memo(p_category_id uuid, p_memo text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.can_edit_category(p_category_id) then
    raise exception '이 매대의 담당자나 점주만 메모를 쓸 수 있어요';
  end if;
  update public.categories
  set memo = nullif(trim(coalesce(p_memo, '')), '')
  where id = p_category_id;
end;
$$;

-- ── 처리: 폐기 ─────────────────────────────────────────
alter table public.process_logs
  add column disposed boolean not null default false;

-- 매개변수가 늘어나서 기존 함수를 지우고 다시 만들어요 (p_disposed는 생략하면 false)
drop function public.process_product(uuid, date, boolean);

create function public.process_product(
  p_product_id uuid,
  p_new_expiry date,
  p_out_of_stock boolean,
  p_disposed boolean default false
)
returns public.process_logs
language plpgsql security definer set search_path = ''
as $$
declare
  v_product public.products;
  v_log public.process_logs;
begin
  select * into v_product from public.products where id = p_product_id for update;
  if v_product.id is null then
    raise exception '상품을 찾을 수 없어요';
  end if;
  if not public.can_edit_category(v_product.category_id) then
    raise exception '이 매대의 담당자나 점주만 처리할 수 있어요';
  end if;
  if p_out_of_stock and p_new_expiry is not null then
    raise exception '재고 없음이면 날짜를 비워 주세요';
  end if;
  if not p_out_of_stock and p_new_expiry is null then
    raise exception '다음 유통기한을 입력하거나 재고 없음을 선택해 주세요';
  end if;

  update public.products
  set earliest_expiry = p_new_expiry, out_of_stock = p_out_of_stock
  where id = p_product_id;

  insert into public.process_logs (
    store_id, category_id, product_id, product_name, category_name, zone_name,
    processed_by, old_expiry, new_expiry, out_of_stock, disposed
  )
  select v_product.store_id, v_product.category_id, v_product.id, v_product.name, c.name, z.name,
         auth.uid(), v_product.earliest_expiry, p_new_expiry, p_out_of_stock, coalesce(p_disposed, false)
  from public.categories c, public.zones z
  where c.id = v_product.category_id and z.id = v_product.zone_id
  returning * into v_log;

  return v_log;
end;
$$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
