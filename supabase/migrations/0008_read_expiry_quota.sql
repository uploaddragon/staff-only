-- 사진으로 유통기한 읽기: 사용 횟수 제한
-- Google Cloud Vision은 한 달 1,000장까지 무료라서, 넘지 않게 여유를 두고 막아요.
--  - 한 사람: 하루 100번
--  - 프로젝트 전체: 한 달 900번 (서울 기준 매달 1일에 다시 시작)
-- 이 파일은 여러 번 실행해도 괜찮아요.

create table if not exists public.read_expiry_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count int not null default 0,
  primary key (user_id, day)
);

create table if not exists public.read_expiry_monthly (
  month date primary key, -- 그 달 1일
  count int not null default 0
);

-- 앱에서 직접 읽거나 쓰지 않아요. 아래 함수로만 늘려요.
alter table public.read_expiry_usage enable row level security;
alter table public.read_expiry_monthly enable row level security;

-- 예전 버전(true/false를 돌려주던 함수)이 있으면 지우고 다시 만들어요
drop function if exists public.read_expiry_quota();

-- 한 번 쓸 때마다 부르면 횟수를 1 늘리고 'ok' / 'daily'(오늘 한도) / 'monthly'(이번 달 한도)를 돌려줘요.
-- 한도를 넘은 요청은 세지 않아요.
create function public.read_expiry_quota()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_day date := (now() at time zone 'Asia/Seoul')::date;
  v_month date := date_trunc('month', (now() at time zone 'Asia/Seoul'))::date;
  v_daily int;
  v_monthly int;
begin
  if v_user is null then
    raise exception '로그인이 필요해요.';
  end if;

  -- 동시에 여러 번 눌러도 한도를 넘지 않게 이번 달 줄을 잠가요
  insert into public.read_expiry_monthly (month, count) values (v_month, 0) on conflict (month) do nothing;
  select count into v_monthly from public.read_expiry_monthly where month = v_month for update;
  if v_monthly >= 900 then
    return 'monthly';
  end if;

  select count into v_daily from public.read_expiry_usage where user_id = v_user and day = v_day;
  if coalesce(v_daily, 0) >= 100 then
    return 'daily';
  end if;

  insert into public.read_expiry_usage (user_id, day, count) values (v_user, v_day, 1)
  on conflict (user_id, day) do update set count = public.read_expiry_usage.count + 1;
  update public.read_expiry_monthly set count = count + 1 where month = v_month;
  return 'ok';
end;
$$;

revoke execute on function public.read_expiry_quota() from public, anon;
grant execute on function public.read_expiry_quota() to authenticated;
