// Smart product recognition using Gemini Pro Vision
// Identifies products from packaging and fetches verified nutrition data

import { supabase } from '@/integrations/supabase/client';

export async function identifyProductAndGetNutrition(
  imageUrl: string,
  timeoutMs = 15000
): Promise<{
  productName?: string;
  brand?: string;
  calories?: number | null;
  carbs?: number | null;
  fiber?: number | null;
  sodium?: number | null;
  servingGrams?: number | null;
  confidence?: number;
  source?: 'gemini' | 'database' | 'ocr';
} | null> {
  if (!imageUrl) return null;

  const geminiKey = import.meta.env.VITE_GOOGLE_GEMINI_API_KEY;
  
  try {
    // Step 1: Use Gemini Pro Vision to identify the product
    const productInfo = await identifyProductWithGemini(imageUrl, geminiKey, timeoutMs);
    
    if (!productInfo) {
      return null;
    }

    // Step 2: Try to look up product in our verified database
    if (productInfo.productName) {
      const dbNutrition = await lookupProductInDatabase(productInfo.productName, productInfo.brand);
      if (dbNutrition) {
        return {
          ...productInfo,
          ...dbNutrition,
          source: 'database',
          confidence: 0.95
        };
      }
    }

    // Step 3: If not in database, return Gemini's best guess
    return {
      ...productInfo,
      source: 'gemini',
      confidence: productInfo.confidence || 0.6
    };

  } catch (err) {
    return null;
  }
}

let lastGeminiRequestAt = 0;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function identifyProductWithGemini(
  imageUrl: string,
  apiKey: string,
  timeoutMs: number
): Promise<{
  productName?: string;
  brand?: string;
  calories?: number | null;
  carbs?: number | null;
  fiber?: number | null;
  sodium?: number | null;
  servingGrams?: number | null;
  confidence?: number;
} | null> {
  if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
    return null;
  }

  try {
    // Throttle: ensure no more than 1 request per 2 seconds
    const now = Date.now();
    const sinceLast = now - lastGeminiRequestAt;
    if (sinceLast < 2000) {
      await sleep(2000 - sinceLast);
    }
    lastGeminiRequestAt = Date.now();

    // Fetch image as base64
    const resp = await fetch(imageUrl, { cache: 'no-store' });
    if (!resp.ok) {
      return null;
    }
    const blob = await resp.blob();

    // Downscale to max width 768px to reduce token cost
    const downscaledBlob = await downscaleImageBlob(blob, 768);
    if (!downscaledBlob) {
      return null;
    }

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64Data = result.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(downscaledBlob);
    });

    const prompt = `You are a nutrition label expert. Analyze this product image and extract:
1. Product name (e.g., "Metamucil Fiber Supplement")
2. Brand name (e.g., "Procter & Gamble")
3. Nutrition facts per serving: calories, total carbs (g), dietary fiber (g), sodium (mg), serving size (g)
4. Your confidence level (0-1) in the identification

Format your response as JSON only, no other text:
{
  "productName": "string",
  "brand": "string", 
  "calories": number or null,
  "carbs": number or null,
  "fiber": number or null,
  "sodium": number or null,
  "servingGrams": number or null,
  "confidence": 0-1
}

If you cannot identify the product or read the nutrition label clearly, return null for uncertain fields and low confidence.`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const doRequest = async () => {
      const geminiPromise = fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: base64
                }
              }
            ]
          }]
        })
      });

      const geminiResp = await Promise.race([
        geminiPromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Gemini API timeout')), timeoutMs)
        )
      ]);

      if (!geminiResp.ok) {
        throw new Error(`Gemini failed: ${geminiResp.status}`);
      }

      const geminiData = await geminiResp.json();
      const responseText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

      // Parse JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error(`Could not parse JSON from Gemini response`);
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return parsed;
    };

    try {
      return await doRequest();
    } catch (err) {
      // Single retry after 5 seconds
      await sleep(5000);
      return await doRequest();
    }

  } catch (err) {
    return null;
  }
}

async function downscaleImageBlob(blob: Blob, maxWidth: number): Promise<Blob | null> {
  try {
    // Prefer createImageBitmap for performance
    try {
      // @ts-ignore
      const bitmap: ImageBitmap = await createImageBitmap(blob);
      const scale = Math.min(1, maxWidth / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        bitmap.close && bitmap.close();
        return null;
      }
      ctx.drawImage(bitmap, 0, 0, w, h);
      bitmap.close && bitmap.close();
      const smallBlob: Blob | null = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.8));
      return smallBlob;
    } catch (err) {
      // Fallback: load via Image element and draw
      const objUrl = URL.createObjectURL(blob);
      try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const i = new Image();
          i.crossOrigin = 'anonymous';
          i.onload = () => resolve(i);
          i.onerror = (ev) => reject(ev);
          i.src = objUrl;
        });
        const scale = Math.min(1, maxWidth / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
        const w = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
        const h = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objUrl);
          return null;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const smallBlob: Blob | null = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.8));
        URL.revokeObjectURL(objUrl);
        return smallBlob;
      } catch (err2) {
        try { URL.revokeObjectURL(objUrl); } catch (e) {}
        return null;
      }
    }
  } catch (err) {
    return null;
  }
}

async function lookupProductInDatabase(
  productName: string,
  brand?: string
): Promise<{
  calories?: number | null;
  carbs?: number | null;
  fiber?: number | null;
  sodium?: number | null;
  servingGrams?: number | null;
} | null> {
  try {
    const query = (supabase as any)
      .from('products')
      .select('product_name, brand, calories, carbs, fiber, sodium, serving_grams')
      .ilike('product_name', `%${productName}%`);

    const withBrand = brand ? query.ilike('brand', `%${brand}%`) : query;
    const { data, error } = await withBrand.limit(1).maybeSingle();

    if (error) {
      return null;
    }

    if (!data) return null;

    return {
      calories: data.calories ?? null,
      carbs: data.carbs ?? null,
      fiber: data.fiber ?? null,
      sodium: data.sodium ?? null,
      servingGrams: data.serving_grams ?? null,
    };

  } catch (err) {
    return null;
  }
}
