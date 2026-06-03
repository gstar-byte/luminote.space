import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';

// Initialize Firebase Admin SDK using Environment Variable
if (!admin.apps.length) {
  try {
    const rawAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (rawAccount) {
      const serviceAccount = JSON.parse(rawAccount);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('[FirebaseAdmin] Initialized successfully via FIREBASE_SERVICE_ACCOUNT.');
    } else {
      console.error('[FirebaseAdmin] Missing environment variable FIREBASE_SERVICE_ACCOUNT.');
    }
  } catch (e) {
    console.error('[FirebaseAdmin] Initialization failed:', e);
  }
}

const db = admin.apps.length ? admin.firestore() : null;
const messaging = admin.apps.length ? admin.messaging() : null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!db || !messaging) {
    return res.status(500).json({ error: 'Firebase Admin SDK not initialized' });
  }

  try {
    const now = Date.now();
    console.log(`[Cron] Checking reminders at ${new Date(now).toISOString()}`);

    // Query active candidates (uncompleted, not deleted, not archived)
    const snapshot = await db.collection('capsules')
      .where('isDeleted', '==', false)
      .where('completed', '==', false)
      .where('isArchived', '==', false)
      .get();

    const expiredCapsules: any[] = [];

    // Filter capsules with expired reminders in memory to avoid complex compound Firestore indices
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (
        data.reminder &&
        data.reminder.type &&
        data.reminder.type !== 'none' &&
        data.reminder.date &&
        data.reminder.date <= now
      ) {
        expiredCapsules.push({
          id: docSnap.id,
          ...data
        });
      }
    });

    console.log(`[Cron] Found ${expiredCapsules.length} expired reminders.`);

    const results = [];

    for (const cap of expiredCapsules) {
      const userId = cap.userId;
      if (!userId) {
        console.warn(`[Cron] Reminder ${cap.id} has no userId, skipping.`);
        continue;
      }

      // Fetch user's devices push tokens from the user profile document
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.exists ? userDoc.data() : null;
      const fcmTokens: string[] = userData?.fcmTokens || [];

      let pushStatus = 'no_tokens';

      if (fcmTokens.length > 0) {
        const title = 'Lumi Note Reminder';
        const body = typeof cap.content === 'string' ? cap.content : 'You have an active reminder.';
        
        // Clean tokens from duplicates
        const uniqueTokens = Array.from(new Set(fcmTokens)).filter(t => !!t);

        if (uniqueTokens.length > 0) {
          try {
            const messagePayload = {
              tokens: uniqueTokens,
              notification: {
                title,
                body
              },
              data: {
                noteId: cap.id
              },
              android: {
                priority: 'high' as const,
                notification: {
                  sound: 'default',
                  clickAction: 'FLUTTER_NOTIFICATION_CLICK'
                }
              },
              apns: {
                payload: {
                  aps: {
                    sound: 'default',
                    badge: 1
                  }
                }
              },
              webpush: {
                headers: {
                  Urgency: 'high'
                },
                notification: {
                  icon: '/favicon-192.png',
                  badge: '/favicon-48.png',
                  requireInteraction: true
                }
              }
            };

            const response = await messaging.sendEachForMulticast(messagePayload);
            console.log(`[Cron] Multicast notification sent for note ${cap.id}. Success: ${response.successCount}, Failure: ${response.failureCount}`);
            pushStatus = `sent_success_${response.successCount}_fail_${response.failureCount}`;

            // Clean up invalid/unregistered tokens from database if they fail
            if (response.failureCount > 0) {
              const validTokens = uniqueTokens.filter((_, idx) => {
                const isOk = response.responses[idx].success;
                if (!isOk) {
                  console.log(`[Cron] Token failed: ${response.responses[idx].error?.code}`);
                }
                return isOk;
              });
              await db.collection('users').doc(userId).update({ fcmTokens: validTokens });
            }
          } catch (pushErr) {
            console.error(`[Cron] Failed to send push message for note ${cap.id}:`, pushErr);
            pushStatus = 'push_error';
          }
        }
      }

      // 3. Advance reminder time or turn it off to prevent double-firing
      let shouldUpdate = false;
      const nextReminder = { ...cap.reminder };

      if (cap.reminder.type === 'custom' && cap.reminder.customInterval) {
        const mult = cap.reminder.customUnit === 'day' ? 86400000 : cap.reminder.customUnit === 'week' ? 604800000 : 2592000000;
        nextReminder.date = now + cap.reminder.customInterval * mult;
        shouldUpdate = true;
      } else if (cap.reminder.type === 'daily') {
        nextReminder.date = now + 86400000;
        shouldUpdate = true;
      } else if (cap.reminder.type === 'weekly') {
        nextReminder.date = now + 604800000;
        shouldUpdate = true;
      } else if (cap.reminder.type === 'monthly') {
        const nextDate = new Date(now);
        nextDate.setMonth(nextDate.getMonth() + 1);
        nextReminder.date = nextDate.getTime();
        shouldUpdate = true;
      } else if (cap.reminder.type === 'yearly') {
        const nextDate = new Date(now);
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        nextReminder.date = nextDate.getTime();
        shouldUpdate = true;
      } else {
        nextReminder.type = 'none';
        shouldUpdate = true;
      }

      if (shouldUpdate) {
        await db.collection('capsules').doc(cap.id).update({
          reminder: nextReminder,
          updatedAt: now
        });
        console.log(`[Cron] Updated note ${cap.id} reminder state to type: ${nextReminder.type}`);
      }

      results.push({
        id: cap.id,
        content: cap.content,
        pushStatus,
        nextReminderType: nextReminder.type
      });
    }

    return res.status(200).json({
      status: 'success',
      processedReminders: results.length,
      details: results
    });

  } catch (error: any) {
    console.error('[Cron] Unhandled error during scan:', error);
    return res.status(500).json({ error: error.message });
  }
}
