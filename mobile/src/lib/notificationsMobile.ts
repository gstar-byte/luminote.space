import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { Capsule } from '../types';

// Helper to extract clean plain text for notification body
function plainTextFromContent(raw: string): string {
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.type !== 'doc' || !Array.isArray(parsed.content)) return raw;
    const lines: string[] = [];
    const walk = (nodes: any[]) => {
      for (const node of nodes) {
        if (node.type === 'text') { lines.push(node.text || ''); }
        else if (node.type === 'hardBreak') { lines.push(' '); }
        else if (node.content) { walk(node.content); }
        else if (['paragraph','heading','blockquote','listItem','bulletList','orderedList'].includes(node.type)) { lines.push(' '); }
      }
    };
    walk(parsed.content);
    return lines.join('').trim();
  } catch { return raw; }
}

/**
 * Configure how notifications are handled when the app is in the foreground.
 * We want it to show an alert and play a sound, just like native systems.
 */
export function initNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    } as any),
  });

  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync('reminders', {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#007AFF',
    });
  }
}

/**
 * Request notification permission from the OS.
 * @returns boolean indicating if the permission is granted
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  return finalStatus === 'granted';
}

/**
 * Cancel a scheduled local notification for a specific capsule.
 */
export async function cancelCapsuleNotification(capsuleId: string) {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(capsuleId);
  } catch (err) {
    console.warn(`[Notifications] Failed to cancel notification for ${capsuleId}:`, err);
  }
}

/**
 * Schedule a local notification for a capsule's reminder config.
 * Automatically cancels any existing notification for this capsule first.
 */
export async function scheduleCapsuleNotification(capsule: Capsule) {
  if (Platform.OS === 'web') return;
  
  // 1. Always cancel the previous scheduled notification first to avoid duplicates or orphaned alarms
  await cancelCapsuleNotification(capsule.id);

  // 2. If it shouldn't trigger (no active date, completed, archived, deleted), stop here
  const r = capsule.reminder;
  if (!r || r.type === 'none' || !r.date) return;
  if (capsule.completed || capsule.isArchived || capsule.isDeleted) return;

  const reminderTime = r.date;
  const now = Date.now();
  
  // If the reminder date is in the past, don't schedule it
  if (reminderTime <= now) return;

  // 3. Extract readable text for the body
  let bodyText = plainTextFromContent(capsule.content);
  
  if (!bodyText.trim()) {
    bodyText = 'You have a scheduled reminder.';
  }

  // 4. Schedule the local OS notification
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Lumi Note Reminder 🔔',
        body: bodyText,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        data: { capsuleId: capsule.id },
      },
      trigger: {
        type: 'date',
        date: new Date(reminderTime),
      } as any,
      identifier: capsule.id,
    });
    console.log(`[Notifications] Scheduled alarm for note [${capsule.id}] at ${new Date(reminderTime).toLocaleString()}`);
  } catch (err) {
    console.error(`[Notifications] Failed to schedule notification for capsule ${capsule.id}:`, err);
  }
}

/**
 * Synchronize all notifications based on the current list of capsules.
 * Loop through all capsules, cancel expired/inactive ones, and schedule active future ones.
 */
export async function syncAllCapsuleNotifications(capsules: Capsule[]) {
  if (Platform.OS === 'web') return;
  
  for (const capsule of capsules) {
    await scheduleCapsuleNotification(capsule);
  }
}
