-- 사진으로 유통기한 읽기: 한 사람이 하루에 쓸 수 있는 횟수 제한
-- (사진 인식은 한 번 쓸 때마다 비용이 들어서, 실수나 남용으로 비용이 커지지 않게 막아요)

create table if not exists public.read_expiry_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count int not null default 0,
  primary key (user_id, day)
);

-- 앱에서 직접 읽거나 쓰지 않아요. 아래 함수로만 늘려요.
alter table public.read_expiry_usage enable row level security;

-- 오늘(서울 기준) 사용 횟수를 1 늘리고, 하루 한도(100번) 안이면 true
create or replace function public.read_expiry_quota()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_day date := (now() at time zone 'Asia/Seoul')::date;
  v_count int;
begin
  if v_user is null then
    raise exception '로그인이 필요해요.';
  end if;

  insert into public.read_expiry_usage (user_id, day, count)
  values (v_user, v_day, 1)
  on conflict (user_id, day) do update set count = public.read_expiry_usage.count + 1
  returning count into v_count;

  return v_count <= 100;
end;
$$;

revoke execute on function public.read_expiry_quota() from public, anon;
grant execute on function public.read_expiry_quota() to authenticated;
