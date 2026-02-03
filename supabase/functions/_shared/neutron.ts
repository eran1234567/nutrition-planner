/**
 * Neutron Engine - Shared Backend Module
 * 
 * This module provides centralized nutrition calculations for all edge functions.
 * It mirrors the frontend src/lib/neutron/ logic to ensure consistency.
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type NeutronMode = 'standard' | 'keto';

export interface RawNutritionData {
  calories?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  fiber_g?: number | null;
  sugar_g?: number | null;
  sodium_mg?: number | null;
  saturated_fat_g?: number | null;
  cholesterol_mg?: number | null;
  sugar_alcohols_g?: number | null;
}

export interface IngredientMacros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar?: number;
  sodium?: number;
  saturated_fat?: number;
  cholesterol?: number;
}

export interface DbIngredientNutrition {
  name: string;
  keywords: string[];
  serving_description: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  saturated_fat_g: number;
  cholesterol_mg: number;
}

export interface KetoScore {
  score: number;
  isKeto: boolean;
  penalties: {
    carbPenalty: number;
    proteinPenalty: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS - Single source of truth for all thresholds
// ═══════════════════════════════════════════════════════════════════════════

// Keto badge thresholds
export const KETO_BADGE_MAX_NET_CARBS = 10;      // ≤10g net carbs per serving
export const KETO_BADGE_MIN_FAT_PERCENT = 60;    // ≥60% of net energy from fat

// Keto score thresholds
export const KETO_SCORE_CARB_THRESHOLD = 5;     // Penalty starts after 5g net carbs
export const KETO_SCORE_CARB_PENALTY = 10;      // -10 points per gram over threshold
export const KETO_SCORE_PROTEIN_THRESHOLD = 35; // % of net energy
export const KETO_SCORE_PROTEIN_PENALTY = 5;    // -5 if protein > threshold

// Macro calorie multipliers
export const CALORIES_PER_GRAM = {
  fat: 9,
  protein: 4,
  carbs: 4,
} as const;

// Health badge thresholds
export const HEALTH_THRESHOLDS = {
  LOW_SODIUM_MAX: 300,
  KIDNEY_SODIUM_MAX: 400,
  KIDNEY_PROTEIN_MAX: 30,
  DIABETES_FIBER_MIN: 5,
  DIABETES_CARBS_MAX: 40,
  HEART_FIBER_MIN: 5,
  HEART_SODIUM_MAX: 300,
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// KETO SMART SWAP DICTIONARY
// ═══════════════════════════════════════════════════════════════════════════

export interface KetoSwapEntry {
  category: string;
  highCarbItem: string;
  keywords: string[]; // Keywords to match against ingredient names
  alternative: string;
  alternativeKeywords: string[]; // For lookup in ingredient_nutrition
  reason: string;
  estimatedCarbReduction: number; // Approximate net carb reduction per serving in grams
}

/**
 * Smart Swap Dictionary for Keto Optimization
 * Maps high-carb ingredients to keto-friendly alternatives
 */
export const KETO_SWAP_DICTIONARY: KetoSwapEntry[] = [
  {
    category: 'Grains',
    highCarbItem: 'Rice',
    keywords: ['rice', 'white rice', 'brown rice', 'jasmine rice', 'basmati'],
    alternative: 'Cauliflower Rice',
    alternativeKeywords: ['cauliflower rice', 'riced cauliflower'],
    reason: 'Drops net carbs by ~90%',
    estimatedCarbReduction: 40,
  },
  {
    category: 'Wraps',
    highCarbItem: 'Flour Tortilla / Bread',
    keywords: ['tortilla', 'flour tortilla', 'bread', 'wrap', 'pita', 'naan', 'flatbread'],
    alternative: 'Lettuce Wrap',
    alternativeKeywords: ['lettuce', 'lettuce wrap', 'butter lettuce', 'romaine'],
    reason: 'Eliminates nearly all grain-based carbs',
    estimatedCarbReduction: 25,
  },
  {
    category: 'Pasta',
    highCarbItem: 'Pasta / Noodles',
    keywords: ['pasta', 'spaghetti', 'noodle', 'noodles', 'penne', 'fettuccine', 'linguine', 'macaroni', 'lasagna'],
    alternative: 'Zucchini Noodles (Zoodles)',
    alternativeKeywords: ['zucchini noodles', 'zoodles', 'zucchini'],
    reason: 'High fiber, extremely low net carbs',
    estimatedCarbReduction: 35,
  },
  {
    category: 'Sides',
    highCarbItem: 'Potato',
    keywords: ['potato', 'potatoes', 'fries', 'french fries', 'mashed potato', 'hash brown'],
    alternative: 'Jicama or Zucchini',
    alternativeKeywords: ['jicama', 'zucchini', 'radish'],
    reason: 'Reduces starch significantly',
    estimatedCarbReduction: 30,
  },
  {
    category: 'Thickeners',
    highCarbItem: 'Cornstarch / Flour',
    keywords: ['cornstarch', 'corn starch', 'flour', 'all-purpose flour', 'wheat flour'],
    alternative: 'Xanthan Gum or Almond Flour',
    alternativeKeywords: ['xanthan gum', 'almond flour', 'coconut flour'],
    reason: 'Removes high-glycemic thickeners',
    estimatedCarbReduction: 10,
  },
  {
    category: 'Crunch',
    highCarbItem: 'Croutons / Crackers',
    keywords: ['crouton', 'croutons', 'cracker', 'crackers', 'breadcrumb', 'breadcrumbs', 'panko'],
    alternative: 'Pork Rinds or Parmesan Crisps',
    alternativeKeywords: ['pork rinds', 'parmesan crisps', 'chicharrones'],
    reason: 'Replaces carbs with protein/fat crunch',
    estimatedCarbReduction: 15,
  },
  {
    category: 'Sweeteners',
    highCarbItem: 'Sugar / Honey / Maple Syrup',
    keywords: ['sugar', 'honey', 'maple syrup', 'brown sugar', 'cane sugar', 'agave', 'molasses'],
    alternative: 'Allulose or Monk Fruit',
    alternativeKeywords: ['allulose', 'monk fruit', 'erythritol', 'stevia'],
    reason: 'Zero net carb impact',
    estimatedCarbReduction: 20,
  },
  {
    category: 'Milk',
    highCarbItem: 'Regular Milk',
    keywords: ['milk', 'whole milk', 'skim milk', '2% milk'],
    alternative: 'Unsweetened Almond Milk',
    alternativeKeywords: ['almond milk', 'coconut milk', 'unsweetened almond milk'],
    reason: 'Reduces sugar and carbs by ~75%',
    estimatedCarbReduction: 10,
  },
];

