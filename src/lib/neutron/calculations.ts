/**
 * Neutron Engine - Core calculation logic for dual-mode nutrition
 */

import type { RawNutritionData, NeutronNutrition, KetoScore, NeutronMode } from './types';
import {
  CALORIES_PER_GRAM,
  KETO_BADGE_MAX_NET_CARBS,
  KETO_BADGE_MIN_FAT_PERCENT,
  KETO_SCORE_CARB_THRESHOLD,
  KETO_SCORE_CARB_PENALTY,
  KETO_SCORE_PROTEIN_THRESHOLD,
  KETO_SCORE_PROTEIN_PENALTY,
} from './constants';

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
  // Check net carbs threshold
  if (netCarbs > KETO_BADGE_MAX_NET_CARBS) {
    return false;
  }

  // Calculate net energy for fat percentage
  const netEnergy = calculateNetEnergy(fat, protein, netCarbs);
  if (netEnergy <= 0) return false;

  const fatCals = fat * CALORIES_PER_GRAM.fat;
  const fatPercent = (fatCals / netEnergy) * 100;

  return fatPercent >= KETO_BADGE_MIN_FAT_PERCENT;
}

/**
 * Calculate Keto Score (0-100)
 * - Start at 100
 * - Carb Penalty: -10 points for every 1g of Net Carbs over 5g
 * - Protein Penalty: -5 if Protein > 35% of Net Energy
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

  // Clamp score to 0-100
  score = Math.max(0, Math.min(100, score));

  const isKeto = isKetoBadgeEligible(netCarbs, fat, protein);

  return { score, isKeto, penalties };
}

/**
 * Process raw nutrition data into Neutron format with mode-aware calculations
 */
export function processNutrition(
  raw: RawNutritionData | null | undefined,
  mode: NeutronMode
): NeutronNutrition {
  // Default values for missing data
  const calories = raw?.calories ?? 0;
  const protein = raw?.protein_g ?? 0;
  const fat = raw?.fat_g ?? 0;
  const totalCarbs = raw?.carbs_g ?? 0;
  const fiber = raw?.fiber_g ?? 0;
  const sugarAlcohols = raw?.sugar_alcohols_g ?? 0;
  const sugar = raw?.sugar_g ?? 0;
  const sodium = raw?.sodium_mg ?? 0;
  const saturatedFat = raw?.saturated_fat_g ?? 0;
  const cholesterol = raw?.cholesterol_mg ?? 0;

  // Calculate derived values
  const netCarbs = calculateNetCarbs(totalCarbs, fiber, sugarAlcohols);
  const standardEnergy = calculateStandardEnergy(fat, protein, totalCarbs);
  const netEnergy = calculateNetEnergy(fat, protein, netCarbs);

  // Mode-specific display values
  const isKeto = mode === 'keto';
  const displayCarbs = isKeto ? netCarbs : totalCarbs;
  const carbLabel = isKeto ? 'Net Carbs' : 'Carbs';

  // Calculate percentages based on mode
  const energyBase = isKeto ? netEnergy : standardEnergy;
  const carbsForPercent = isKeto ? netCarbs : totalCarbs;
  const percents = calculateMacroPercents(fat, protein, carbsForPercent, energyBase);

  return {
    calories,
    protein,
    fat,
    totalCarbs,
    fiber,
    netCarbs,
    sugarAlcohols,
    sugar,
    sodium,
    saturatedFat,
    cholesterol,
    displayCarbs,
    carbLabel,
    standardEnergy,
    netEnergy,
    ...percents,
  };
}
