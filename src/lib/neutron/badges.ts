/**
 * Neutron Engine - Badge detection logic
 */

import type { RawNutritionData, NeutronBadges } from './types';
import { HEALTH_THRESHOLDS, DIET_EXCLUSIONS } from './constants';
import { calculateNetCarbs, calculateKetoScore } from './calculations';

interface IngredientData {
  name: string;
  normalized_name?: string | null;
}

/**
 * Health badge detection based on nutritional thresholds
 */
export function detectHealthBadges(nutrition: RawNutritionData | null | undefined): string[] {
  if (!nutrition) return [];

  const badges: string[] = [];
  const { protein_g, carbs_g, fiber_g, sodium_mg } = nutrition;

  // Diabetes Friendly: high fiber (≥5g), moderate carbs (<40g)
  if (fiber_g != null && carbs_g != null) {
    if (fiber_g >= HEALTH_THRESHOLDS.DIABETES_FIBER_MIN && 
        carbs_g < HEALTH_THRESHOLDS.DIABETES_CARBS_MAX) {
      badges.push('diabetes-friendly');
    }
  }

  // Heart Healthy: high fiber (≥5g), low sodium (<300mg)
  if (fiber_g != null && sodium_mg != null) {
    if (fiber_g >= HEALTH_THRESHOLDS.HEART_FIBER_MIN && 
        sodium_mg < HEALTH_THRESHOLDS.HEART_SODIUM_MAX) {
      badges.push('heart-healthy');
    }
  }

  // Low Sodium: sodium <300mg per serving
  if (sodium_mg != null && sodium_mg < HEALTH_THRESHOLDS.LOW_SODIUM_MAX) {
    badges.push('low-sodium');
  }

  // Kidney Friendly: low sodium (<400mg), moderate protein (<30g)
  if (sodium_mg != null && protein_g != null) {
    if (sodium_mg < HEALTH_THRESHOLDS.KIDNEY_SODIUM_MAX && 
        protein_g < HEALTH_THRESHOLDS.KIDNEY_PROTEIN_MAX) {
      badges.push('kidney-friendly');
    }
  }

  return badges;
}

/**
 * Check if a recipe meets a specific health consideration
 */
export function meetsHealthConsideration(
  consideration: string,
  nutrition: RawNutritionData | null | undefined
): boolean {
  if (!nutrition) return false;

  switch (consideration) {
    case 'diabetes-friendly': {
      const fiber = nutrition.fiber_g ?? 0;
      const carbs = nutrition.carbs_g ?? 0;
      return fiber >= HEALTH_THRESHOLDS.DIABETES_FIBER_MIN && carbs < HEALTH_THRESHOLDS.DIABETES_CARBS_MAX;
    }
    case 'heart-healthy': {
      const fiber = nutrition.fiber_g ?? 0;
      const sodium = nutrition.sodium_mg ?? Infinity;
      return fiber >= HEALTH_THRESHOLDS.HEART_FIBER_MIN && sodium < HEALTH_THRESHOLDS.HEART_SODIUM_MAX;
    }
    case 'low-sodium': {
      const sodium = nutrition.sodium_mg ?? Infinity;
      return sodium < HEALTH_THRESHOLDS.LOW_SODIUM_MAX;
    }
    case 'kidney-friendly': {
      const sodium = nutrition.sodium_mg ?? Infinity;
      const protein = nutrition.protein_g ?? Infinity;
      return sodium < HEALTH_THRESHOLDS.KIDNEY_SODIUM_MAX && protein < HEALTH_THRESHOLDS.KIDNEY_PROTEIN_MAX;
    }
    default:
      return false;
  }
}

/**
 * Check if ingredients contain any excluded terms for a diet
 */
function hasExcludedIngredient(
  ingredients: IngredientData[] | undefined,
  exclusions: string[]
): boolean {
  if (!ingredients || ingredients.length === 0) return false;

  return ingredients.some((ing) => {
    const ingName = (ing.normalized_name || ing.name || '').toLowerCase();
    return exclusions.some((excluded) => ingName.includes(excluded));
  });
}

/**
 * Auto-detect diet badges based on nutrition + ingredients
 */
export function detectDietBadges(
  nutrition: RawNutritionData | null | undefined,
  ingredients: IngredientData[] | undefined,
  recipeTags?: Array<{ tag_type: string; tag_value: string }>
): string[] {
  const badges: string[] = [];

  // Get diet tags from recipe
  const dietTags = (recipeTags || [])
    .filter((t) => t.tag_type === 'diet')
    .map((t) => t.tag_value.toLowerCase());

  // Keto: auto-detect from macros using Neutron thresholds
  if (nutrition) {
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
  }

  // Paleo: auto-detect from ingredients or use tag
  const isPaleo = dietTags.includes('paleo') || 
    (ingredients && ingredients.length > 0 && !hasExcludedIngredient(ingredients, DIET_EXCLUSIONS.paleo));
  if (isPaleo && !badges.includes('paleo')) {
    badges.push('paleo');
  }

  // Mediterranean: auto-detect from ingredients or use tag
  const isMed = dietTags.includes('mediterranean') ||
    (ingredients && ingredients.length > 0 && !hasExcludedIngredient(ingredients, DIET_EXCLUSIONS.mediterranean));
  if (isMed && !badges.includes('mediterranean')) {
    badges.push('mediterranean');
  }

  // Tag-based diets: vegan, vegetarian, pescatarian
  ['vegan', 'vegetarian', 'pescatarian'].forEach((diet) => {
    if (dietTags.includes(diet) && !badges.includes(diet)) {
      badges.push(diet);
    }
  });

  return badges;
}

/**
 * Get complete Neutron badges for a recipe
 */
export function getNeutronBadges(
  nutrition: RawNutritionData | null | undefined,
  ingredients?: IngredientData[],
  recipeTags?: Array<{ tag_type: string; tag_value: string }>
): NeutronBadges {
  // Calculate keto score regardless of other factors
  const netCarbs = calculateNetCarbs(
    nutrition?.carbs_g ?? 0,
    nutrition?.fiber_g ?? 0,
    nutrition?.sugar_alcohols_g ?? 0
  );
  const ketoScore = calculateKetoScore(
    netCarbs,
    nutrition?.fat_g ?? 0,
    nutrition?.protein_g ?? 0
  );

  const dietBadges = detectDietBadges(nutrition, ingredients, recipeTags);
  const healthBadges = detectHealthBadges(nutrition);

  return {
    isKeto: ketoScore.isKeto,
    ketoScore,
    dietBadges,
    healthBadges,
  };
}