// USDA reference values for common ingredients (fallback if DB is empty)
export const USDA_REFERENCES: Record<string, IngredientMacros> = {
  // Eggs
  'egg': { calories: 72, protein: 6.3, carbs: 0.4, fat: 4.8, fiber: 0, cholesterol: 186, sodium: 71 },
  'eggs': { calories: 72, protein: 6.3, carbs: 0.4, fat: 4.8, fiber: 0, cholesterol: 186, sodium: 71 },
  'egg_yolk': { calories: 55, protein: 2.7, carbs: 0.6, fat: 4.5, fiber: 0, cholesterol: 184, sodium: 8 },
  'egg_white': { calories: 17, protein: 3.6, carbs: 0.2, fat: 0, fiber: 0, cholesterol: 0, sodium: 55 },
  
  // Avocado - must match plain "avocado" for deterministic lookups
  'avocado': { calories: 160, protein: 2, carbs: 8.5, fat: 14.7, fiber: 6.7, cholesterol: 0, sodium: 7 },
  'avocados': { calories: 160, protein: 2, carbs: 8.5, fat: 14.7, fiber: 6.7, cholesterol: 0, sodium: 7 },
  'avocado_half': { calories: 160, protein: 2, carbs: 8.5, fat: 14.7, fiber: 6.7, cholesterol: 0, sodium: 7 },
  'avocado_full': { calories: 322, protein: 4, carbs: 17, fat: 29, fiber: 13, cholesterol: 0, sodium: 14 },
  
  // Bread - generic bread for when specific type isn't mentioned
  'bread': { calories: 79, protein: 2.7, carbs: 15, fat: 1, fiber: 0.6, cholesterol: 0, sodium: 150 },
  'toast': { calories: 79, protein: 2.7, carbs: 15, fat: 1, fiber: 0.6, cholesterol: 0, sodium: 150 },
  'bread slice': { calories: 79, protein: 2.7, carbs: 15, fat: 1, fiber: 0.6, cholesterol: 0, sodium: 150 },
  'slices bread': { calories: 79, protein: 2.7, carbs: 15, fat: 1, fiber: 0.6, cholesterol: 0, sodium: 150 },
  'slice of bread': { calories: 79, protein: 2.7, carbs: 15, fat: 1, fiber: 0.6, cholesterol: 0, sodium: 150 },
  'white bread': { calories: 79, protein: 2.7, carbs: 15, fat: 1, fiber: 0.6, cholesterol: 0, sodium: 150 },
  'whole wheat bread': { calories: 81, protein: 4, carbs: 14, fat: 1.1, fiber: 1.9, cholesterol: 0, sodium: 146 },
  
  // Keto bread variations
  'keto_bread_slice': { calories: 60, protein: 6, carbs: 13, fat: 2.5, fiber: 12, cholesterol: 0, sodium: 150 },
  'keto bread': { calories: 60, protein: 6, carbs: 13, fat: 2.5, fiber: 12, cholesterol: 0, sodium: 150 },
  'keto bread slices': { calories: 60, protein: 6, carbs: 13, fat: 2.5, fiber: 12, cholesterol: 0, sodium: 150 },
  
  // Fats and oils
  'olive_oil_tbsp': { calories: 119, protein: 0, carbs: 0, fat: 13.5, fiber: 0, cholesterol: 0, sodium: 0 },
  'olive oil': { calories: 119, protein: 0, carbs: 0, fat: 13.5, fiber: 0, cholesterol: 0, sodium: 0 },
  'butter_tbsp': { calories: 102, protein: 0.1, carbs: 0, fat: 11.5, fiber: 0, cholesterol: 31, sodium: 91 },
  'butter': { calories: 102, protein: 0.1, carbs: 0, fat: 11.5, fiber: 0, cholesterol: 31, sodium: 91 },
  
  // Proteins
  'bacon_slice': { calories: 43, protein: 3, carbs: 0.1, fat: 3.3, fiber: 0, cholesterol: 9, sodium: 137 },
  'bacon': { calories: 43, protein: 3, carbs: 0.1, fat: 3.3, fiber: 0, cholesterol: 9, sodium: 137 },
  'chicken_breast': { calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, cholesterol: 85, sodium: 74 },
  'chicken breast': { calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, cholesterol: 85, sodium: 74 },
  'chicken': { calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, cholesterol: 85, sodium: 74 },
  'salmon': { calories: 208, protein: 20, carbs: 0, fat: 13, fiber: 0, cholesterol: 55, sodium: 59 },
  
  // Dairy
  'cheddar': { calories: 115, protein: 7, carbs: 0.5, fat: 9, fiber: 0, cholesterol: 28, sodium: 180 },
  'cheese': { calories: 115, protein: 7, carbs: 0.5, fat: 9, fiber: 0, cholesterol: 28, sodium: 180 },
  'cream_cheese': { calories: 99, protein: 2.1, carbs: 1.2, fat: 9.9, fiber: 0, cholesterol: 29, sodium: 89 },
  'cream cheese': { calories: 99, protein: 2.1, carbs: 1.2, fat: 9.9, fiber: 0, cholesterol: 29, sodium: 89 },
  'heavy_cream': { calories: 51, protein: 0.4, carbs: 0.4, fat: 5.4, fiber: 0, cholesterol: 20, sodium: 6 },
  'heavy cream': { calories: 51, protein: 0.4, carbs: 0.4, fat: 5.4, fiber: 0, cholesterol: 20, sodium: 6 },
  'milk': { calories: 42, protein: 3.4, carbs: 5, fat: 1, fiber: 0, cholesterol: 5, sodium: 44 },
  
  // Keto alternatives
  'cauliflower_rice': { calories: 25, protein: 2, carbs: 5, fat: 0.3, fiber: 2, cholesterol: 0, sodium: 30 },
  'cauliflower rice': { calories: 25, protein: 2, carbs: 5, fat: 0.3, fiber: 2, cholesterol: 0, sodium: 30 },
  'zucchini_noodles': { calories: 20, protein: 1.5, carbs: 4, fat: 0.4, fiber: 1.2, cholesterol: 0, sodium: 10 },
  'zucchini noodles': { calories: 20, protein: 1.5, carbs: 4, fat: 0.4, fiber: 1.2, cholesterol: 0, sodium: 10 },
  'zoodles': { calories: 20, protein: 1.5, carbs: 4, fat: 0.4, fiber: 1.2, cholesterol: 0, sodium: 10 },
  'lettuce_wrap': { calories: 5, protein: 0.5, carbs: 1, fat: 0.1, fiber: 0.5, cholesterol: 0, sodium: 5 },
  'lettuce wrap': { calories: 5, protein: 0.5, carbs: 1, fat: 0.1, fiber: 0.5, cholesterol: 0, sodium: 5 },
  'almond_flour': { calories: 160, protein: 6, carbs: 6, fat: 14, fiber: 3, cholesterol: 0, sodium: 0 },
  'almond flour': { calories: 160, protein: 6, carbs: 6, fat: 14, fiber: 3, cholesterol: 0, sodium: 0 },
  'pork_rinds': { calories: 80, protein: 9, carbs: 0, fat: 5, fiber: 0, cholesterol: 20, sodium: 270 },
  'pork rinds': { calories: 80, protein: 9, carbs: 0, fat: 5, fiber: 0, cholesterol: 20, sodium: 270 },
  'allulose': { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, cholesterol: 0, sodium: 0 },
  
  // Common vegetables
  'tomato': { calories: 22, protein: 1.1, carbs: 4.8, fat: 0.2, fiber: 1.5, cholesterol: 0, sodium: 5 },
  'onion': { calories: 44, protein: 1.2, carbs: 10, fat: 0.1, fiber: 1.4, cholesterol: 0, sodium: 4 },
  'garlic': { calories: 4, protein: 0.2, carbs: 1, fat: 0, fiber: 0.1, cholesterol: 0, sodium: 1 },
  'spinach': { calories: 7, protein: 0.9, carbs: 1.1, fat: 0.1, fiber: 0.7, cholesterol: 0, sodium: 24 },
};

