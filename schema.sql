-- 1. 创建 profiles 用户表，并通过 Trigger 在 auth.users 创建时自动注入
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  display_name text,
  photo_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile." on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update their own profile." on public.profiles
  for update using (auth.uid() = id);

-- 2. 创建 capsules 笔记胶囊表
create table public.capsules (
  id text primary key,
  user_id uuid references auth.users on delete cascade not null default auth.uid(),
  content text not null,
  subject text, -- Note Title
  category text,
  tag text, -- Singular tag
  tags jsonb default '[]'::jsonb, -- Deprecated tags array
  timestamp bigint not null,
  color text,
  is_todo boolean default false,
  completed boolean default false,
  is_archived boolean default false,
  is_deleted boolean default false,
  reminder jsonb,
  attachments jsonb, -- Note attachments array (images/videos metadata)
  is_starred boolean default false,
  is_pinned boolean default false,
  countdown_target bigint, -- Target timestamp for countdown tracker
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.capsules enable row level security;

create policy "Users can view their own capsules." on public.capsules
  for select using (auth.uid() = user_id);

create policy "Users can insert their own capsules." on public.capsules
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own capsules." on public.capsules
  for update using (auth.uid() = user_id);

create policy "Users can delete their own capsules." on public.capsules
  for delete using (auth.uid() = user_id);

-- 3. 创建自动把 auth.users 同步到 public.profiles 的 Trigger 触发器
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name, photo_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
