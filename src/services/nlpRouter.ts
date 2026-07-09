import { NLP_PROVIDER, USE_LOCAL_NLP_FALLBACK } from "../featureFlags";
import { categorizeThoughtDeepSeek } from "./deepseekService";
import { categorizeThought as categorizeThoughtGemini } from "./geminiService";
import { categorizeThoughtLocal } from "./localNlpService";

export async function categorizeThought(text: string): Promise<{
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
}> {
  const provider = (() => {
    try {
      const saved = localStorage.getItem('luminote_nlp_provider');
      if (saved === 'deepseek' || saved === 'gemini' || saved === 'local') return saved;
    } catch {}
    return NLP_PROVIDER;
  })();

  // 1. Fast-path: check if local NLP can resolve a definitive reminder with zero ambiguity
  try {
    const localResult = await categorizeThoughtLocal(text);
    if (localResult.reminder && !localResult.isAmbiguous) {
      console.log("[NLP Router] Fast-path hit: Local NLP resolved definitive reminder.", localResult);
      return {
        ...localResult,
        title: null,
      };
    }
  } catch (e) {
    console.error("[NLP Router] Local NLP fast-path error:", e);
  }

  if (provider === 'deepseek') {
    try {
      console.log("[NLP Router] Trying DeepSeek...");
      const result = await categorizeThoughtDeepSeek(text);
      console.log("[NLP Router] DeepSeek succeeded:", result);
      return result;
    } catch (err) {
      console.warn("[NLP Router] DeepSeek failed:", err);
      if (USE_LOCAL_NLP_FALLBACK) {
        console.log("[NLP Router] Falling back to local NLP...");
        return categorizeThoughtLocal(text);
      }
      throw err;
    }
  }

  if (provider === 'gemini') {
    try {
      console.log("[NLP Router] Trying Gemini...");
      const result = await categorizeThoughtGemini(text);
      console.log("[NLP Router] Gemini succeeded:", result);
      return result;
    } catch (err) {
      console.warn("[NLP Router] Gemini failed:", err);
      if (USE_LOCAL_NLP_FALLBACK) {
        console.log("[NLP Router] Falling back to local NLP...");
        const localRes = await categorizeThoughtLocal(text);
        return { ...localRes, title: null };
      }
      throw err;
    }
  }

  const localRes = await categorizeThoughtLocal(text);
  return { ...localRes, title: null };
}
