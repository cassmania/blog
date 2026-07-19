-- 丕刀卜己卜人丨廿卜 blog — Supabase 초기 설정
-- Supabase 대시보드 → SQL Editor → New query → 전체 붙여넣기 → Run

-- 게시판
create table if not exists boards (
  id bigint generated always as identity primary key,
  name text not null unique,
  created_at timestamptz not null default now()
);

-- 글
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default '',
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- 댓글
create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  name text not null,
  body text,
  photo text,
  encrypted jsonb,
  secret boolean not null default false,
  approved boolean not null default false,
  spam boolean not null default false,
  pw_hash text not null,
  created_at timestamptz not null default now()
);

-- 사이트 설정 (홈 이미지·게시판 효과)
create table if not exists settings (
  key text primary key,
  value jsonb not null
);

-- 커스텀 페이지 (관리자가 자유롭게 생성 — 개수 제한 없음)
create table if not exists custom_pages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- 테이블 접근 권한 (RLS 정책은 이 위에서 다시 거른다)
grant usage on schema public to anon, authenticated;
grant select on posts, boards, comments, settings, custom_pages to anon;
grant insert on comments to anon;
grant execute on all functions in schema public to anon, authenticated;
grant all on posts, boards, comments, settings, custom_pages to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- RLS 활성화
alter table boards enable row level security;
alter table posts enable row level security;
alter table comments enable row level security;
alter table settings enable row level security;
alter table custom_pages enable row level security;

-- custom_pages: 누구나 읽기, 관리자만 쓰기
create policy "pages read" on custom_pages for select using (true);
create policy "pages write" on custom_pages for all to authenticated using (true) with check (true);

-- boards: 누구나 읽기, 관리자(로그인)만 쓰기
create policy "boards read" on boards for select using (true);
create policy "boards write" on boards for all to authenticated using (true) with check (true);

-- posts: 누구나 읽기, 관리자만 쓰기
create policy "posts read" on posts for select using (true);
create policy "posts write" on posts for all to authenticated using (true) with check (true);

-- comments: 승인된 것만 공개 (관리자는 전부), 누구나 작성(승인 대기 상태로만), 관리자만 수정·삭제
create policy "comments read approved" on comments for select using (approved = true);
create policy "comments read all admin" on comments for select to authenticated using (true);
create policy "comments insert" on comments for insert with check (approved = false);
create policy "comments update admin" on comments for update to authenticated using (true);
create policy "comments delete admin" on comments for delete to authenticated using (true);

-- settings: 누구나 읽기, 관리자만 쓰기
create policy "settings read" on settings for select using (true);
create policy "settings write" on settings for all to authenticated using (true) with check (true);

-- 방문자 본인 댓글 삭제: 비밀번호 해시 일치 시 삭제 (RLS 우회 함수)
create or replace function delete_comment_with_pw(cid uuid, pw text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  cnt integer;
begin
  delete from comments where id = cid and pw_hash = pw;
  get diagnostics cnt = row_count;
  return cnt > 0;
end;
$$;

grant execute on function delete_comment_with_pw(uuid, text) to anon, authenticated;

-- 환영 글
insert into posts (title, category, content)
values (
  '블로그를 시작합니다',
  '공지',
  '<p>丕刀卜己卜人丨廿卜 블로그에 오신 것을 환영합니다.</p><p>이제 모든 글과 댓글이 실시간으로 공유됩니다.</p><blockquote>기록은 생각을 단단하게 만든다.</blockquote>'
)
on conflict do nothing;
