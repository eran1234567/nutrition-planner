// Reproduce IngredientInput parsing logic for barcode 0030772047552
(async () => {
  const url = 'https://world.openfoodfacts.org/api/v0/product/0030772047552.json';
  const res = await fetch(url);
  const data = await res.json();
  const product = data.product;
  const nutriments = product.nutriments || {};

  const parseNumber = (val) => {
    if (val === null || val === undefined) return null;
    if (typeof val === 'string') {
      const num = parseFloat(val.replace(',', '.'));
      return Number.isNaN(num) ? null : num;
    }
    const n = Number(val);
    return Number.isNaN(n) ? null : n;
  };

  console.log('[Script] Raw API response sample:', {
    serving_quantity: product.serving_quantity,
    serving_size: product.serving_size,
    nutriments_sample: {
      'energy-kcal_100g': nutriments['energy-kcal_100g'],
      'energy-kcal_serving': nutriments['energy-kcal_serving'],
      'energy-kcal': nutriments['energy-kcal'],
      'carbohydrates_100g': nutriments['carbohydrates_100g'],
      'fiber_100g': nutriments['fiber_100g'],
      'sodium_100g': nutriments['sodium_100g'],
      'salt_100g': nutriments['salt_100g'],
    }
  });

  // serving grams
  let servingQuantityGrams = parseNumber(product.serving_quantity);
  if (!servingQuantityGrams && product.serving_size) {
    const gramsMatch = product.serving_size.match(/(\d+(?:[.,]\d+)?)\s*g(?:\)|$|\s)/i);
    if (gramsMatch) servingQuantityGrams = parseNumber(gramsMatch[1]);
    console.log('[Script] Extracted serving grams from string:', servingQuantityGrams);
  }

  const getCalories100g = () => {
    const kcalRaw = nutriments['energy-kcal_100g'];
    const kcalParsed = parseNumber(kcalRaw);
    if (kcalParsed !== null) {
      if (kcalParsed > 1000) return Math.round(kcalParsed / 4.184);
      return kcalParsed;
    }
    const kj = parseNumber(nutriments['energy_100g'] ?? nutriments['energy-kj_100g']);
    return kj ? Math.round(kj / 4.184) : null;
  };

  const getCaloriesServing = () => {
    const kcalServingRaw = nutriments['energy-kcal_serving'];
    const kcalParsedServing = parseNumber(kcalServingRaw);
    if (kcalParsedServing !== null) {
      if (kcalParsedServing > 1000) return Math.round(kcalParsedServing / 4.184);
      return kcalParsedServing;
    }
    // Only treat bare 'energy-kcal' as per-serving if product declares it
    const bareKcalRaw = product.nutrition_data_per === 'serving' ? nutriments['energy-kcal'] : null;
    const kcalParsedBare = parseNumber(bareKcalRaw);
    if (kcalParsedBare !== null) {
      if (kcalParsedBare > 1000) return Math.round(kcalParsedBare / 4.184);
      return kcalParsedBare;
    }
    const kj = parseNumber(nutriments['energy_serving'] ?? nutriments['energy-kj_serving']);
    return kj ? Math.round(kj / 4.184) : null;
  };

  const caloriesServing = getCaloriesServing();
  const proteinServing = parseNumber(nutriments['proteins_serving']);
  const carbsServing = parseNumber(nutriments['carbohydrates_serving']);
  const fatServing = parseNumber(nutriments['fat_serving']);
  const fiberServing = parseNumber(nutriments['fiber_serving']);
  const sugarServing = parseNumber(nutriments['sugars_serving']);
  const satFatServing = parseNumber(nutriments['saturated-fat_serving']);
  const cholesterolServing = parseNumber(nutriments['cholesterol_serving']);
  const sodiumServingRaw = parseNumber(nutriments['sodium_serving']) ?? parseNumber(nutriments['sodium']) ?? parseNumber(nutriments['sodium_value']);
  const saltServing = parseNumber(nutriments['salt_serving']) ?? parseNumber(nutriments['salt']);

  const normalizeSodium = (val) => {
    if (val === null) return null;
    if (Math.abs(val) < 10) return Math.round(val * 1000);
    return Math.round(val);
  };

  const sodiumServing = (() => {
    if (sodiumServingRaw !== null) return normalizeSodium(sodiumServingRaw);
    if (saltServing !== null) return Math.round(saltServing * 1000 * 0.393);
    return null;
  })();

  const cal100g = getCalories100g();
  const prot100g = parseNumber(nutriments['proteins_100g']);
  const carb100g = parseNumber(nutriments['carbohydrates_100g']);
  const fat100g = parseNumber(nutriments['fat_100g']);
  const fiber100g = parseNumber(nutriments['fiber_100g']);
  const sugar100g = parseNumber(nutriments['sugars_100g']);
  const satFat100g = parseNumber(nutriments['saturated-fat_100g']);
  const cholesterol100g = parseNumber(nutriments['cholesterol_100g']);
  const sodium100gRaw = parseNumber(nutriments['sodium_100g']) ?? parseNumber(nutriments['sodium']) ?? parseNumber(nutriments['sodium_value']);
  const salt100g = parseNumber(nutriments['salt_100g']) ?? parseNumber(nutriments['salt']);

  const sodium100g = (() => {
    if (sodium100gRaw !== null) return normalizeSodium(sodium100gRaw);
    if (salt100g !== null) return Math.round(salt100g * 1000 * 0.393);
    return null;
  })();

  const scaleFrom100g = (grams) => {
    const scaleFactor = grams / 100;
    return {
      calories: cal100g !== null ? Math.round(cal100g * scaleFactor) : undefined,
      protein: prot100g !== null ? Math.round(prot100g * scaleFactor * 10) / 10 : undefined,
      carbs: carb100g !== null ? Math.round(carb100g * scaleFactor * 10) / 10 : undefined,
      fat: fat100g !== null ? Math.round(fat100g * scaleFactor * 10) / 10 : undefined,
      fiber: fiber100g !== null ? Math.round(fiber100g * scaleFactor * 10) / 10 : undefined,
      sugar: sugar100g !== null ? Math.round(sugar100g * scaleFactor * 10) / 10 : undefined,
      saturatedFat: satFat100g !== null ? Math.round(satFat100g * scaleFactor * 10) / 10 : undefined,
      cholesterol: cholesterol100g !== null ? Math.round(cholesterol100g * scaleFactor * 10) / 10 : undefined,
      sodium: sodium100g !== null ? Math.round(sodium100g * scaleFactor * 10) / 10 : undefined,
    };
  };

  const scaled = servingQuantityGrams && servingQuantityGrams > 0 ? scaleFrom100g(servingQuantityGrams) : null;

  const servingDirect = {
    calories: caloriesServing ?? undefined,
    protein: proteinServing ?? undefined,
    carbs: carbsServing ?? undefined,
    fat: fatServing ?? undefined,
    fiber: fiberServing ?? undefined,
    sugar: sugarServing ?? undefined,
    saturatedFat: satFatServing ?? undefined,
    cholesterol: cholesterolServing ?? undefined,
    sodium: sodiumServing ?? undefined,
  };

  const hasServingCalories = caloriesServing !== null;
  const hasAnyServingMacro = proteinServing !== null || carbsServing !== null || fatServing !== null;

  const macroOff = (servVal, scaledVal) => {
    if (servVal === null || scaledVal === undefined) return false;
    const diff = Math.abs(servVal - scaledVal);
    const rel = diff / Math.max(0.1, scaledVal);
    return diff >= 0.5 && rel > 0.6;
  };
  const caloriesOff = () => {
    if (!scaled || caloriesServing === null || scaled.calories === undefined) return false;
    const diff = Math.abs(caloriesServing - scaled.calories);
    const rel = diff / Math.max(1, scaled.calories);
    if (diff >= 10 && rel > 0.35) return true;
    if (cal100g !== null && servingQuantityGrams && servingQuantityGrams < 80 && Math.abs(caloriesServing - cal100g) / Math.max(1, cal100g) < 0.05) return true;
    return false;
  };

  const shouldPreferScaled = !!scaled && (caloriesOff() || macroOff(fatServing, scaled.fat) || macroOff(carbsServing, scaled.carbs) || macroOff(proteinServing, scaled.protein));

  let calories, protein, carbs, fat, fiber, sugar, saturatedFat, cholesterol, sodium;

  if ((hasServingCalories || hasAnyServingMacro) && !shouldPreferScaled) {
    console.log('[Script] Using per-serving data (passed sanity check)');
    calories = servingDirect.calories ?? scaled?.calories;
    protein = servingDirect.protein ?? scaled?.protein;
    carbs = servingDirect.carbs ?? scaled?.carbs;
    fat = servingDirect.fat ?? scaled?.fat;
    fiber = servingDirect.fiber ?? scaled?.fiber;
    sugar = servingDirect.sugar ?? scaled?.sugar;
    saturatedFat = servingDirect.saturatedFat ?? scaled?.saturatedFat;
    cholesterol = servingDirect.cholesterol ?? scaled?.cholesterol;
    sodium = servingDirect.sodium ?? scaled?.sodium;
  } else if (scaled) {
    console.log('[Script] Using scaled-from-100g values (serving looked inconsistent)', { servingQuantityGrams, servingDirect, scaled });
    calories = scaled.calories;
    protein = scaled.protein;
    carbs = scaled.carbs;
    fat = scaled.fat;
    fiber = scaled.fiber;
    sugar = scaled.sugar;
    saturatedFat = scaled.saturatedFat;
    cholesterol = scaled.cholesterol;
    sodium = scaled.sodium;
  } else {
    console.warn('[Script] No serving grams available - using 100g values (may be inaccurate)');
    calories = cal100g ?? undefined;
    protein = prot100g ?? undefined;
    carbs = carb100g ?? undefined;
    fat = fat100g ?? undefined;
    fiber = fiber100g ?? undefined;
    sugar = sugar100g ?? undefined;
    saturatedFat = satFat100g ?? undefined;
    cholesterol = cholesterol100g ?? undefined;
    sodium = sodium100g ?? undefined;
  }

  const isCrazy = (v) => v !== undefined && (v > 1000 || v < 0);
  if ((isCrazy(calories) || isCrazy(carbs) || isCrazy(fiber)) && (hasServingCalories || hasAnyServingMacro)) {
    console.warn('[Script] Sanity check triggered: scaled values look unrealistic, preferring per-serving fields when available');
    calories = servingDirect.calories ?? calories;
    protein = servingDirect.protein ?? protein;
    carbs = servingDirect.carbs ?? carbs;
    fat = servingDirect.fat ?? fat;
    fiber = servingDirect.fiber ?? fiber;
    sugar = servingDirect.sugar ?? sugar;
    saturatedFat = servingDirect.saturatedFat ?? saturatedFat;
    cholesterol = servingDirect.cholesterol ?? cholesterol;
    sodium = servingDirect.sodium ?? sodium;
  }

  console.log('[Script] Final nutrition:', { calories, protein, carbs, fat, fiber, sugar, saturatedFat, cholesterol, sodium, hasServingCalories, servingQuantityGrams, shouldPreferScaled, productNutritionPer: product.nutrition_data_per });
})();
