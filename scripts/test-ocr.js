(async () => {
  const fetch = globalThis.fetch || (await import('node-fetch')).default;
  const barcode = '0030772047552';
  const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
  const data = await res.json();
  const product = data.product;
  console.log('nutrition image url:', product.image_nutrition_url);
  const Tesseract = await import('tesseract.js');
  console.log('Tesseract exports:', Object.keys(Tesseract).slice(0,20));
  try {
    // try both APIs
    let res;
    if (typeof Tesseract.recognize === 'function') {
      res = await Tesseract.recognize(product.image_nutrition_url, 'eng', { logger: m => {} });
    } else if (typeof Tesseract.createWorker === 'function') {
      const worker = Tesseract.createWorker({ logger: m => {} });
      // worker.load may not exist on some builds; try recognize directly
      if (typeof worker.recognize === 'function') {
        res = await worker.recognize(product.image_nutrition_url);
      }
    }
    const text = res?.data?.text ?? '';
    console.log('OCR text snippet:', String(text).slice(0, 400));
    const normalized = text.replace(/\u00A0/g, ' ').replace(/,/g, '.');
    const m = normalized.match(/serving\s*size[^0-9\n]*(\d+(?:\.\d+)?)\s*g/i) || normalized.match(/per\s*serving[^0-9\n]*(\d+(?:\.\d+)?)\s*g/i) || normalized.match(/(\d+(?:\.\d+)?)\s*g\b/i);
    console.log('match:', m && m[1]);
  } catch (err) {
    console.error('ocr error', err);
  }
})();