// ═══════════════════════════════════════════════════════════════════════════
// CORE CALCULATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate net carbs: Total Carbs - Fiber - Sugar Alcohols
 */
export function calculateNetCarbs(
  totalCarbs: number,
  fiber: number,
  sugarAlcohols: number = 0
): number {
  return Math.max(0, totalCarbs - fiber - sugarAlcohols);
}

/**
 * Calculate standard energy: (Fat * 9) + (Protein * 4) + (Total Carbs * 4)
 */
export function calculateStandardEnergy(
  fat: number,
  protein: number,
  totalCarbs: number
): number {
  return (
    fat * CALORIES_PER_GRAM.fat +
    protein * CALORIES_PER_GRAM.protein +
    totalCarbs * CALORIES_PER_GRAM.carbs
  );
}

/**
 * Calculate net energy (keto mode): (Fat * 9) + (Protein * 4) + (Net Carbs * 4)
 * IMPORTANT: This is the correct calorie formula for high-fiber foods
 */
export function calculateNetEnergy(
  fat: number,
  protein: number,
  netCarbs: number
): number {
  return (
    fat * CALORIES_PER_GRAM.fat +
    protein * CALORIES_PER_GRAM.protein +
    netCarbs * CALORIES_PER_GRAM.carbs
  );
}

/**
 * Calculate macro percentages based on the given energy base
 */
export function calculateMacroPercents(
  fat: number,
  protein: number,
  carbs: number,
  energyBase: number
): { fatPercent: number; proteinPercent: number; carbPercent: number } {
  if (energyBase <= 0) {
    return { fatPercent: 0, proteinPercent: 0, carbPercent: 0 };
  }

  const fatCals = fat * CALORIES_PER_GRAM.fat;
  const proteinCals = protein * CALORIES_PER_GRAM.protein;
  const carbCals = carbs * CALORIES_PER_GRAM.carbs;

  return {
    fatPercent: Math.round((fatCals / energyBase) * 100),
    proteinPercent: Math.round((proteinCals / energyBase) * 100),
    carbPercent: Math.round((carbCals / energyBase) * 100),
  };
}

/**
 * Check if recipe qualifies for KETO badge
 * - Net Carbs ≤ 10g per serving
 * - Fat ≥ 60% of Net Energy
 */
export function isKetoBadgeEligible(
  netCarbs: number,
  fat: number,
  protein: number
): boolean {
  if (netCarbs > KETO_BADGE_MAX_NET_CARBS) {
    return false;
  }

  const netEnergy = calculateNetEnergy(fat, protein, netCarbs);
  if (netEnergy <= 0) return false;

  const fatCals = fat * CALORIES_PER_GRAM.fat;
  const fatPercent = (fatCals / netEnergy) * 100;

  return fatPercent >= KETO_BADGE_MIN_FAT_PERCENT;
}

/**
 * Calculate Keto Score (0-100)
 */
export function calculateKetoScore(
  netCarbs: number,
  fat: number,
  protein: number
): KetoScore {
  let score = 100;
  const penalties = { carbPenalty: 0, proteinPenalty: 0 };

  // Carb penalty: -10 per gram over 5g
  if (netCarbs > KETO_SCORE_CARB_THRESHOLD) {
    penalties.carbPenalty = Math.round(
      (netCarbs - KETO_SCORE_CARB_THRESHOLD) * KETO_SCORE_CARB_PENALTY
    );
    score -= penalties.carbPenalty;
  }

  // Protein penalty: -5 if > 35% of net energy
  const netEnergy = calculateNetEnergy(fat, protein, netCarbs);
  if (netEnergy > 0) {
    const proteinCals = protein * CALORIES_PER_GRAM.protein;
    const proteinPercent = (proteinCals / netEnergy) * 100;
    
    if (proteinPercent > KETO_SCORE_PROTEIN_THRESHOLD) {
      penalties.proteinPenalty = KETO_SCORE_PROTEIN_PENALTY;
      score -= penalties.proteinPenalty;
    }
  }

  score = Math.max(0, Math.min(100, score));
  const isKeto = isKetoBadgeEligible(netCarbs, fat, protein);

  return { score, isKeto, penalties };
}

// ═══════════════════════════════════════════════════════════════════════════
// INGREDIENT LOOKUP
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Find best matching ingredient in cache using keyword scoring
 */
