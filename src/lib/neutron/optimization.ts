/**
 * Neutron Engine - Keto Optimization Wrapper for Frontend
 * 
 * This module provides client-side keto optimization analysis that mirrors
 * the backend getKetoOptimization logic in supabase/functions/_shared/neutron.ts
 */

import type { RawNutritionData, KetoScore } from './types';
import {
  calculateNetCarbs,
  calculateNetEnergy,
  calculateMacroPercents,
  calculateKetoScore,
} from './calculations';
import {
  KETO_BADGE_MAX_NET_CARBS,
  KETO_BADGE_MIN_FAT_PERCENT,
  KETO_SCORE_CARB_THRESHOLD,
  KETO_SCORE_PROTEIN_THRESHOLD,
  CALORIES_PER_GRAM,
} from './constants';

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

export interface KetoOptimizationResult {
  isKeto: boolean;
  ketoScore: KetoScore;
  suggestions: KetoOptimizationSuggestion[];
  canAutoOptimize: boolean;
}

/**
 * Keto Optimization Engine (Frontend Version)
 * Analyzes nutrition data and provides actionable suggestions
 */
export function getKetoOptimization(
  nutrition: RawNutritionData | null | undefined
): KetoOptimizationResult {
  const suggestions: KetoOptimizationSuggestion[] = [];
  
  if (!nutrition) {
    return {
      isKeto: false,
      ketoScore: { score: 0, isKeto: false, penalties: { carbPenalty: 0, proteinPenalty: 0 } },
      suggestions: [{
        type: 'reduce_carbs',
        priority: 'high',
        message: 'No nutrition data available.',
      }],
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

  // === CASE 1: Not Keto due to high carbs (> 10g net carbs) ===
  if (netCarbs > KETO_BADGE_MAX_NET_CARBS) {
    const carbExcess = netCarbs - KETO_BADGE_MAX_NET_CARBS;
    
    suggestions.push({
      type: 'reduce_carbs',
      priority: 'high',
      message: `Reduce net carbs by ${carbExcess.toFixed(1)}g (currently ${netCarbs.toFixed(1)}g, max ${KETO_BADGE_MAX_NET_CARBS}g).`,
    });
  }

  // === CASE 2: Not Keto due to low fat (< 60%) ===
  if (percents.fatPercent < KETO_BADGE_MIN_FAT_PERCENT) {
    const targetFatPercent = 0.601;
    const proteinCals = protein * CALORIES_PER_GRAM.protein;
    const carbCals = netCarbs * CALORIES_PER_GRAM.carbs;
    const nonFatCals = proteinCals + carbCals;
    
    const targetFatCals = (targetFatPercent * nonFatCals) / (1 - targetFatPercent);
    const currentFatCals = fat * CALORIES_PER_GRAM.fat;
    const additionalFatCalsNeeded = Math.max(0, targetFatCals - currentFatCals);
    const additionalFatGrams = Math.ceil(additionalFatCalsNeeded / CALORIES_PER_GRAM.fat);

    if (additionalFatGrams > 0) {
      const oliveOilTbsp = Math.ceil(additionalFatGrams / 13.5);
      
      suggestions.push({
        type: 'add_fat',
        priority: 'high',
        message: `Add ${additionalFatGrams}g fat (≈${oliveOilTbsp} tbsp olive oil) to reach 60% Fat Fuel.`,
        action: {
          ingredient: 'Olive Oil',
          amount: oliveOilTbsp,
          unit: 'tbsp',
          impact: `+${additionalFatGrams}g fat`,
        },
      });
    }
  }

  // === CASE 3: Keto but Score < 100 (has penalties) ===
  if (ketoScore.isKeto && ketoScore.score < 100) {
    if (ketoScore.penalties.carbPenalty > 0) {
      const carbsOver = netCarbs - KETO_SCORE_CARB_THRESHOLD;
      
      suggestions.push({
        type: 'reduce_carbs',
        priority: 'medium',
        message: `Reduce ${carbsOver.toFixed(1)}g carbs to hit ≤5g for a perfect score (+${ketoScore.penalties.carbPenalty} pts).`,
        action: {
          impact: `+${ketoScore.penalties.carbPenalty} score`,
        },
      });
    }

    if (ketoScore.penalties.proteinPenalty > 0) {
      const proteinCals = protein * CALORIES_PER_GRAM.protein;
      const carbCals = netCarbs * CALORIES_PER_GRAM.carbs;
      const targetFatCals = (0.65 * proteinCals - 0.35 * carbCals) / 0.35;
      const currentFatCals = fat * CALORIES_PER_GRAM.fat;
      const additionalFatCalsNeeded = Math.max(0, targetFatCals - currentFatCals);
      const additionalFatGrams = Math.ceil(additionalFatCalsNeeded / CALORIES_PER_GRAM.fat);

      if (additionalFatGrams > 0 && additionalFatGrams <= 50) {
        suggestions.push({
          type: 'balance_protein',
          priority: 'low',
          message: `Add ${additionalFatGrams}g fat to balance protein <35% (+${ketoScore.penalties.proteinPenalty} pts).`,
          action: {
            ingredient: 'Butter',
            amount: Math.ceil(additionalFatGrams / 11.5),
            unit: 'tbsp',
            impact: `+${ketoScore.penalties.proteinPenalty} score`,
          },
        });
      } else {
        suggestions.push({
          type: 'balance_protein',
          priority: 'low',
          message: `Protein at ${percents.proteinPercent}% (>${KETO_SCORE_PROTEIN_THRESHOLD}%). Add fat or reduce protein.`,
        });
      }
    }
  }

  // === CASE 4: Perfect Keto (Score = 100) ===
  if (ketoScore.isKeto && ketoScore.score === 100) {
    suggestions.push({
      type: 'reduce_carbs',
      priority: 'low',
      message: '✨ Perfect keto! No optimization needed.',
    });
  }

  return {
    isKeto: ketoScore.isKeto,
    ketoScore,
    suggestions,
    canAutoOptimize: suggestions.some(s => s.action?.ingredient !== undefined),
  };
}

/**
 * Get the primary optimization tip for display in tooltips
 */
export function getPrimaryOptimizationTip(
  nutrition: RawNutritionData | null | undefined
): string | null {
  const result = getKetoOptimization(nutrition);
  
  // Find highest priority suggestion that isn't the "perfect" message
  const actionable = result.suggestions.find(
    s => s.priority !== 'low' || s.action?.ingredient
  );
  
  return actionable?.message ?? null;
}
