import { GoogleGenAI } from "@google/genai";
import { Transaction } from "../types";

const apiKey = process.env.API_KEY || '';

// Lazily construct the client. `new GoogleGenAI({ apiKey: '' })` THROWS
// ("API key must be set"), so constructing it at module load crashed the whole
// app (white screen) on builds without a key. Build it on first use instead,
// and only when a key is actually present.
let ai: GoogleGenAI | null = null;
const getClient = (): GoogleGenAI | null => {
  if (!apiKey) return null;
  if (!ai) ai = new GoogleGenAI({ apiKey });
  return ai;
};

export const analyzeFinances = async (transactions: Transaction[], userQuery: string): Promise<string> => {
  const client = getClient();
  if (!client) {
    return "لطفاً کلید API را تنظیم کنید.";
  }

  const transactionContext = transactions.map(t => 
    `- ${t.date}: ${t.description} (${t.type === 'income' ? 'درآمد' : 'هزینه'}) - ${t.amount.toLocaleString('en-US')} تومان`
  ).join('\n');

  const systemPrompt = `
    شما یک مشاور مالی هوشمند و حرفه‌ای هستید که به زبان فارسی صحبت می‌کنید.
    وظیفه شما تحلیل داده‌های مالی کاربر و پاسخ به سوالات اوست.
    پاسخ‌ها باید کوتاه، دقیق و با لحنی رسمی اما دوستانه باشند.
    از فرمت‌دهی Markdown برای خوانایی بهتر استفاده کنید.
    واحد پول تومان است.
    
    داده‌های تراکنش‌های اخیر:
    ${transactionContext}
  `;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: userQuery,
      config: {
        systemInstruction: systemPrompt,
      },
    });

    return response.text || "متاسفانه نتوانستم پاسخی تولید کنم.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "خطایی در ارتباط با هوش مصنوعی رخ داد. لطفاً دوباره تلاش کنید.";
  }
};