export function findIngredientInCache(
  text: string,
  cache: DbIngredientNutrition[]
): DbIngredientNutrition | null {
  const lowerText = text.toLowerCase();
  
  let bestMatch: DbIngredientNutrition | null = null;
  let bestScore = 0;
  
  for (const item of cache) {
    for (const keyword of item.keywords) {
      const lowerKeyword = keyword.toLowerCase();
      
      if (lowerText.includes(lowerKeyword)) {
        const score = lowerKeyword.length;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = item;
        }
      }
    }
  }
  
  return bestMatch;
}

/**
 * Parse ingredient quantity from text
 */
export function parseIngredientQuantity(text: string): number {
  const trimmed = text.trim();
  const halfStart = /^(?:half\b|0\.5\b|1\/2\b)/i.test(trimmed);
  if (halfStart) {
    // Special-case: our reference table uses 100g servings for avocado.
    // In our prompts and UX, "half avocado" is treated as ~100g (i.e., 1× the 100g reference),
    // not 0.5× of it.
    if (/\bavocado\b/i.test(trimmed)) return 1;
    return 0.5;
  }

  const numMatch = trimmed.match(/^(\d+\.?\d*)/);
  return numMatch ? Number.parseFloat(numMatch[1]) : 1;
}

/**
 * Extract explicit macros from ingredient text (e.g., "Keto Bread (60 cal, 13g carbs)")
 */
export function extractExplicitMacros(text: string): Partial<IngredientMacros> | null {
  const result: Partial<IngredientMacros> = {};
  let hasExplicit = false;
  
  const calMatch = text.match(/(\d+\.?\d*)\s*(?:cal(?:orie)?s?)\b/i);
  if (calMatch) {
    result.calories = parseFloat(calMatch[1]);
    hasExplicit = true;
  }
  
  const proteinMatch = text.match(/(\d+\.?\d*)\s*g?\s*protein/i);
  if (proteinMatch) {
    result.protein = parseFloat(proteinMatch[1]);
    hasExplicit = true;
  }
  
  const fatMatch = text.match(/(\d+\.?\d*)\s*g?\s*fat/i);
  if (fatMatch) {
    result.fat = parseFloat(fatMatch[1]);
    hasExplicit = true;
  }
  
  const carbMatch = text.match(/(\d+\.?\d*)\s*g?\s*carb(?:ohydrate)?s?/i);
  if (carbMatch) {
    result.carbs = parseFloat(carbMatch[1]);
    hasExplicit = true;
  }
  
  const fiberMatch = text.match(/(\d+\.?\d*)\s*g?\s*fiber/i);
  if (fiberMatch) {
    result.fiber = parseFloat(fiberMatch[1]);
    hasExplicit = true;
  }

  const sugarMatch = text.match(/(\d+\.?\d*)\s*g?\s*sugar/i);
  if (sugarMatch) {
    result.sugar = parseFloat(sugarMatch[1]);
    hasExplicit = true;
  }

  const sodiumMatch = text.match(/(\d+\.?\d*)\s*(?:mg)?\s*sodium/i);
  if (sodiumMatch) {
    result.sodium = parseFloat(sodiumMatch[1]);
    hasExplicit = true;
  }
  
  return hasExplicit ? result : null;
}

/**
 * Calculate macros for a single ingredient using priority hierarchy:
 * 1. Explicit user-provided values in text
 * 2. Database reference table lookup
 * 3. USDA fallback constants
 * 4. Return null (let AI estimate)
 */
