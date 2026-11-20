-- 0007: 처리 종류에 "판매 완료" 추가
-- action: pulled(빼둠) / sold(판매 완료) / disposed(폐기)
-- 예전 disposed 칸은 그대로 두고 action과 함께 맞춰 저장해요 (기존 화면 호환)

alter table public.process_logs
  add column action text not null default 'pulled'
  check (action in ('pulled', 'sold', 'disposed'));

update public.process_logs set action = 'disposed' where disposed;

-- 매개변수가 바뀌어서 기존 함수를 지우고 다시 만들어요 (p_action은 생략하면 빼둠)
drop function public.process_product(uuid, date, boolean, boolean);

create function public.process_product(
  p_product_id uuid,
  p_new_expiry date,
  p_out_of_stock boolean,
  p_action text default 'pulled'
)
returns public.process_logs
language plpgsql security definer set search_path = ''
as $$
declare
  v_product public.products;
  v_log public.process_logs;
  v_action text := coalesce(p_action, 'pulled');
begin
  if v_action not in ('pulled', 'sold', 'disposed') then
    raise exception '처리 방법을 다시 골라 주세요';
  end if;

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
    processed_by, old_expiry, new_expiry, out_of_stock, disposed, action
  )
  select v_product.store_id, v_product.category_id, v_product.id, v_product.name, c.name, z.name,
         auth.uid(), v_product.earliest_expiry, p_new_expiry, p_out_of_stock,
         v_action = 'disposed', v_action
  from public.categories c, public.zones z
  where c.id = v_product.category_id and z.id = v_product.zone_id
  returning * into v_log;

  return v_log;
end;
$$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
