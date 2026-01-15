import type { MacroRanges, MacroTargets, DietType } from './types';
import {
  YOUTH_AGE_THRESHOLD,
  YOUTH_MACRO_RANGES,
  ADULT_MACRO_RANGES,
  KETO_MACRO_RANGES,
} from './constants';
import { isYouthMode } from './bmr';

/**
 * Get macro ranges based on age and diet type
 */
export function getMacroRanges(
  age: number,
  dietType: DietType = 'none',
  useAdultOverride = false
): MacroRanges {
  // Keto has its own ranges regardless of age
  if (dietType === 'keto') {
    return KETO_MACRO_RANGES;
  }
  
  const isYouth = isYouthMode(age, useAdultOverride);
  return isYouth ? YOUTH_MACRO_RANGES : ADULT_MACRO_RANGES;
}

/**
 * Calculate macros from settings
 */
export function calculateMacros(
  targetCalories: number,
  leanBodyMassLbs: number,
  proteinPerLb: number,
  fatPercent: number
): MacroTargets {
  // Calculate protein
  const proteinGrams = Math.round(leanBodyMassLbs * proteinPerLb);
  const proteinCalories = proteinGrams * 4;
  
  // Calculate fat
  const fatCalories = Math.round(targetCalories * (fatPercent / 100));
  const fatGrams = Math.round(fatCalories / 9);
  
  // Remaining goes to carbs
  const remainingCalories = targetCalories - proteinCalories - fatCalories;
  const carbGrams = Math.round(Math.max(0, remainingCalories) / 4);
  
  return {
    calories: targetCalories,
    protein: proteinGrams,
    carbs: carbGrams,
    fat: fatGrams,
  };
}

/**
 * Calculate calories from macro grams
 */
export function calculateCaloriesFromMacros(
  proteinGrams: number,
  carbsGrams: number,
  fatGrams: number
): number {
  return (proteinGrams * 4) + (carbsGrams * 4) + (fatGrams * 9);
}

/**
 * Validate that macros match target calories
 */
export function validateMacroCalorieMatch(
  targetCalories: number,
  macros: MacroTargets,
  toleranceCalories = 50
): {
  isValid: boolean;
  calculatedCalories: number;
  difference: number;
  isOver: boolean;
} {
  const calculatedCalories = calculateCaloriesFromMacros(
    macros.protein,
    macros.carbs,
    macros.fat
  );
  
  const difference = calculatedCalories - targetCalories;
  const isValid = Math.abs(difference) <= toleranceCalories;
  
  return {
    isValid,
    calculatedCalories,
    difference,
    isOver: difference > 0,
  };
}

/**
 * Check if macro distribution is valid (doesn't exceed 100%)
 */
export function validateMacroDistribution(
  targetCalories: number,
  leanBodyMassLbs: number,
  proteinPerLb: number,
  fatPercent: number
): {
  isValid: boolean;
  proteinPercent: number;
  totalPercent: number;
  remainingPercent: number;
  warning?: { title: string; detail: string };
} {
  const proteinGrams = Math.round(leanBodyMassLbs * proteinPerLb);
  const proteinCalories = proteinGrams * 4;
  const proteinPercent = Math.round((proteinCalories / targetCalories) * 100);
  
  const totalPercent = proteinPercent + fatPercent;
  const remainingPercent = 100 - totalPercent;
  
  if (remainingPercent < 0 || totalPercent >= 100) {
    return {
      isValid: false,
      proteinPercent,
      totalPercent,
      remainingPercent,
      warning: {
        title: 'Macro settings exceed calorie target',
        detail: `Protein (${proteinPercent}%) + Fat (${fatPercent}%) = ${totalPercent}% of calories. Reduce protein factor or fat percentage so total ≤ 100%.`,
      },
    };
  }
  
  return {
    isValid: true,
    proteinPercent,
    totalPercent,
    remainingPercent,
  };
}

/**
 * Check keto carb limits
 */
export function validateKetoCarbs(carbGrams: number): {
  isValid: boolean;
  warning?: { title: string; detail: string };
} {
  if (carbGrams > 50) {
    return {
      isValid: false,
      warning: {
        title: 'Carbs exceed keto limit',
        detail: `Net carbs (${carbGrams}g) exceed the 20-50g keto limit. Consider reducing protein or increasing fat.`,
      },
    };
  }
  
  return { isValid: true };
}

/**
 * Get default macro settings for a diet type and age
 */
export function getDefaultMacroSettings(
  age: number,
  dietType: DietType = 'none',
  useAdultOverride = false
): { proteinPerLb: number; fatPercent: number } {
  const ranges = getMacroRanges(age, dietType, useAdultOverride);
  
  return {
    proteinPerLb: ranges.protein.default,
    fatPercent: ranges.fat.default,
  };
}

/**
 * Convert weight between units
 */
export function convertWeight(value: number, from: 'kg' | 'lb', to: 'kg' | 'lb'): number {
  if (from === to) return value;
  return from === 'kg' ? value * 2.20462 : value / 2.20462;
}

/**
 * Convert height between units
 */
export function convertHeight(value: number, from: 'cm' | 'in', to: 'cm' | 'in'): number {
  if (from === to) return value;
  return from === 'cm' ? value / 2.54 : value * 2.54;
}

/**
 * Convert feet and inches to cm
 */
export function feetInchesToCm(feet: number, inches: number): number {
  return (feet * 12 + inches) * 2.54;
}

/**
 * Convert cm to feet and inches
 */
export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return { feet, inches };
}
