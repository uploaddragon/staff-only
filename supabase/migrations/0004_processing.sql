-- 0004: 처리(빼두기 완료 → 다음 날짜 / 재고 없음)와 히스토리
--
-- 처리는 process_product 함수 하나로만 해요.
-- 상품 갱신과 히스토리 기록이 한 번에 저장돼서, 둘 중 하나만 남는 일이 없어요.

create table public.process_logs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  product_id uuid references public.products (id) on delete set null,
  -- 상품·구역이 나중에 지워져도 히스토리에는 이름이 남도록 같이 저장해요
  product_name text not null,
  category_name text not null,
  zone_name text not null,
  processed_by uuid references public.profiles (id) on delete set null,
  processed_at timestamptz not null default now(),
  old_expiry date,
  new_expiry date,
  out_of_stock boolean not null,
  check (out_of_stock = (new_expiry is null))
);

create index process_logs_store_time_idx on public.process_logs (store_id, processed_at desc);
create index process_logs_product_idx on public.process_logs (product_id, processed_at desc);

alter table public.process_logs enable row level security;

-- 점주·알바 모두 같은 매장 히스토리를 볼 수 있어요. 쓰기는 아래 함수로만.
create policy "멤버는 히스토리 읽기" on public.process_logs for select
  to authenticated using (public.is_store_member(store_id));

-- 처리 완료: 다음으로 빠른 날짜를 넣거나(p_new_expiry), 재고 없음(p_out_of_stock)
create function public.process_product(p_product_id uuid, p_new_expiry date, p_out_of_stock boolean)
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
    processed_by, old_expiry, new_expiry, out_of_stock
  )
  select v_product.store_id, v_product.category_id, v_product.id, v_product.name, c.name, z.name,
         auth.uid(), v_product.earliest_expiry, p_new_expiry, p_out_of_stock
  from public.categories c, public.zones z
  where c.id = v_product.category_id and z.id = v_product.zone_id
  returning * into v_log;

  return v_log;
end;
$$;

-- 방금 한 처리 되돌리기: 그 상품의 마지막 처리이고, 그 뒤로 상품이 바뀌지 않았을 때만
create function public.undo_process(p_log_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_log public.process_logs;
  v_product public.products;
begin
  select * into v_log from public.process_logs where id = p_log_id;
  if v_log.id is null then
    raise exception '처리 기록을 찾을 수 없어요';
  end if;
  if v_log.processed_by is distinct from auth.uid() and not public.is_store_owner(v_log.store_id) then
    raise exception '본인이 한 처리만 되돌릴 수 있어요';
  end if;

  select * into v_product from public.products where id = v_log.product_id for update;
  if v_product.id is null
     or exists (
       select 1 from public.process_logs
       where product_id = v_log.product_id and processed_at > v_log.processed_at
     )
     or v_product.earliest_expiry is distinct from v_log.new_expiry
     or v_product.out_of_stock <> v_log.out_of_stock then
    raise exception '그 뒤로 상품이 바뀌어서 되돌릴 수 없어요';
  end if;

  update public.products
  set earliest_expiry = v_log.old_expiry, out_of_stock = (v_log.old_expiry is null)
  where id = v_product.id;

  delete from public.process_logs where id = v_log.id;
end;
$$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
