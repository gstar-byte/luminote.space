import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT } from "../constants";

export async function categorizeThoughtFromAudio(audioBase64: string, mimeType: string): Promise<{ title?: string | null; category?: string; tags?: string[]; refinedContent: string; isTodo?: boolean; reminder?: any; isAmbiguous?: boolean; clarificationPrompt?: string | null; isStarred?: boolean; isPinned?: boolean; countdownTarget?: number; error?: string }> {
  const getApiKey = () => {
    try {
      const userKey = localStorage.getItem('luminote_gemini_api_key');
      if (userKey) return userKey;
    } catch {}
    return import.meta.env.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? (process.env.GEMINI_API_KEY || "") : "") || "";
  };

  const key = getApiKey();
  if (!key) {
    console.warn("Lumi Note Gemini AI Client: API Key is missing for audio transcription.");
    return { refinedContent: "", error: "NO_KEY" };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: key });
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
      '\n\nThe input above is a short voice note. Listen to it carefully and apply ALL the rules above exactly as you would for typed text input. ' +
      'Transcribe the speech first, then transform it: strip time/date phrases from refinedContent so it contains ONLY the core task or idea name (e.g. "明天上午九点提醒我开会" → refinedContent "开会"). ' +
      'Set isTodo, reminder, countdownTarget, title, category, tags exactly as specified in the rules above.';
    
    // Add a timeout
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error("Gemini API timeout")), 30000)
    );
    
    const fetchPromise = ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { inlineData: { mimeType, data: audioBase64 } },
        { text: prompt }
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    const response = await Promise.race([fetchPromise, timeoutPromise]);
    let rawText = "{}";
    try {
      rawText = response.text || "{}";
    } catch (e) {
      console.warn("Gemini text getter threw an error (likely blocked or no content):", e);
      rawText = "{}";
    }
    rawText = rawText.replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();
    const result = JSON.parse(rawText);
    
    let finalReminder = result.reminder || undefined;
    if (finalReminder && typeof finalReminder === 'object') {
      if (finalReminder.date != null) {
        let d = finalReminder.date;
        if (typeof d === 'string') {
          const parsedDate = new Date(d).getTime();
          if (!isNaN(parsedDate)) finalReminder.date = parsedDate;
        } else if (typeof d === 'number') {
          if (d < 9999999999) finalReminder.date = d * 1000;
        }
        if (isNaN(finalReminder.date)) finalReminder = undefined;
      }
    }

    let finalCountdown = result.countdownTarget || undefined;
    if (finalCountdown != null) {
      if (typeof finalCountdown === 'string') {
        const parsed = new Date(finalCountdown).getTime();
        if (!isNaN(parsed)) finalCountdown = parsed;
      } else if (typeof finalCountdown === 'number') {
        if (finalCountdown < 9999999999) finalCountdown = finalCountdown * 1000;
      }
      if (typeof finalCountdown !== 'number' || isNaN(finalCountdown)) finalCountdown = undefined;
    }

    return {
      title: result.title || null,
      category: result.category || undefined,
      tags: Array.isArray(result.tags) ? result.tags : undefined,
      refinedContent: result.refinedContent || "",
      isTodo: typeof result.isTodo === 'boolean' ? result.isTodo : (finalReminder ? true : undefined),
      reminder: finalReminder,
      isAmbiguous: typeof result.isAmbiguous === 'boolean' ? result.isAmbiguous : undefined,
      clarificationPrompt: result.clarificationPrompt || undefined,
      isStarred: typeof result.isStarred === 'boolean' ? result.isStarred : undefined,
      isPinned: typeof result.isPinned === 'boolean' ? result.isPinned : undefined,
      countdownTarget: finalCountdown,
    };
  } catch (error) {
    console.error("Failed to categorize thought from audio:", error);
    return {
      refinedContent: "",
      error: "API_ERROR",
    };
  }
}

export async function categorizeThought(text: string): Promise<{ title?: string | null; category?: string; tags?: string[]; refinedContent: string; isTodo?: boolean; reminder?: any; isAmbiguous?: boolean; clarificationPrompt?: string | null; isStarred?: boolean; isPinned?: boolean; countdownTarget?: number }> {
  const getApiKey = () => {
    try {
      const userKey = localStorage.getItem('luminote_gemini_api_key');
      if (userKey) return userKey;
    } catch {}
    return import.meta.env.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? (process.env.GEMINI_API_KEY || "") : "") || "";
  };

  const key = getApiKey();
  if (!key) {
    console.warn("Lumi Note Gemini AI Client: GoogleGenAI is not initialized because API Key is missing. Falling back to plain text note.");
    return { refinedContent: text };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: key });
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
    
    // Add a 2 second timeout
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error("Gemini API timeout")), 2000)
    );
    
    const fetchPromise = ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const response = await Promise.race([fetchPromise, timeoutPromise]);
    let rawText = response.text || "{}";
    rawText = rawText.replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();
    const result = JSON.parse(rawText);
    
    let finalReminder = result.reminder || undefined;
    if (finalReminder && typeof finalReminder === 'object') {
      if (finalReminder.date != null) {
        let d = finalReminder.date;
        if (typeof d === 'string') {
          // Resolve ISO strings or other date strings
          const parsedDate = new Date(d).getTime();
          if (!isNaN(parsedDate)) {
            finalReminder.date = parsedDate;
          }
        } else if (typeof d === 'number') {
          // If Gemini outputs seconds timestamp instead of milliseconds
          if (d < 9999999999) {
            finalReminder.date = d * 1000;
          }
        }
        
        // Final sanity check to avoid corrupt NaN values in DB
        if (isNaN(finalReminder.date)) {
          finalReminder = undefined;
        }
      }
    }

    let finalCountdown = result.countdownTarget || undefined;
    if (finalCountdown != null) {
      if (typeof finalCountdown === 'string') {
        const parsed = new Date(finalCountdown).getTime();
        if (!isNaN(parsed)) finalCountdown = parsed;
      } else if (typeof finalCountdown === 'number') {
        if (finalCountdown < 9999999999) finalCountdown = finalCountdown * 1000;
      }
      if (typeof finalCountdown !== 'number' || isNaN(finalCountdown)) finalCountdown = undefined;
    }

    return {
      title: result.title || null,
      category: result.category || undefined,
      tags: Array.isArray(result.tags) ? result.tags : undefined,
      refinedContent: result.refinedContent || text,
      isTodo: typeof result.isTodo === 'boolean' ? result.isTodo : (finalReminder ? true : undefined),
      reminder: finalReminder,
      isAmbiguous: typeof result.isAmbiguous === 'boolean' ? result.isAmbiguous : undefined,
      clarificationPrompt: result.clarificationPrompt || undefined,
      isStarred: typeof result.isStarred === 'boolean' ? result.isStarred : undefined,
      isPinned: typeof result.isPinned === 'boolean' ? result.isPinned : undefined,
      countdownTarget: finalCountdown,
    };
  } catch (error) {
    console.error("Failed to categorize thought:", error);
    return {
      refinedContent: text,
    };
  }
}
