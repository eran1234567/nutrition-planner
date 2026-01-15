import type { Sex, UserMetrics } from './types';
import { SCHOFIELD_COEFFICIENTS, YOUTH_AGE_THRESHOLD } from './constants';

/**
 * Calculate Lean Body Mass (LBM) in kg
 */
export function calculateLeanBodyMassKg(weightKg: number, bodyFatPercent?: number): number {
  if (bodyFatPercent !== undefined && bodyFatPercent > 0) {
    return weightKg * (1 - bodyFatPercent / 100);
  }
  // Cannot calculate without body fat percentage
  return weightKg;
}

/**
 * Estimate body fat percentage based on sex (rough estimate)
 */
export function estimateBodyFatPercent(sex: Sex): number {
  return sex === 'male' ? 22 : 28;
}

/**
 * Katch-McArdle BMR formula (for adults with known body fat)
 * BMR = 370 + (21.6 × LBM_kg)
 */
export function calculateKatchMcArdleBMR(leanBodyMassKg: number): number {
  return 370 + (21.6 * leanBodyMassKg);
}

/**
 * Mifflin-St Jeor BMR formula (fallback for adults without body fat)
 * Male: BMR = 10 × weight(kg) + 6.25 × height(cm) - 5 × age + 5
 * Female: BMR = 10 × weight(kg) + 6.25 × height(cm) - 5 × age - 161
 */
export function calculateMifflinStJeorBMR(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: Sex
): number {
  const baseBMR = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? baseBMR + 5 : baseBMR - 161;
}

/**
 * Get Schofield age band based on age
 */
function getSchofieldAgeBand(age: number): 'infant' | 'child' | 'adolescent' {
  if (age < 3) return 'infant';
  if (age < 10) return 'child';
  return 'adolescent';
}

/**
 * Schofield BMR formula (for youth, WHO/FAO/UNU equations)
 * Uses age bands and sex-specific coefficients
 */
export function calculateSchofieldBMR(weightKg: number, age: number, sex: Sex): number {
  const ageBand = getSchofieldAgeBand(age);
  const coefficients = SCHOFIELD_COEFFICIENTS[ageBand][sex];
  
  return coefficients.weightMultiplier * weightKg + coefficients.constant;
}

/**
 * Calculate BMR based on user metrics
 * Uses appropriate formula based on age and available data
 */
export function calculateBMR(metrics: UserMetrics, useAdultOverride = false): number {
  const { age, weightKg, heightCm, sex, bodyFatPercent } = metrics;
  
  const isYouth = age < YOUTH_AGE_THRESHOLD && !useAdultOverride;
  
  if (isYouth) {
    // Use Schofield equations for youth
    return calculateSchofieldBMR(weightKg, age, sex);
  }
  
  // Adult calculations
  if (bodyFatPercent !== undefined && bodyFatPercent > 0) {
    // Use Katch-McArdle if body fat is known
    const lbm = calculateLeanBodyMassKg(weightKg, bodyFatPercent);
    return calculateKatchMcArdleBMR(lbm);
  }
  
  // Fallback to Mifflin-St Jeor
  return calculateMifflinStJeorBMR(weightKg, heightCm, age, sex);
}

/**
 * Check if user should use youth calculations
 */
export function isYouthMode(age: number, useAdultOverride = false): boolean {
  return age < YOUTH_AGE_THRESHOLD && !useAdultOverride;
}
