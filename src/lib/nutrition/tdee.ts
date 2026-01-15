import type { ActivityLevel, Sex, UserMetrics, CalculationOptions, Goal } from './types';
import { 
  ACTIVITY_MULTIPLIERS, 
  YOUTH_ACTIVITY_COEFFICIENTS, 
  YOUTH_GROWTH_ALLOWANCE,
  YOUTH_AGE_THRESHOLD,
  ADULT_GOAL_MULTIPLIERS,
  YOUTH_GOAL_SETTINGS,
  ADULT_GOAL_SETTINGS,
} from './constants';
import { calculateBMR, isYouthMode } from './bmr';

/**
 * Calculate Youth Estimated Energy Requirement (EER) using IOM DRI equations
 * Includes physical activity coefficient and growth allowance
 * 
 * Boys (9-18): EER = 88.5 - (61.9 × age) + PA × (26.7 × weight + 903 × height) + 25
 * Girls (9-18): EER = 135.3 - (30.8 × age) + PA × (10.0 × weight + 934 × height) + 25
 * 
 * For younger children (3-8), simplified equations are used
 */
export function calculateYouthEER(
  metrics: UserMetrics,
  activityLevel: ActivityLevel
): number {
  const { age, weightKg, heightCm, sex } = metrics;
  const heightM = heightCm / 100;
  const pa = YOUTH_ACTIVITY_COEFFICIENTS[sex][activityLevel];
  
  let eer: number;
  
  if (age >= 9) {
    // IOM DRI equations for 9-18 years
    if (sex === 'male') {
      eer = 88.5 - (61.9 * age) + pa * (26.7 * weightKg + 903 * heightM) + YOUTH_GROWTH_ALLOWANCE.default;
    } else {
      eer = 135.3 - (30.8 * age) + pa * (10.0 * weightKg + 934 * heightM) + YOUTH_GROWTH_ALLOWANCE.default;
    }
  } else if (age >= 3) {
    // Simplified equations for younger children (3-8 years)
    // Using Schofield BMR with activity multiplier and growth allowance
    const bmr = calculateBMR(metrics, false);
    eer = bmr * ACTIVITY_MULTIPLIERS[activityLevel] + YOUTH_GROWTH_ALLOWANCE.default;
  } else {
    // Infants (0-3 years) - simplified approach
    const bmr = calculateBMR(metrics, false);
    eer = bmr * 1.2 + YOUTH_GROWTH_ALLOWANCE.max;
  }
  
  return Math.round(eer);
}

/**
 * Calculate Adult TDEE (Total Daily Energy Expenditure)
 * TDEE = BMR × Activity Multiplier
 */
export function calculateAdultTDEE(
  bmr: number,
  activityLevel: ActivityLevel
): number {
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel]);
}

/**
 * Calculate TDEE based on user metrics and options
 * Uses appropriate formula based on age
 */
export function calculateTDEE(
  metrics: UserMetrics,
  activityLevel: ActivityLevel,
  useAdultOverride = false
): number {
  const isYouth = isYouthMode(metrics.age, useAdultOverride);
  
  if (isYouth) {
    return calculateYouthEER(metrics, activityLevel);
  }
  
  const bmr = calculateBMR(metrics, useAdultOverride);
  return calculateAdultTDEE(bmr, activityLevel);
}

/**
 * Get goal restrictions based on age
 */
export function getGoalRestrictions(age: number, useAdultOverride = false): {
  loseDisabled: boolean;
  maxSurplusPercent: number;
  defaultSurplusPercent: number;
} {
  const isYouth = isYouthMode(age, useAdultOverride);
  return isYouth ? YOUTH_GOAL_SETTINGS : ADULT_GOAL_SETTINGS;
}

/**
 * Calculate target calories based on TDEE and goal
 */
export function calculateTargetCalories(
  tdee: number,
  goal: Goal,
  age: number,
  useAdultOverride = false,
  customDeficitPercent?: number
): number {
  const isYouth = isYouthMode(age, useAdultOverride);
  const restrictions = getGoalRestrictions(age, useAdultOverride);
  
  // Handle youth restrictions
  if (isYouth && goal === 'lose') {
    // Treat as maintain for youth (weight loss disabled)
    return tdee;
  }
  
  if (customDeficitPercent !== undefined) {
    if (goal === 'lose') {
      return Math.round(tdee * (100 - customDeficitPercent) / 100);
    } else if (goal === 'gain') {
      // Cap surplus for youth
      const cappedSurplus = Math.min(customDeficitPercent, restrictions.maxSurplusPercent);
      return Math.round(tdee * (100 + cappedSurplus) / 100);
    }
    return tdee;
  }
  
  // Use standard multipliers
  if (goal === 'gain') {
    // Use age-appropriate default surplus
    const surplusMultiplier = 1 + (restrictions.defaultSurplusPercent / 100);
    return Math.round(tdee * surplusMultiplier);
  }
  
  return Math.round(tdee * ADULT_GOAL_MULTIPLIERS[goal]);
}
