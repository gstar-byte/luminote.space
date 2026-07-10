import AsyncStorage from '@react-native-async-storage/async-storage';

const HISTORY_KEY = 'lumi_reminder_history';
const MAX_HISTORY = 30;

export interface TimePoint {
  hour: number;
  minute: number;
  timestamp: number;
}

/**
 * 记录用户设定提醒的时刻，用于学习作息偏好
 */
export async function recordSettingTime(date: Date) {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    const history: TimePoint[] = raw ? JSON.parse(raw) : [];

    const newPoint: TimePoint = {
      hour: date.getHours(),
      minute: date.getMinutes(),
      timestamp: Date.now()
    };

    // 过滤掉超过30天的记录，并限制队列大小
    const oneMonthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const filtered = history
      .filter(p => p.timestamp > oneMonthAgo)
      .concat(newPoint)
      .slice(-MAX_HISTORY);

    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.warn('[Reminder Learning] Failed to record time:', err);
  }
}

/**
 * 学习获取特定时段的用户最佳提醒时间，返回小时和分钟
 */
export async function getLearnedTime(period: 'morning' | 'afternoon' | 'evening'): Promise<{ hour: number; minute: number }> {
  const defaults = {
    morning: { hour: 9, minute: 0 },
    afternoon: { hour: 14, minute: 0 },
    evening: { hour: 18, minute: 0 }
  };

  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    if (!raw) return defaults[period];

    const history: TimePoint[] = JSON.parse(raw);
    if (history.length === 0) return defaults[period];

    // 按时段过滤历史打点
    let filteredPoints = history.filter(p => {
      if (period === 'morning') {
        return p.hour >= 5 && p.hour < 12;
      } else if (period === 'afternoon') {
        return p.hour >= 12 && p.hour < 17;
      } else { // evening
        return p.hour >= 17 || p.hour < 5; // 允许深夜打点归为晚上
      }
    });

    if (filteredPoints.length === 0) {
      return defaults[period];
    }

    // 计算平均值
    let totalMinutes = 0;
    filteredPoints.forEach(p => {
      // 如果归为晚上且是凌晨，把它加24小时进行平均，算完再模24，防止在零点附近的平均数跑到了中午
      let adjustedHour = p.hour;
      if (period === 'evening' && p.hour < 5) {
        adjustedHour += 24;
      }
      totalMinutes += adjustedHour * 60 + p.minute;
    });

    const avgMinutes = Math.round(totalMinutes / filteredPoints.length);
    let finalHour = Math.floor(avgMinutes / 60) % 24;
    const finalMinute = avgMinutes % 60;

    // 四舍五入到最近的5分钟，使时间看起来更自然美观
    const roundedMinute = Math.round(finalMinute / 5) * 5;
    if (roundedMinute === 60) {
      finalHour = (finalHour + 1) % 24;
      return { hour: finalHour, minute: 0 };
    }

    return { hour: finalHour, minute: roundedMinute };
  } catch (err) {
    console.warn('[Reminder Learning] Failed to get learned time:', err);
    return defaults[period];
  }
}
