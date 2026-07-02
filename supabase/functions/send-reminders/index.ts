// Supabase Edge Function: send-reminders
// 每分钟由 pg_cron 调用，查询到期提醒并通过 Web Push 发送通知
import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "lumi-cron-2026";

webpush.setVapidDetails(
  "mailto:admin@luminote.space",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

Deno.serve(async (req) => {
  // 使用自定义 CRON_SECRET 验证，避免新旧 JWT 密钥不匹配
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now = Date.now();

  // 1. 查询所有到期提醒（reminder.date <= now，未完成，未删除，未归档）
  const capsulesRes = await fetch(
    `${SUPABASE_URL}/rest/v1/capsules?select=id,content,reminder,user_id&is_deleted=eq.false&is_archived=eq.false&completed=eq.false`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }
  );
  const capsules = await capsulesRes.json();

  // 过滤出 reminder.date 在过去 70 秒内（60s cron 间隔 + 10s 容差）的提醒
  const dueCapsules = capsules.filter((c: any) => {
    if (!c.reminder?.date) return false;
    const d = Number(c.reminder.date);
    return d > 0 && d <= now && now - d < 70000;
  });

  if (dueCapsules.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  let sent = 0;
  let failed = 0;

  for (const cap of dueCapsules) {
    // 2. 查询该用户的所有 push subscriptions
    const subsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?user_id=eq.${cap.user_id}&select=subscription`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );
    const subs = await subsRes.json();
    if (!subs || subs.length === 0) continue;

    const body =
      typeof cap.content === "string"
        ? cap.content
        : cap.content?.content || "You have a reminder.";

    const payload = JSON.stringify({
      title: "Lumi Note Reminder",
      body: body.slice(0, 120),
      tag: cap.id,
      icon: "/favicon-192-v18.png",
      badge: "/favicon-48-v18.png",
      data: { id: cap.id },
    });

    for (const row of subs) {
      try {
        await webpush.sendNotification(row.subscription, payload);
        sent++;
      } catch (err: any) {
        console.error(`[send-reminders] Push failed for sub:`, err?.statusCode, err?.body);
        // 410 Gone = subscription expired, remove it
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await fetch(
            `${SUPABASE_URL}/rest/v1/push_subscriptions?user_id=eq.${cap.user_id}`,
            {
              method: "DELETE",
              headers: {
                apikey: SUPABASE_SERVICE_ROLE_KEY,
                Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              },
            }
          );
        }
        failed++;
      }
    }

    // 3. 更新 reminder 到下次时间（或清除）
    const nextReminder = { ...cap.reminder };
    let shouldUpdate = false;
    if (cap.reminder.type === "daily") {
      nextReminder.date = now + 86400000;
      shouldUpdate = true;
    } else if (cap.reminder.type === "weekly") {
      nextReminder.date = now + 604800000;
      shouldUpdate = true;
    } else if (cap.reminder.type === "monthly") {
      const nd = new Date(now);
      nd.setMonth(nd.getMonth() + 1);
      nextReminder.date = nd.getTime();
      shouldUpdate = true;
    } else if (cap.reminder.type === "yearly") {
      const nd = new Date(now);
      nd.setFullYear(nd.getFullYear() + 1);
      nextReminder.date = nd.getTime();
      shouldUpdate = true;
    } else {
      nextReminder.type = "none";
      shouldUpdate = true;
    }

    if (shouldUpdate) {
      await fetch(`${SUPABASE_URL}/rest/v1/capsules?id=eq.${cap.id}`, {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reminder: nextReminder }),
      });
    }
  }

  return new Response(JSON.stringify({ sent, failed, checked: dueCapsules.length }), {
    headers: { "Content-Type": "application/json" },
  });
});
