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

export interface KetoSwapSuggestion {
  originalIngredient: string;
  swapTo: string;
  category: string;
  reason: string;
  estimatedCarbReduction: number;
  matchedKeyword: string;
}

export interface KetoOptimizationResult {
  isKeto: boolean;
  ketoScore: KetoScore;
  suggestions: KetoOptimizationSuggestion[];
  swapSuggestions: KetoSwapSuggestion[];
  canAutoOptimize: boolean;
}

// Keto Smart Swap Dictionary (mirrored from backend)
export const KETO_SWAP_DICTIONARY = [
  {
    category: 'Grains',
    highCarbItem: 'Rice',
    keywords: ['rice', 'white rice', 'brown rice', 'jasmine rice', 'basmati'],
    alternative: 'Cauliflower Rice',
    reason: 'Drops net carbs by ~90%',
    estimatedCarbReduction: 40,
  },
  {
    category: 'Wraps',
    highCarbItem: 'Flour Tortilla / Bread',
    keywords: ['tortilla', 'flour tortilla', 'bread', 'wrap', 'pita', 'naan', 'flatbread'],
    alternative: 'Lettuce Wrap',
    reason: 'Eliminates nearly all grain-based carbs',
    estimatedCarbReduction: 25,
  },
  {
    category: 'Pasta',
    highCarbItem: 'Pasta / Noodles',
    keywords: ['pasta', 'spaghetti', 'noodle', 'noodles', 'penne', 'fettuccine', 'linguine', 'macaroni', 'lasagna'],
    alternative: 'Zucchini Noodles (Zoodles)',
    reason: 'High fiber, extremely low net carbs',
    estimatedCarbReduction: 35,
  },
  {
    category: 'Sides',
    highCarbItem: 'Potato',
    keywords: ['potato', 'potatoes', 'fries', 'french fries', 'mashed potato', 'hash brown'],
    alternative: 'Jicama or Zucchini',
    reason: 'Reduces starch significantly',
    estimatedCarbReduction: 30,
  },
  {
    category: 'Thickeners',
    highCarbItem: 'Cornstarch / Flour',
    keywords: ['cornstarch', 'corn starch', 'flour', 'all-purpose flour', 'wheat flour'],
    alternative: 'Xanthan Gum or Almond Flour',
    reason: 'Removes high-glycemic thickeners',
    estimatedCarbReduction: 10,
  },
  {
    category: 'Crunch',
    highCarbItem: 'Croutons / Crackers',
    keywords: ['crouton', 'croutons', 'cracker', 'crackers', 'breadcrumb', 'breadcrumbs', 'panko'],
    alternative: 'Pork Rinds or Parmesan Crisps',
    reason: 'Replaces carbs with protein/fat crunch',
    estimatedCarbReduction: 15,
  },
  {
    category: 'Sweeteners',
    highCarbItem: 'Sugar / Honey / Maple Syrup',
    keywords: ['sugar', 'honey', 'maple syrup', 'brown sugar', 'cane sugar', 'agave', 'molasses'],
    alternative: 'Allulose or Monk Fruit',
    reason: 'Zero net carb impact',
    estimatedCarbReduction: 20,
  },
  {
    category: 'Milk',
    highCarbItem: 'Regular Milk',
    keywords: ['milk', 'whole milk', 'skim milk', '2% milk'],
    alternative: 'Unsweetened Almond Milk',
    reason: 'Reduces sugar and carbs by ~75%',
    estimatedCarbReduction: 10,
  },
];

/**
 * Normalize an ingredient name for comparison
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
function isAlreadyKetoAlternative(ingredientName: string, alternative: string): boolean {
  const lowerName = normalizeIngredientName(ingredientName);
  const lowerAlt = normalizeIngredientName(alternative);
  
  return lowerName.includes(lowerAlt) || lowerAlt.includes(lowerName);
}

/**
 * Get refined alternative for almond flour (already keto-friendly)
 */
function getRefinedAlternativeForAlmondFlour(ingredientName: string, category: string): { alternative: string; reason: string } | null {
  const lowerName = normalizeIngredientName(ingredientName);
  
  if (lowerName.includes('almond flour') || lowerName.includes('almond meal')) {
    if (category === 'Thickeners') {
      return { alternative: 'Xanthan Gum', reason: 'Zero-carb thickening without almond flour bulk' };
    }
    if (category === 'Crunch') {
      return { alternative: 'Pork Rind Panko', reason: 'Zero-carb breading alternative' };
    }
    return null; // Already keto-friendly
  }
  
  if (lowerName.includes('coconut flour')) {
    return null; // Already keto-friendly
  }
  
  return null;
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
          if (isAlreadyKetoAlternative(ingName, swapEntry.alternative)) {
            break;
          }
          
          // Check for refined alternatives (e.g., almond flour → xanthan gum)
          const refined = getRefinedAlternativeForAlmondFlour(ingName, swapEntry.category);
          if (refined === null && lowerName.includes('almond') && swapEntry.alternative.toLowerCase().includes('almond')) {
            break; // Skip - already keto-friendly
          }
          
          const alternative = refined?.alternative ?? swapEntry.alternative;
          const reason = refined?.reason ?? swapEntry.reason;
          
          // Final deduplication check
          const normalizedSource = normalizeIngredientName(ingName);
          const normalizedTarget = normalizeIngredientName(alternative);
          if (normalizedSource.includes(normalizedTarget) || normalizedTarget.includes(normalizedSource)) {
            break;
          }
          
          swaps.push({
            originalIngredient: ingName,
            swapTo: alternative,
            category: swapEntry.category,
            reason: reason,
            estimatedCarbReduction: swapEntry.estimatedCarbReduction,
            matchedKeyword: keyword,
          });
          break;
        }
      }
    }
  }
  
  return swaps;
}

interface IngredientWithMacros {
  name: string;
  quantity?: number;
  unit?: string;
}

/**
 * Keto Optimization Engine (Frontend Version)
 * Analyzes nutrition data and provides actionable suggestions
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
        message: 'No nutrition data available.',
      }],
      swapSuggestions: [],
      canAutoOptimize: false,
    };
  }

  // Find swap suggestions if ingredients provided
  if (ingredients && ingredients.length > 0) {
    const ingredientNames = ingredients.map(ing => ing.name);
    swapSuggestions = findKetoSwaps(ingredientNames);
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
    swapSuggestions,
    canAutoOptimize: suggestions.some(s => s.action?.ingredient !== undefined) || swapSuggestions.length > 0,
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
