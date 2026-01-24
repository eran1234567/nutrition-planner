/**
 * Health consideration auto-detection based on nutritional data.
 * Thresholds based on seed-health-recipes definitions.
 */

interface NutritionData {
  calories?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  fiber_g?: number | null;
  sodium_mg?: number | null;
}

// Thresholds based on seed-health-recipes/index.ts
const THRESHOLDS = {
  // Low Sodium: sodium <300mg per serving
  LOW_SODIUM_MAX: 300,
  
  // Kidney Friendly: low sodium (<400mg), moderate protein (<30g)
  KIDNEY_SODIUM_MAX: 400,
  KIDNEY_PROTEIN_MAX: 30,
  
  // Diabetes Friendly: high fiber (>5g), moderate carbs (<40g)
  // Note: sugar check not available in current schema
  DIABETES_FIBER_MIN: 5,
  DIABETES_CARBS_MAX: 40,
  
  // Heart Healthy: high fiber (>5g), low sodium (<300mg)
  // Note: saturated fat check not available in current schema
  HEART_FIBER_MIN: 5,
  HEART_SODIUM_MAX: 300,
};

/**
 * Low Sodium: sodium < 300mg per serving
 */
export function isLowSodium(nutrition: NutritionData | null | undefined): boolean {
  if (!nutrition || nutrition.sodium_mg == null) return false;
  return nutrition.sodium_mg < THRESHOLDS.LOW_SODIUM_MAX;
}

/**
 * Kidney Friendly: low sodium (<400mg), moderate protein (<30g)
 */
export function isKidneyFriendly(nutrition: NutritionData | null | undefined): boolean {
  if (!nutrition) return false;
  if (nutrition.sodium_mg == null || nutrition.protein_g == null) return false;
  return (
    nutrition.sodium_mg < THRESHOLDS.KIDNEY_SODIUM_MAX &&
    nutrition.protein_g < THRESHOLDS.KIDNEY_PROTEIN_MAX
  );
}

/**
 * Diabetes Friendly: high fiber (>5g), moderate carbs (<40g)
 */
export function isDiabetesFriendly(nutrition: NutritionData | null | undefined): boolean {
  if (!nutrition) return false;
  if (nutrition.fiber_g == null || nutrition.carbs_g == null) return false;
  return (
    nutrition.fiber_g >= THRESHOLDS.DIABETES_FIBER_MIN &&
    nutrition.carbs_g < THRESHOLDS.DIABETES_CARBS_MAX
  );
}

/**
 * Heart Healthy: high fiber (>5g), low sodium (<300mg)
 */
export function isHeartHealthy(nutrition: NutritionData | null | undefined): boolean {
  if (!nutrition) return false;
  if (nutrition.fiber_g == null || nutrition.sodium_mg == null) return false;
  return (
    nutrition.fiber_g >= THRESHOLDS.HEART_FIBER_MIN &&
    nutrition.sodium_mg < THRESHOLDS.HEART_SODIUM_MAX
  );
}

/**
 * Get all health badges that apply to a recipe based on its nutrition
 */
export function getHealthBadges(nutrition: NutritionData | null | undefined): string[] {
  const badges: string[] = [];
  
  if (isDiabetesFriendly(nutrition)) badges.push('diabetes-friendly');
  if (isHeartHealthy(nutrition)) badges.push('heart-healthy');
  if (isLowSodium(nutrition)) badges.push('low-sodium');
  if (isKidneyFriendly(nutrition)) badges.push('kidney-friendly');
  
  return badges;
}

/**
 * Check if a recipe meets a specific health consideration
 */
export function meetsHealthConsideration(
  consideration: string,
  nutrition: NutritionData | null | undefined
): boolean {
  switch (consideration) {
    case 'diabetes-friendly':
      return isDiabetesFriendly(nutrition);
    case 'heart-healthy':
      return isHeartHealthy(nutrition);
    case 'low-sodium':
      return isLowSodium(nutrition);
    case 'kidney-friendly':
      return isKidneyFriendly(nutrition);
    default:
      return false;
  }
}

// Export thresholds for reference
export { THRESHOLDS as HEALTH_THRESHOLDS };
