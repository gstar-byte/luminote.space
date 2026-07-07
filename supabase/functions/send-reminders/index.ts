// Supabase Edge Function: send-reminders
// 每分钟由 pg_cron 调用，查询到期提醒并通过 Web Push 发送通知
// 无需认证检查 — 内部调用，函数 URL 不对外公开
import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

webpush.setVapidDetails("mailto:admin@luminote.space", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

function plainTextFromContent(content: any): string {
  if (!content) return "";
  if (typeof content === "string") {
    const trimmed = content.trim();
    if (!trimmed.startsWith("{")) {
      return trimmed
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/\*(.+?)\*/g, "$1")
        .replace(/~~(.+?)~~/g, "$1")
        .replace(/^>\s+/gm, "")
        .replace(/^[-*+]\s+/gm, "")
        .replace(/^\d+\.\s+/gm, "")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1");
    }
    try {
      const parsed = JSON.parse(trimmed);
      return plainTextFromContent(parsed);
    } catch {
      return trimmed;
    }
  }

  if (content.type === "text") return content.text || "";
  if (content.content && Array.isArray(content.content)) {
    return content.content.map(plainTextFromContent).filter(Boolean).join(" ").trim();
  }
  if (Array.isArray(content)) {
    return content.map(plainTextFromContent).filter(Boolean).join(" ").trim();
  }
  if (typeof content === "object") {
    if (content.text) return content.text;
    if (content.value) return content.value;
  }
  return "";
}

Deno.serve(async (_req) => {
  const now = Date.now();

  const capsulesRes = await fetch(
    `${SUPABASE_URL}/rest/v1/capsules?select=id,content,reminder,user_id,subject&is_deleted=eq.false&is_archived=eq.false&completed=eq.false`,
    { headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } }
  );
  const capsules = await capsulesRes.json();
  console.log("[send-reminders] Capsules:", capsules.length);

  const dueCapsules = capsules.filter((c: any) => {
    if (!c.reminder?.date) return false;
    const d = Number(c.reminder.date);
    return d > 0 && d <= now && now - d < 70000;
  });
  console.log("[send-reminders] Due:", dueCapsules.length);

  if (dueCapsules.length === 0) {
    return new Response(JSON.stringify({ sent: 0, total: capsules.length }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  let sent = 0, failed = 0;

  for (const cap of dueCapsules) {
    const subsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?user_id=eq.${cap.user_id}&select=subscription`,
      { headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } }
    );
    const subs = await subsRes.json();
    console.log("[send-reminders] Subscriptions for user:", subs.length);
    if (!subs || subs.length === 0) continue;

    const title = cap.subject || "Lumi Note Reminder";
    const body = plainTextFromContent(cap.content) || "You have a reminder.";
    const payload = JSON.stringify({
      title,
      body: body.slice(0, 120),
      tag: cap.id,
      icon: "/favicon-192-v18.png",
      data: { id: cap.id },
    });

    for (const row of subs) {
      try {
        await webpush.sendNotification(row.subscription, payload);
        sent++;
        console.log("[send-reminders] Push sent ✅");
      } catch (err: any) {
        console.error("[send-reminders] Push failed:", err?.statusCode, err?.body);
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await fetch(
            `${SUPABASE_URL}/rest/v1/push_subscriptions?user_id=eq.${cap.user_id}&endpoint=eq.${encodeURIComponent(row.subscription.endpoint)}`,
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

    const nextReminder = { ...cap.reminder };
    if (cap.reminder.type === "daily") nextReminder.date = now + 86400000;
    else if (cap.reminder.type === "weekly") nextReminder.date = now + 604800000;
    else if (cap.reminder.type === "monthly") { const nd = new Date(now); nd.setMonth(nd.getMonth() + 1); nextReminder.date = nd.getTime(); }
    else if (cap.reminder.type === "yearly") { const nd = new Date(now); nd.setFullYear(nd.getFullYear() + 1); nextReminder.date = nd.getTime(); }
    else nextReminder.type = "none";

    await fetch(`${SUPABASE_URL}/rest/v1/capsules?id=eq.${cap.id}`, {
      method: "PATCH",
      headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ reminder: nextReminder }),
    });
  }

  return new Response(JSON.stringify({ sent, failed, checked: dueCapsules.length }), {
    headers: { "Content-Type": "application/json" },
  });
});
