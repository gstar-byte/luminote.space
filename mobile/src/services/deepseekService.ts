import { SYSTEM_PROMPT } from '../constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const getDeepSeekKey = async (): Promise<string> => {
  try {
    const userKey = await AsyncStorage.getItem('luminote_deepseek_api_key');
    if (userKey) return userKey;
  } catch {}
  return (
    process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY ||
    process.env.EXPO_PUBLIC_DEEPSEEK_KEY ||
    process.env.VITE_DEEPSEEK_API_KEY ||
    ''
  );
};

const API_URL = 'https://api.deepseek.com/chat/completions';
const MODEL = 'deepseek-chat';

export type DeepSeekResult = {
  title?: string | null;
  category?: string;
  tags?: string[];
  refinedContent: string;
  isTodo?: boolean;
  reminder?: any;
  isAmbiguous?: boolean;
  clarificationPrompt?: string | null;
  isStarred?: boolean;
  isPinned?: boolean;
};

export async function categorizeThoughtDeepSeek(text: string): Promise<DeepSeekResult> {
  const apiKey = await getDeepSeekKey();
  if (!apiKey) {
    console.warn('[DeepSeek] Mobile API Key missing.');
    throw new Error('DeepSeek API Key not configured');
  }

  const now = new Date();
  const prompt =
    SYSTEM_PROMPT.replace(
      '{{CURRENT_TIME_ZH}}',
      now.toLocaleString('zh-CN', {
        weekday: 'long',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
    ).replace('{{CURRENT_TIME_ISO}}', now.toISOString()) +
    '\n\nInput text: ' +
    text;

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('DeepSeek API timeout')), 5000),
  );

  const fetchPromise = fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: text },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 1024,
      temperature: 0.2,
    }),
  }).then(async (res) => {
    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      throw new Error(`DeepSeek HTTP ${res.status}: ${err}`);
    }
    return res.json();
  });

  const data = await Promise.race([fetchPromise, timeoutPromise]);

  const raw = data.choices?.[0]?.message?.content || '{}';
  const result = typeof raw === 'string' ? JSON.parse(raw) : raw;

  let finalReminder = result.reminder || undefined;
  if (finalReminder && typeof finalReminder === 'object') {
    if (finalReminder.date != null) {
      let d = finalReminder.date;
      if (typeof d === 'string') {
        const parsedDate = new Date(d).getTime();
        if (!isNaN(parsedDate)) {
          finalReminder.date = parsedDate;
        }
      } else if (typeof d === 'number') {
        if (d < 9999999999) {
          finalReminder.date = d * 1000;
        }
      }
      if (isNaN(finalReminder.date)) {
        finalReminder = undefined;
      }
    }
  }

  // Ensure category and tags don't overlap
  let finalTags: string[] | undefined = Array.isArray(result.tags) ? result.tags : undefined;
  const finalCategory = result.category || undefined;
  if (finalCategory && finalTags) {
    finalTags = finalTags.filter((t) => t.toLowerCase() !== finalCategory.toLowerCase());
    if (finalTags.length === 0) finalTags = undefined;
  }

  return {
    title: result.title || null,
    category: finalCategory,
    tags: finalTags,
    refinedContent: result.refinedContent || text,
    isTodo: typeof result.isTodo === 'boolean' ? result.isTodo : (finalReminder ? true : undefined),
    reminder: finalReminder,
    isAmbiguous: typeof result.isAmbiguous === 'boolean' ? result.isAmbiguous : undefined,
    clarificationPrompt: result.clarificationPrompt || undefined,
    isStarred: typeof result.isStarred === 'boolean' ? result.isStarred : undefined,
    isPinned: typeof result.isPinned === 'boolean' ? result.isPinned : undefined,
  };
}