export function calculateIngredientMacros(
  ingredientText: string,
  cache: DbIngredientNutrition[]
): IngredientMacros | null {
  const quantity = parseIngredientQuantity(ingredientText);
  
  // Priority 1: Explicit macros in text
  const explicit = extractExplicitMacros(ingredientText);
  if (explicit && explicit.calories !== undefined) {
    return {
      calories: (explicit.calories ?? 0) * quantity,
      protein: (explicit.protein ?? 0) * quantity,
      carbs: (explicit.carbs ?? 0) * quantity,
      fat: (explicit.fat ?? 0) * quantity,
      fiber: (explicit.fiber ?? 0) * quantity,
      sugar: (explicit.sugar ?? 0) * quantity,
      sodium: (explicit.sodium ?? 0) * quantity,
    };
  }
  
  // Priority 2: Database lookup
  const dbMatch = findIngredientInCache(ingredientText, cache);
  if (dbMatch) {
    return {
      calories: dbMatch.calories * quantity,
      protein: dbMatch.protein_g * quantity,
      carbs: dbMatch.carbs_g * quantity,
      fat: dbMatch.fat_g * quantity,
      fiber: dbMatch.fiber_g * quantity,
      sugar: dbMatch.sugar_g * quantity,
      sodium: dbMatch.sodium_mg * quantity,
      saturated_fat: dbMatch.saturated_fat_g * quantity,
      cholesterol: dbMatch.cholesterol_mg * quantity,
    };
  }
  
  // Priority 3: USDA fallback
  const lowerText = ingredientText.toLowerCase();
  for (const [key, macros] of Object.entries(USDA_REFERENCES)) {
    if (lowerText.includes(key.replace(/_/g, ' ')) || lowerText.includes(key)) {
      return {
        calories: macros.calories * quantity,
        protein: macros.protein * quantity,
        carbs: macros.carbs * quantity,
        fat: macros.fat * quantity,
        fiber: macros.fiber * quantity,
        sugar: (macros.sugar ?? 0) * quantity,
        sodium: (macros.sodium ?? 0) * quantity,
        saturated_fat: (macros.saturated_fat ?? 0) * quantity,
        cholesterol: (macros.cholesterol ?? 0) * quantity,
      };
    }
  }
  
  // Priority 4: Return null - let AI estimate
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// HEALTH BADGE DETECTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detect health badges based on nutritional thresholds
 */
export function detectHealthBadges(nutrition: RawNutritionData | null): string[] {
  if (!nutrition) return [];

  const badges: string[] = [];
  const { protein_g, carbs_g, fiber_g, sodium_mg } = nutrition;

  // Diabetes Friendly
  if (fiber_g != null && carbs_g != null) {
    if (fiber_g >= HEALTH_THRESHOLDS.DIABETES_FIBER_MIN && 
        carbs_g < HEALTH_THRESHOLDS.DIABETES_CARBS_MAX) {
      badges.push('diabetes-friendly');
    }
  }

  // Heart Healthy
  if (fiber_g != null && sodium_mg != null) {
    if (fiber_g >= HEALTH_THRESHOLDS.HEART_FIBER_MIN && 
        sodium_mg < HEALTH_THRESHOLDS.HEART_SODIUM_MAX) {
      badges.push('heart-healthy');
    }
  }

  // Low Sodium
  if (sodium_mg != null && sodium_mg < HEALTH_THRESHOLDS.LOW_SODIUM_MAX) {
    badges.push('low-sodium');
  }

  // Kidney Friendly
  if (sodium_mg != null && protein_g != null) {
    if (sodium_mg < HEALTH_THRESHOLDS.KIDNEY_SODIUM_MAX && 
        protein_g < HEALTH_THRESHOLDS.KIDNEY_PROTEIN_MAX) {
      badges.push('kidney-friendly');
    }
  }

  return badges;
}

/**
 * Auto-detect diet badges including keto
 */
export function detectDietBadges(nutrition: RawNutritionData | null): string[] {
  if (!nutrition) return [];

  const badges: string[] = [];
  
  const netCarbs = calculateNetCarbs(
    nutrition.carbs_g ?? 0,
    nutrition.fiber_g ?? 0,
    nutrition.sugar_alcohols_g ?? 0
  );
  
  const ketoScore = calculateKetoScore(
    netCarbs,
    nutrition.fat_g ?? 0,
    nutrition.protein_g ?? 0
  );
  
  if (ketoScore.isKeto) {
    badges.push('keto');
  }

  return badges;
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validate and correct AI-generated nutrition using deterministic calculations
 */
export function validateAndCorrectNutrition(
  aiNutrition: RawNutritionData,
  ingredients: Array<{ name: string }>,
  cache: DbIngredientNutrition[],
  servings: number = 1
): RawNutritionData {
  // Calculate deterministic totals from known ingredients
  let deterministicTotal: IngredientMacros = {
    calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0,
    sugar: 0, sodium: 0, saturated_fat: 0, cholesterol: 0
  };
  let knownCount = 0;

  for (const ing of ingredients) {
    const macros = calculateIngredientMacros(ing.name, cache);
    if (macros) {
      deterministicTotal.calories += macros.calories;
      deterministicTotal.protein += macros.protein;
      deterministicTotal.carbs += macros.carbs;
      deterministicTotal.fat += macros.fat;
      deterministicTotal.fiber += macros.fiber;
      deterministicTotal.sugar = (deterministicTotal.sugar ?? 0) + (macros.sugar ?? 0);
      deterministicTotal.sodium = (deterministicTotal.sodium ?? 0) + (macros.sodium ?? 0);
      deterministicTotal.saturated_fat = (deterministicTotal.saturated_fat ?? 0) + (macros.saturated_fat ?? 0);
      deterministicTotal.cholesterol = (deterministicTotal.cholesterol ?? 0) + (macros.cholesterol ?? 0);
      knownCount++;
    }
  }

  // If we have deterministic data for most ingredients, use it
  if (knownCount >= ingredients.length * 0.7) {
    return {
      calories: Math.round(deterministicTotal.calories / servings),
      protein_g: Math.round(deterministicTotal.protein / servings),
      carbs_g: Math.round(deterministicTotal.carbs / servings),
      fat_g: Math.round(deterministicTotal.fat / servings),
      fiber_g: Math.round(deterministicTotal.fiber / servings),
      sugar_g: Math.round((deterministicTotal.sugar ?? 0) / servings),
      sodium_mg: Math.round((deterministicTotal.sodium ?? 0) / servings),
      saturated_fat_g: Math.round((deterministicTotal.saturated_fat ?? 0) / servings),
      cholesterol_mg: Math.round((deterministicTotal.cholesterol ?? 0) / servings),
    };
  }

  // Otherwise return AI values with overrides for known ingredients
  return aiNutrition;
}

/**
 * Build AI prompt with USDA references (for functions that still need AI estimation)
 */
export function buildNutritionPromptInstructions(): string {
  return `═══════════════════════════════════════════════════════════════
FIBER AND NET CARBS - CRITICAL FOR CALORIE ACCURACY
═══════════════════════════════════════════════════════════════
FIBER DOES NOT CONTRIBUTE CALORIES! This is critical for keto/high-fiber foods.

When calculating calories from carbs:
- NET CARBS = Total Carbs - Fiber
- CALORIES from carbs = NET CARBS × 4 (NOT total carbs × 4!)

CALORIE CALCULATION HIERARCHY:
1. If user provides CALORIES for an ingredient → USE THAT EXACT VALUE
2. If NO calories provided → Calculate: (protein × 4) + (NET carbs × 4) + (fat × 9)

KETO BADGE CRITERIA (auto-detected):
- Net Carbs ≤ ${KETO_BADGE_MAX_NET_CARBS}g per serving
- Fat ≥ ${KETO_BADGE_MIN_FAT_PERCENT}% of net energy`;
}

// ═══════════════════════════════════════════════════════════════════════════
// KETO OPTIMIZATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════

export interface KetoOptimizationResult {
  isKeto: boolean;
  ketoScore: KetoScore;
  suggestions: KetoOptimizationSuggestion[];
  swapSuggestions: KetoSwapSuggestion[];
  canAutoOptimize: boolean;
}

export interface KetoOptimizationSuggestion {
  type: 'reduce_carbs' | 'add_fat' | 'balance_protein';
  priority: 'high' | 'medium' | 'low';
  message: string;
  action?: {
    ingredient?: string;
    amount?: number;
    unit?: string;
    impact?: string;
  };
}

export interface KetoSwapSuggestion {
  originalIngredient: string;
  swapTo: string;
  category: string;
  reason: string;
  estimatedCarbReduction: number;
  matchedKeyword: string;
}

export interface IngredientWithMacros {
  name: string;
  macros?: IngredientMacros | null;
  quantity?: number;
  unit?: string;
}

/**
 * Normalize an ingredient name for comparison (lowercase, trim, remove common descriptors)
 */
function normalizeIngredientName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^(fresh|organic|chopped|diced|minced|sliced)\s+/i, '')
    .replace(/\s+(fresh|organic|chopped|diced|minced|sliced)$/i, '');
}

/**
 * Check if the current ingredient is already the keto-friendly alternative
 */
