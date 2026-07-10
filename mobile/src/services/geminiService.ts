import { GoogleGenerativeAI } from '@google/generative-ai';
import { SYSTEM_PROMPT } from '../constants';
import { categorizeThoughtLocal } from './localNlpService';
import { categorizeThoughtDeepSeek } from './deepseekService';
import AsyncStorage from '@react-native-async-storage/async-storage';

async function getGeminiKey(): Promise<string> {
  try {
    const userKey = await AsyncStorage.getItem('luminote_gemini_api_key');
    if (userKey) return userKey;
  } catch {}
  return (
    process.env.EXPO_PUBLIC_GEMINI_API_KEY ||
    process.env.EXPO_PUBLIC_GEMINI_KEY ||
    ''
  );
}

async function getDeepSeekKey(): Promise<string> {
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
}

async function getProvider(): Promise<'gemini' | 'deepseek' | 'local'> {
  try {
    const saved = await AsyncStorage.getItem('luminote_nlp_provider');
    if (saved === 'gemini' || saved === 'deepseek' || saved === 'local') return saved;
  } catch {}
  return 'gemini';
}

export type CategorizeThoughtResult = {
  title?: string | null;
  category?: string;
  tags?: string[];
  refinedContent: string;
  isTodo?: boolean;
  reminder?: unknown;
  countdownTarget?: number;
};

export async function categorizeThoughtFromAudio(
  audioBase64: string,
  mimeType: string,
): Promise<CategorizeThoughtResult & { error?: string }> {
  const apiKey = await getGeminiKey();
  if (!apiKey) {
    return { refinedContent: '', error: 'NO_KEY' };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: { responseMimeType: 'application/json' },
    });

    const now = new Date();
    const textPrompt =
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
      '\n\nListen to the attached short voice note. Transcribe the speech as the main idea text. ' +
      'Then produce the same JSON object as for typed input: refinedContent must be the transcribed plain text; ' +
      'fill category, tags, isTodo, and reminder when appropriate.';

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Gemini API timeout')), 30000),
    );

    const gen = model.generateContent([
      { text: textPrompt },
      { inlineData: { mimeType, data: audioBase64 } },
    ]);
    const result = await Promise.race([gen, timeout]);
    const response = await result.response;
    const raw = response.text();
    const parsed = JSON.parse(raw || '{}');

    return {
      title: typeof parsed.title === 'string' ? parsed.title : null,
      category: typeof parsed.category === 'string' ? parsed.category : undefined,
      tags: Array.isArray(parsed.tags) ? parsed.tags : undefined,
      refinedContent:
        typeof parsed.refinedContent === 'string' ? parsed.refinedContent : '',
      isTodo: typeof parsed.isTodo === 'boolean' ? parsed.isTodo : undefined,
      reminder: parsed.reminder ?? undefined,
      countdownTarget: typeof parsed.countdownTarget === 'number' ? parsed.countdownTarget : undefined,
    };
  } catch (error) {
    console.error('Failed to categorize from audio:', error);
    return { refinedContent: '', error: 'API_ERROR' };
  }
}

export async function categorizeThought(text: string): Promise<CategorizeThoughtResult> {
  // 1. Fast-path: check if local NLP can resolve a definitive reminder with zero ambiguity
  try {
    const localResult = await categorizeThoughtLocal(text);
    if (localResult.reminder && !localResult.isAmbiguous) {
      console.log('[Mobile NLP Router] Fast-path hit: Local NLP resolved definitive reminder.', localResult);
      return {
        title: null,
        category: localResult.category,
        tags: localResult.tags,
        refinedContent: localResult.refinedContent,
        isTodo: localResult.isTodo,
        reminder: localResult.reminder,
      };
    }
  } catch (e) {
    console.warn('[Mobile NLP Router] Local NLP fast-path error:', e);
  }

  const provider = await getProvider();

  // 2. Try DeepSeek (if chosen and API key is available)
  if (provider === 'deepseek') {
    const dsKey = await getDeepSeekKey();
    if (dsKey) {
      try {
        console.log('[Mobile NLP Router] Trying DeepSeek...');
        const dsResult = await categorizeThoughtDeepSeek(text);
        console.log('[Mobile NLP Router] DeepSeek succeeded:', dsResult);
        return dsResult;
      } catch (err) {
        console.warn('[Mobile NLP Router] DeepSeek failed, falling back to local:', err);
      }
    }
    // Fallback to local
    const localRes = await categorizeThoughtLocal(text);
    return {
      title: null,
      category: localRes.category,
      tags: localRes.tags,
      refinedContent: text,
      isTodo: localRes.isTodo,
      reminder: localRes.reminder,
    };
  }

  // 3. Try Local Parser (if chosen)
  if (provider === 'local') {
    const localRes = await categorizeThoughtLocal(text);
    return {
      title: null,
      category: localRes.category,
      tags: localRes.tags,
      refinedContent: text,
      isTodo: localRes.isTodo,
      reminder: localRes.reminder,
    };
  }

  // 4. Try Gemini (default and fallback)
  const apiKey = await getGeminiKey();
  if (!apiKey) {
    const localRes = await categorizeThoughtLocal(text);
    return {
      title: null,
      category: localRes.category,
      tags: localRes.tags,
      refinedContent: text,
      isTodo: localRes.isTodo,
      reminder: localRes.reminder,
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: { responseMimeType: 'application/json' },
    });

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

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Gemini API timeout')), 10000),
    );

    const gen = model.generateContent(prompt);
    const result = await Promise.race([gen, timeout]);
    const response = await result.response;
    const raw = response.text();
    const parsed = JSON.parse(raw || '{}');

    return {
      title: typeof parsed.title === 'string' ? parsed.title : null,
      category: typeof parsed.category === 'string' ? parsed.category : undefined,
      tags: Array.isArray(parsed.tags) ? parsed.tags : undefined,
      refinedContent:
        typeof parsed.refinedContent === 'string' ? parsed.refinedContent : text,
      isTodo: typeof parsed.isTodo === 'boolean' ? parsed.isTodo : undefined,
      reminder: parsed.reminder ?? undefined,
      countdownTarget: typeof parsed.countdownTarget === 'number' ? parsed.countdownTarget : undefined,
    };
  } catch (error) {
    console.error('Failed to categorize thought:', error);
    const localRes = await categorizeThoughtLocal(text);
    return {
      title: null,
      category: localRes.category,
      tags: localRes.tags,
      refinedContent: text,
      isTodo: localRes.isTodo,
      reminder: localRes.reminder,
    };
  }
}
