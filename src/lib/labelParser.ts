// Nutrition label parser using Google Cloud Vision API for OCR
// Returns parsed numbers (or null when not found)

export async function parseNutritionFromNutritionImage(imageUrl: string, timeoutMs = 15000) {
  if (!imageUrl) return null;

  const apiKey = import.meta.env.VITE_GOOGLE_VISION_API_KEY;
  if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
    return null;
  }

  const parseNumber = (s: string | null): number | null => {
    if (!s) return null;
    const cleaned = s.replace(/[,']/g, '.').replace(/[^\d.\-]/g, ' ');
    const m = cleaned.match(/(\d+(?:\.\d+)?)/);
    if (!m) return null;
    const n = parseFloat(m[1]);
    return Number.isNaN(n) ? null : n;
  };

  // Google Cloud Vision API pipeline: fetch image, convert to base64, send to API
  try {
    // Fetch the image as a blob (works for object URLs and remote URLs)
    const resp = await fetch(imageUrl, { cache: 'no-store' });
    if (!resp.ok) {
      return null;
    }
    const blob = await resp.blob();

    // Convert blob to base64
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
        const base64Data = result.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    // Call Google Cloud Vision API
    const visionUrl = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
    const visionResp = await Promise.race([
      fetch(visionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: base64 },
            features: [{ type: 'TEXT_DETECTION' }]
          }]
        })
      }),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Vision API timeout')), timeoutMs)
      )
    ]);

    if (!visionResp.ok) {
      return null;
    }

    const visionData = await visionResp.json();
    const text = visionData?.responses?.[0]?.textAnnotations?.[0]?.description ?? '';
    
    if (!text) {
      return null;
    }

    // Parse nutrition values from the extracted text
    const normalized = text.replace(/\u00A0/g, ' ').replace(/,/g, '.').toLowerCase();
    
    const find = (regex: RegExp, label: string) => {
      const m = normalized.match(regex);
      return m ? m[1] : null;
    };

    // Improved regex patterns for nutrition labels (handles multi-line format)
    // Use greedy matching to span across lines and extra text
    const caloriesStr = find(/calories[\s\S]*?(\d+)/, 'calories') 
      ?? find(/energy[\s\S]*?(\d+)\s*kcal/, 'energy');
    const cals = parseNumber(caloriesStr);

    const carbsStr = find(/total\s*carbohydrate[\s\S]*?(\d+)/, 'total carb') 
      ?? find(/carbohydrate[\s\S]*?(\d+)/, 'carbohydrate')
      ?? find(/carbs[\s\S]*?(\d+)/, 'carbs');
    const carbs = parseNumber(carbsStr);

    const fiberStr = find(/dietary\s*fiber[\s\S]*?(\d+)/, 'dietary fiber') 
      ?? find(/fiber[\s\S]*?(\d+)/, 'fiber') 
      ?? find(/fibre[\s\S]*?(\d+)/, 'fibre');
    const fiber = parseNumber(fiberStr);

    const sodiumStr = find(/sodium[\s\S]*?(\d+)/, 'sodium') 
      ?? find(/salt[\s\S]*?(\d+)/, 'salt');
    let sodium = parseNumber(sodiumStr);
    if (sodium !== null && sodium < 10) sodium = Math.round(sodium * 1000);

    const servingStr = find(/serving\s*size[\s\S]*?(\d+(?:\.\d+)?)\s*g/, 'serving size') 
      ?? find(/per\s*serving[\s\S]*?(\d+(?:\.\d+)?)\s*g/, 'per serving');
    const servingGrams = parseNumber(servingStr);

    const result = { calories: cals, carbs, fiber, sodium, servingGrams, rawText: text };
    return result;
  } catch (err) {
    return null;
  }
}