function isAlreadyKetoAlternative(ingredientName: string, alternative: string, alternativeKeywords: string[]): boolean {
  const lowerName = normalizeIngredientName(ingredientName);
  const lowerAlt = normalizeIngredientName(alternative);
  
  // Direct match check
  if (lowerName.includes(lowerAlt) || lowerAlt.includes(lowerName)) {
    return true;
  }
  
  // Check against alternative keywords
  for (const altKeyword of alternativeKeywords) {
    if (lowerName.includes(altKeyword.toLowerCase())) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get refined alternative for ingredients that are already somewhat keto-friendly
 * Returns a better suggestion or null if no better alternative exists
 */
function getRefinedAlternative(ingredientName: string, swapEntry: KetoSwapEntry): { alternative: string; reason: string } | null {
  const lowerName = normalizeIngredientName(ingredientName);
  
  // Special case: Almond Flour is already keto-friendly
  // If it matches 'flour' keyword but IS almond flour, suggest Xanthan Gum or skip
  if (lowerName.includes('almond flour') || lowerName.includes('almond meal')) {
    // Only suggest alternatives if this is from the Thickeners category
    if (swapEntry.category === 'Thickeners') {
      return {
        alternative: 'Xanthan Gum',
        reason: 'Zero-carb thickening without almond flour bulk',
      };
    }
    // For Crunch category, suggest pork rinds
    if (swapEntry.category === 'Crunch') {
      return {
        alternative: 'Pork Rind Panko',
        reason: 'Zero-carb breading alternative',
      };
    }
    return null; // Almond flour is already keto-friendly, no swap needed
  }
  
  // Coconut flour is also low-carb, don't suggest swapping
  if (lowerName.includes('coconut flour')) {
    return null;
  }
  
  return null; // Use default swap
}

/**
 * Find applicable swaps for ingredients based on the KETO_SWAP_DICTIONARY
 * Includes deduplication to prevent suggesting the same ingredient as source/target
 */
export function findKetoSwaps(ingredientNames: string[]): KetoSwapSuggestion[] {
  const swaps: KetoSwapSuggestion[] = [];
  
  for (const ingName of ingredientNames) {
    const lowerName = ingName.toLowerCase();
    
    for (const swapEntry of KETO_SWAP_DICTIONARY) {
      for (const keyword of swapEntry.keywords) {
        if (lowerName.includes(keyword)) {
          // DEDUPLICATION: Check if ingredient is already the keto alternative
          if (isAlreadyKetoAlternative(ingName, swapEntry.alternative, swapEntry.alternativeKeywords)) {
            break; // Skip - already using the keto-friendly version
          }
          
          // Check if we need a refined alternative (e.g., almond flour → xanthan gum)
          const refined = getRefinedAlternative(ingName, swapEntry);
          if (refined === null && lowerName.includes('almond') && swapEntry.alternative.toLowerCase().includes('almond')) {
            break; // Skip - almond flour doesn't need to be swapped for almond flour
          }
          
          const alternative = refined?.alternative ?? swapEntry.alternative;
          const reason = refined?.reason ?? swapEntry.reason;
          
          // Final check: ensure source and target are different
          const normalizedSource = normalizeIngredientName(ingName);
          const normalizedTarget = normalizeIngredientName(alternative);
          if (normalizedSource.includes(normalizedTarget) || normalizedTarget.includes(normalizedSource)) {
            break; // Skip identical swaps
          }
          
          swaps.push({
            originalIngredient: ingName,
            swapTo: alternative,
            category: swapEntry.category,
            reason: reason,
            estimatedCarbReduction: swapEntry.estimatedCarbReduction,
            matchedKeyword: keyword,
          });
          break; // One swap per ingredient
        }
      }
    }
  }
  
  return swaps;
}

/**
 * Keto Optimization Engine
 * Analyzes nutrition data and provides actionable suggestions to achieve/improve keto compliance
 */
export function getKetoOptimization(
  nutrition: RawNutritionData | null | undefined,
  ingredients?: IngredientWithMacros[]
): KetoOptimizationResult {
  const suggestions: KetoOptimizationSuggestion[] = [];
  let swapSuggestions: KetoSwapSuggestion[] = [];
  
  if (!nutrition) {
    return {
      isKeto: false,
      ketoScore: { score: 0, isKeto: false, penalties: { carbPenalty: 0, proteinPenalty: 0 } },
      suggestions: [{
        type: 'reduce_carbs',
        priority: 'high',
        message: 'No nutrition data available. Add ingredients with macros to analyze.',
      }],
      swapSuggestions: [],
      canAutoOptimize: false,
    };
  }

  const protein = nutrition.protein_g ?? 0;
  const fat = nutrition.fat_g ?? 0;
  const totalCarbs = nutrition.carbs_g ?? 0;
  const fiber = nutrition.fiber_g ?? 0;
  const sugarAlcohols = nutrition.sugar_alcohols_g ?? 0;

  const netCarbs = calculateNetCarbs(totalCarbs, fiber, sugarAlcohols);
  const netEnergy = calculateNetEnergy(fat, protein, netCarbs);
  const ketoScore = calculateKetoScore(netCarbs, fat, protein);
  const percents = calculateMacroPercents(fat, protein, netCarbs, netEnergy);

  // Check for smart swaps if we have ingredients
  if (ingredients && ingredients.length > 0) {
    const ingredientNames = ingredients.map(ing => ing.name);
    swapSuggestions = findKetoSwaps(ingredientNames);
  }

  // === CASE 1: Not Keto due to high carbs (> 10g net carbs) ===
  if (netCarbs > KETO_BADGE_MAX_NET_CARBS) {
    const carbExcess = netCarbs - KETO_BADGE_MAX_NET_CARBS;
    
    // Check if we have a swap suggestion that could fix this
    if (swapSuggestions.length > 0) {
      // Find the best swap (highest carb reduction)
      const bestSwap = swapSuggestions.reduce((best, current) => 
        current.estimatedCarbReduction > best.estimatedCarbReduction ? current : best
      );
      
      if (bestSwap.estimatedCarbReduction >= carbExcess) {
        const newEstimatedNetCarbs = Math.max(0, netCarbs - bestSwap.estimatedCarbReduction);
        suggestions.push({
          type: 'reduce_carbs',
          priority: 'high',
          message: `Your Net Carbs are too high (${netCarbs.toFixed(0)}g). Swap the ${bestSwap.originalIngredient} for ${bestSwap.swapTo} to drop to ~${newEstimatedNetCarbs.toFixed(0)}g and earn the KETO badge!`,
          action: {
            ingredient: bestSwap.swapTo,
            impact: `-${bestSwap.estimatedCarbReduction}g net carbs`,
          },
        });
      } else {
        // Swap helps but isn't enough
        suggestions.push({
          type: 'reduce_carbs',
          priority: 'high',
          message: `Net carbs (${netCarbs.toFixed(1)}g) exceed the 10g limit. Swap ${bestSwap.originalIngredient} → ${bestSwap.swapTo} to reduce by ~${bestSwap.estimatedCarbReduction}g carbs.`,
          action: {
            ingredient: bestSwap.swapTo,
            impact: `-${bestSwap.estimatedCarbReduction}g net carbs`,
          },
        });
      }
    } else {
      // No swap available - fall back to generic reduction message
      let highCarbIngredient: IngredientWithMacros | null = null;
      let highestNetCarbs = 0;
      
      if (ingredients && ingredients.length > 0) {
        for (const ing of ingredients) {
          if (ing.macros) {
            const ingNetCarbs = calculateNetCarbs(
              ing.macros.carbs,
              ing.macros.fiber,
              0
            );
            if (ingNetCarbs > highestNetCarbs) {
              highestNetCarbs = ingNetCarbs;
              highCarbIngredient = ing;
            }
          }
        }
      }

      if (highCarbIngredient && highestNetCarbs > carbExcess) {
        const reductionNeeded = Math.ceil(carbExcess);
        const currentQty = highCarbIngredient.quantity || 1;
        const carbsPerUnit = highestNetCarbs / currentQty;
        const unitsToReduce = Math.ceil(carbExcess / carbsPerUnit);
        const newQty = Math.max(0, currentQty - unitsToReduce);
        
        suggestions.push({
          type: 'reduce_carbs',
          priority: 'high',
          message: `Reduce "${highCarbIngredient.name}" from ${currentQty} to ${newQty} ${highCarbIngredient.unit || 'units'} to earn the KETO badge.`,
          action: {
            ingredient: highCarbIngredient.name,
            amount: newQty,
            unit: highCarbIngredient.unit,
            impact: `-${reductionNeeded}g net carbs`,
          },
        });
      } else {
        suggestions.push({
          type: 'reduce_carbs',
          priority: 'high',
          message: `Net carbs (${netCarbs.toFixed(1)}g) exceed the 10g limit by ${carbExcess.toFixed(1)}g. Reduce high-carb ingredients to qualify for KETO.`,
        });
      }
    }
  }

  // === CASE 2: Not Keto due to low fat (< 60%) ===
  if (percents.fatPercent < KETO_BADGE_MIN_FAT_PERCENT) {
    // Calculate fat needed to reach 60.1%
    // Target: fat_cals / (fat_cals + protein_cals + carb_cals) = 0.601
    // Let x = additional fat grams needed
    // (fat + x) * 9 / ((fat + x) * 9 + protein * 4 + netCarbs * 4) = 0.601
    // Solve for x:
    const targetFatPercent = 0.601;
    const proteinCals = protein * CALORIES_PER_GRAM.protein;
    const carbCals = netCarbs * CALORIES_PER_GRAM.carbs;
    const nonFatCals = proteinCals + carbCals;
    
    // fat_cals = 0.601 * (fat_cals + nonFatCals)
    // fat_cals = 0.601 * fat_cals + 0.601 * nonFatCals
    // fat_cals - 0.601 * fat_cals = 0.601 * nonFatCals
    // fat_cals * (1 - 0.601) = 0.601 * nonFatCals
    // fat_cals = (0.601 * nonFatCals) / 0.399
    const targetFatCals = (targetFatPercent * nonFatCals) / (1 - targetFatPercent);
    const currentFatCals = fat * CALORIES_PER_GRAM.fat;
    const additionalFatCalsNeeded = Math.max(0, targetFatCals - currentFatCals);
    const additionalFatGrams = Math.ceil(additionalFatCalsNeeded / CALORIES_PER_GRAM.fat);

    if (additionalFatGrams > 0) {
      // Suggest olive oil (1 tbsp = 13.5g fat) or butter (1 tbsp = 11.5g fat)
      const oliveOilTbsp = Math.ceil(additionalFatGrams / 13.5);
      
      suggestions.push({
        type: 'add_fat',
        priority: 'high',
        message: `Add ${additionalFatGrams}g of fat (${oliveOilTbsp} tbsp olive oil) to reach the 60% Fat Fuel target.`,
        action: {
          ingredient: 'Olive Oil',
          amount: oliveOilTbsp,
          unit: 'tbsp',
          impact: `+${additionalFatGrams}g fat → ${Math.round((currentFatCals + additionalFatCalsNeeded) / (currentFatCals + additionalFatCalsNeeded + nonFatCals) * 100)}% fat`,
        },
      });
    }
  }

  // === CASE 3: Keto but Score < 100 (has penalties) ===
  if (ketoScore.isKeto && ketoScore.score < 100) {
    // Carb penalty: net carbs > 5g
    if (ketoScore.penalties.carbPenalty > 0) {
      const carbsOver = netCarbs - KETO_SCORE_CARB_THRESHOLD;
      
      suggestions.push({
        type: 'reduce_carbs',
        priority: 'medium',
        message: `Reduce net carbs by ${carbsOver.toFixed(1)}g (to under 5g) to eliminate the -${ketoScore.penalties.carbPenalty} carb penalty and hit a perfect score.`,
        action: {
          impact: `+${ketoScore.penalties.carbPenalty} score points`,
        },
      });
    }

    // Protein penalty: protein > 35% of net energy
    if (ketoScore.penalties.proteinPenalty > 0) {
      // Calculate fat needed to bring protein below 35%
      // protein_cals / (fat_cals + protein_cals + carb_cals) < 0.35
      const proteinCals = protein * CALORIES_PER_GRAM.protein;
      const carbCals = netCarbs * CALORIES_PER_GRAM.carbs;
      
      // target: proteinCals < 0.35 * (fatCals + proteinCals + carbCals)
      // proteinCals < 0.35 * fatCals + 0.35 * proteinCals + 0.35 * carbCals
      // 0.65 * proteinCals < 0.35 * fatCals + 0.35 * carbCals
      // fatCals > (0.65 * proteinCals - 0.35 * carbCals) / 0.35
      const targetFatCals = (0.65 * proteinCals - 0.35 * carbCals) / 0.35;
      const currentFatCals = fat * CALORIES_PER_GRAM.fat;
      const additionalFatCalsNeeded = Math.max(0, targetFatCals - currentFatCals);
      const additionalFatGrams = Math.ceil(additionalFatCalsNeeded / CALORIES_PER_GRAM.fat);

      if (additionalFatGrams > 0 && additionalFatGrams <= 50) {
        suggestions.push({
          type: 'balance_protein',
          priority: 'low',
          message: `Add ${additionalFatGrams}g of fat (butter/oil) to balance the protein ratio below 35% and earn +5 score points.`,
          action: {
            ingredient: 'Butter',
            amount: Math.ceil(additionalFatGrams / 11.5),
            unit: 'tbsp',
            impact: `+${ketoScore.penalties.proteinPenalty} score points`,
          },
        });
      } else {
        suggestions.push({
          type: 'balance_protein',
          priority: 'low',
          message: `Protein is ${percents.proteinPercent}% of net energy (>${KETO_SCORE_PROTEIN_THRESHOLD}%). Consider adding more fat or reducing protein.`,
        });
      }
    }
  }

  // === CASE 4: Perfect Keto (Score = 100) ===
  if (ketoScore.isKeto && ketoScore.score === 100) {
    suggestions.push({
      type: 'reduce_carbs',
      priority: 'low',
      message: '✨ Perfect keto compliance! No optimization needed.',
    });
  }

  return {
    isKeto: ketoScore.isKeto,
    ketoScore,
    suggestions,
    swapSuggestions,
    canAutoOptimize: suggestions.some(s => s.action?.ingredient !== undefined) || swapSuggestions.length > 0,
  };
}

/**
 * Auto-optimize a recipe's nutrition to be keto compliant
 * Returns suggested additions/modifications
 */
export function autoOptimizeForKeto(
  nutrition: RawNutritionData,
  servings: number = 1
): { 
  addOns: Array<{ name: string; amount: number; unit: string; macros: IngredientMacros }>;
  resultingNutrition: RawNutritionData;
} {
  const addOns: Array<{ name: string; amount: number; unit: string; macros: IngredientMacros }> = [];
  let workingNutrition = { ...nutrition };

  const protein = workingNutrition.protein_g ?? 0;
  let fat = workingNutrition.fat_g ?? 0;
  const totalCarbs = workingNutrition.carbs_g ?? 0;
  const fiber = workingNutrition.fiber_g ?? 0;

  const netCarbs = calculateNetCarbs(totalCarbs, fiber, 0);
  
  // If net carbs are too high, we can't auto-optimize (need to reduce ingredients)
  if (netCarbs > KETO_BADGE_MAX_NET_CARBS) {
    return { addOns: [], resultingNutrition: workingNutrition };
  }

  // Calculate fat needed to reach 60% threshold
  const netEnergy = calculateNetEnergy(fat, protein, netCarbs);
  const percents = calculateMacroPercents(fat, protein, netCarbs, netEnergy);

  if (percents.fatPercent < KETO_BADGE_MIN_FAT_PERCENT) {
    const proteinCals = protein * CALORIES_PER_GRAM.protein;
    const carbCals = netCarbs * CALORIES_PER_GRAM.carbs;
    const nonFatCals = proteinCals + carbCals;
    
    const targetFatPercent = 0.61;
    const targetFatCals = (targetFatPercent * nonFatCals) / (1 - targetFatPercent);
    const currentFatCals = fat * CALORIES_PER_GRAM.fat;
    const additionalFatCalsNeeded = Math.max(0, targetFatCals - currentFatCals);
    const additionalFatGrams = Math.ceil(additionalFatCalsNeeded / CALORIES_PER_GRAM.fat);

    if (additionalFatGrams > 0) {
      // Use olive oil as default fat add-on
      const oliveOilTbsp = Math.ceil(additionalFatGrams / 13.5);
      const oliveOilMacros = USDA_REFERENCES['olive_oil_tbsp'];
      
      addOns.push({
        name: 'Olive Oil',
        amount: oliveOilTbsp,
        unit: 'tbsp',
        macros: {
          ...oliveOilMacros,
          calories: oliveOilMacros.calories * oliveOilTbsp,
          fat: oliveOilMacros.fat * oliveOilTbsp,
        },
      });

      // Update working nutrition
      fat += oliveOilMacros.fat * oliveOilTbsp;
      workingNutrition.fat_g = fat;
      workingNutrition.calories = (workingNutrition.calories ?? 0) + (oliveOilMacros.calories * oliveOilTbsp);
    }
  }

  return {
    addOns,
    resultingNutrition: workingNutrition,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// GAP CALCULATION ENGINE - For Keto Architect Smart Actions
// ═══════════════════════════════════════════════════════════════════════════

export interface GapAnalysis {
  carbGap: number; // Current Net Carbs - 5g target (for perfect score)
  fatGap: number; // Target Fat % - Current Fat %
  proteinPenalty: boolean; // If protein > 35%
  currentScore: number;
  targetScore: number; // Always 100
}

/**
 * Calculate the exact gaps to reach a perfect 100 Keto Score
 * Used by the frontend Keto Architect for prescriptive recommendations
 */
export function calculateGaps(
  nutrition: RawNutritionData | null | undefined
): GapAnalysis {
  if (!nutrition) {
    return {
      carbGap: 0,
      fatGap: 0,
      proteinPenalty: false,
      currentScore: 0,
      targetScore: 100,
    };
  }

  const protein = nutrition.protein_g ?? 0;
  const fat = nutrition.fat_g ?? 0;
  const totalCarbs = nutrition.carbs_g ?? 0;
  const fiber = nutrition.fiber_g ?? 0;
  const sugarAlcohols = nutrition.sugar_alcohols_g ?? 0;

  const netCarbs = calculateNetCarbs(totalCarbs, fiber, sugarAlcohols);
  const netEnergy = calculateNetEnergy(fat, protein, netCarbs);
  const percents = calculateMacroPercents(fat, protein, netCarbs, netEnergy);
  const ketoScore = calculateKetoScore(netCarbs, fat, protein);

  // Gap to 5g (for perfect score with no carb penalty)
  const carbGap = Math.max(0, netCarbs - KETO_SCORE_CARB_THRESHOLD);
  
  // Gap to 60% fat (for keto badge eligibility)
  const fatGap = Math.max(0, KETO_BADGE_MIN_FAT_PERCENT - percents.fatPercent);
  
  // Protein penalty check (>35% causes -5 penalty)
  const proteinPenalty = percents.proteinPercent > KETO_SCORE_PROTEIN_THRESHOLD;

  return {
    carbGap,
    fatGap,
    proteinPenalty,
    currentScore: ketoScore.score,
    targetScore: 100,
  };
}
