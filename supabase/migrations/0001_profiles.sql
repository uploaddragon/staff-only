-- 0001: 사용자 프로필
-- 회원가입하면 auth.users에 계정이 생기고, 아래 트리거가 profiles 행을 자동으로 만들어요.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 20),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- 지금은 본인 프로필만 읽고 고칠 수 있어요.
-- (2단계에서 "같은 매장 멤버의 이름 보기" 정책을 추가해요)
create policy "본인 프로필 읽기"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "본인 프로필 수정"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- 가입 시 프로필 자동 생성 (클라이언트는 insert 권한이 없어요)
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
