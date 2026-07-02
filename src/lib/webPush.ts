import { supabase } from './supabaseClient';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

/**
 * 将 base64url 字符串转换为 Uint8Array（VAPID 公钥格式转换）
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * 订阅 Web Push 并把 subscription 保存到 Supabase。
 * 在用户授权通知权限后调用。
 */
export async function subscribeToPush(userId: string): Promise<boolean> {
  if (!VAPID_PUBLIC_KEY) {
    console.warn('[WebPush] VITE_VAPID_PUBLIC_KEY 未配置，跳过订阅');
    return false;
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[WebPush] 浏览器不支持 Web Push');
    return false;
  }

  if (Notification.permission !== 'granted') {
    console.warn('[WebPush] 未获取通知权限，跳过订阅');
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    // 检查是否已经有订阅
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // 新建订阅
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      console.log('[WebPush] 新订阅创建成功');
    } else {
      console.log('[WebPush] 已有订阅，复用');
    }

    // 序列化 subscription 并存入 Supabase
    const subJson = subscription.toJSON();

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: userId,
          subscription: subJson,
          user_agent: navigator.userAgent.slice(0, 200),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,endpoint' }
      );

    if (error) {
      console.error('[WebPush] 保存订阅失败:', error.message);
      return false;
    }

    console.log('[WebPush] 订阅已保存到 Supabase ✅');
    return true;
  } catch (err) {
    console.error('[WebPush] 订阅失败:', err);
    return false;
  }
}

/**
 * 取消订阅（用户关闭通知权限时调用）
 */
export async function unsubscribeFromPush(userId: string): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      // 从 Supabase 删除
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('endpoint', endpoint);
      console.log('[WebPush] 已取消订阅');
    }
  } catch (err) {
    console.error('[WebPush] 取消订阅失败:', err);
  }
}
