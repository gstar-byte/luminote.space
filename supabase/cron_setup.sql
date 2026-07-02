-- ================================================================
-- 第 3 步 Part B：启用 pg_net + pg_cron，设置每分钟定时推送
-- 在 Supabase Dashboard → SQL Editor 中执行
-- ================================================================

-- 启用 pg_net（用于从 cron 发 HTTP 请求）
create extension if not exists pg_net with schema extensions;

-- 启用 pg_cron
create extension if not exists pg_cron with schema extensions;

-- 授权 postgres 用户使用 cron
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- 删除旧任务（如果已存在）
select cron.unschedule('send-push-reminders') where exists (
  select 1 from cron.job where jobname = 'send-push-reminders'
);

-- 每分钟调用 send-reminders Edge Function
select cron.schedule(
  'send-push-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://acfgqumycnwzdbbpfbex.functions.supabase.co/send-reminders',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjZmdxdW15Y253emRiYnBmYmV4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjM0MjY4OCwiZXhwIjoyMDk3OTE4Njg4fQ.WJ5dit3ZICVgUlxZBfo6fM7665q4w3UX_TY1M1vfiLk"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- 验证 cron job 已创建
select jobname, schedule, active from cron.job where jobname = 'send-push-reminders';
