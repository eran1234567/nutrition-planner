// Lightweight OCR helper using tesseract.js
// Tries to extract a serving grams value (e.g., "11.7 g") from a product nutrition image.

export async function extractServingFromNutritionImage(imageUrl: string, timeoutMs = 7000): Promise<number | null> {
  if (!imageUrl) return null;

  // dynamic import so the large library is only loaded when actually used
  // Dynamically import tesseract; cast to any because types may not be present in project.
  const TesseractModule: any = await import('tesseract.js');
  const tesseractLib: any = TesseractModule?.default || TesseractModule;

  // Use a worker instance to be nicer on main thread / allow cancellation if needed
  const worker: any = tesseractLib.createWorker({
    logger: () => undefined,
  });

  const parseServingFromText = (text: string): number | null => {
    if (!text) return null;
    // Normalize whitespace and comma -> dot
    const normalized = text.replace(/\u00A0/g, ' ').replace(/,/g, '.');

    // Common patterns: "Serving size 11.7 g", "11.7 g", "11.7g (2 tsp)", "per serving 11.7 g"
    const regexes = [
      /serving\s*size[^0-9\n]*(\d+(?:\.\d+)?)\s*g/i,
      /per\s*serving[^0-9\n]*(\d+(?:\.\d+)?)\s*g/i,
      /(\d+(?:\.\d+)?)\s*g\b/i,
    ];

    for (const r of regexes) {
      const m = normalized.match(r);
      if (m && m[1]) {
        const val = parseFloat(m[1]);
        if (!Number.isNaN(val) && val > 0 && val < 1000) return val;
      }
    }

    return null;
  };

  try {
    await worker.load();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');

    // Run OCR with a timeout
    const p = worker.recognize(imageUrl).then((res: any) => res.data.text as string);
    const text: string = (await promiseTimeout(p, timeoutMs)) || '';
    const grams = parseServingFromText(text);

    await worker.terminate();
    return grams;
  } catch (err) {
    try { await worker.terminate(); } catch (_) {}
    console.warn('[OCR] failed', err);
    return null;
  }
}

function promiseTimeout<T>(p: Promise<T>, timeoutMs: number): Promise<T | null> {
  let timer: any;
  const timeout = new Promise<null>((res) => { timer = setTimeout(() => res(null), timeoutMs); });
  return Promise.race([p, timeout]).then((r) => { clearTimeout(timer); return r; });
}
