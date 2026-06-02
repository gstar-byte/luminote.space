import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT } from "../constants";

// @ts-ignore
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? (process.env.GEMINI_API_KEY || "") : "") || "";
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export async function categorizeThought(text: string): Promise<{ category?: string; tags?: string[]; refinedContent: string; isTodo?: boolean; reminder?: any; isAmbiguous?: boolean; clarificationPrompt?: string | null }> {
  if (!ai) {
    console.warn("Lumi Note Gemini AI Client: GoogleGenAI is not initialized because API Key is missing. Falling back to plain text note.");
    return { refinedContent: text };
  }
  try {
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
    
    // Add a 4 second timeout
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error("Gemini API timeout")), 4000)
    );
    
    const fetchPromise = ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const response = await Promise.race([fetchPromise, timeoutPromise]);

    const result = JSON.parse(response.text || "{}");
    
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
        
        // Final sanity check to avoid corrupt NaN values in Firestore
        if (isNaN(finalReminder.date)) {
          finalReminder = undefined;
        }
      }
    }

    return {
      category: result.category || undefined,
      tags: Array.isArray(result.tags) ? result.tags : undefined,
      refinedContent: result.refinedContent || text,
      isTodo: typeof result.isTodo === 'boolean' ? result.isTodo : (finalReminder ? true : undefined),
      reminder: finalReminder,
      isAmbiguous: typeof result.isAmbiguous === 'boolean' ? result.isAmbiguous : undefined,
      clarificationPrompt: result.clarificationPrompt || undefined,
    };
  } catch (error) {
    console.error("Failed to categorize thought:", error);
    return {
      refinedContent: text,
    };
  }
}
