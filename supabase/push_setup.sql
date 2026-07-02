-- ================================================================
-- 第 1 步：创建 push_subscriptions 表（存储每个用户的浏览器推送订阅）
-- 在 Supabase Dashboard → SQL Editor 中执行
-- ================================================================

create table if not exists public.push_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  endpoint text not null,
  subscription jsonb not null,
  user_agent text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  -- 同一用户同一浏览器只存一条
  unique(user_id, endpoint)
);

-- 启用 Row Level Security
alter table public.push_subscriptions enable row level security;

-- 用户只能读写自己的订阅
create policy "Users can manage their own push subscriptions."
  on public.push_subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 索引加速查询
create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions(user_id);

-- ================================================================
-- 第 2 步：提取 endpoint 字段到独立列（用于 upsert 去重）
-- ================================================================

-- 创建触发器自动从 subscription jsonb 中提取 endpoint
create or replace function public.extract_push_endpoint()
returns trigger as $$
begin
  new.endpoint := new.subscription->>'endpoint';
  return new;
end;
$$ language plpgsql;

create or replace trigger set_push_endpoint
  before insert or update on public.push_subscriptions
  for each row execute procedure public.extract_push_endpoint();

-- ================================================================
-- 第 3 步：启用 pg_cron 扩展并设置每分钟调用 Edge Function
-- 注意：需要在 Supabase Dashboard → Database → Extensions 先开启 pg_cron
-- ================================================================

-- 开启扩展（如果还没开启）
create extension if not exists pg_cron with schema extensions;

-- 每分钟调用 send-reminders Edge Function
-- 把下面的 <PROJECT_REF> 替换为你的 Supabase 项目 ID: acfgqumycnwzdbbpfbex
-- 把下面的 <SERVICE_ROLE_KEY> 替换为你的 Service Role Key（在 Supabase → Settings → API 里找）
select cron.schedule(
  'send-push-reminders',         -- cron job 名称
  '* * * * *',                   -- 每分钟执行
  $$
  select net.http_post(
    url := 'https://acfgqumycnwzdbbpfbex.functions.supabase.co/send-reminders',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);
