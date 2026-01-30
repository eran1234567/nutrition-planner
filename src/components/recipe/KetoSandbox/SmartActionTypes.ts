/**
 * Smart Action Types for Keto Architect
 * Defines the prescriptive action system with gap calculations
 */

import type { IngredientData, NutritionPreview, SwapChange, AdditionChange, QuantityChange } from './types';
import { KETO_SWAP_DICTIONARY } from '@/lib/neutron/optimization';
import { 
  CALORIES_PER_GRAM, 
  KETO_SCORE_CARB_THRESHOLD,
  KETO_SCORE_PROTEIN_THRESHOLD,
  KETO_BADGE_MIN_FAT_PERCENT,
} from '@/lib/neutron';
import { HIGH_CARB_INGREDIENTS, FAT_ADDITIONS } from './types';

// ═══════════════════════════════════════════════════════════════════════════
// ACTION TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type SmartActionType = 'swap' | 'reduce' | 'remove' | 'add_fat';

export interface SmartAction {
  id: string;
  type: SmartActionType;
  priority: number; // 1 = highest
  title: string;
  description: string;
  scoreImpact: number; // How many points this adds
  isPerfectFix: boolean; // If this single action hits 100
  
  // Execution data
  ingredientId?: string;
  ingredientName?: string;
  originalQuantity?: number;
  newQuantity?: number;
  unit?: string;
  
  // For swaps
  swapTo?: string;
  
  // For fat additions
  fatAdditionId?: string;
  fatGrams?: number;
}

export interface GapAnalysis {
  carbGap: number; // Current Net Carbs - 5g target
  fatGap: number; // Target Fat % - Current Fat %
  proteinPenalty: boolean; // If protein > 35%
  currentScore: number;
  targetScore: number; // Always 100
}

// ═══════════════════════════════════════════════════════════════════════════
// GAP CALCULATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate the exact gaps to reach a perfect 100 score
 */
export function calculateGaps(nutrition: NutritionPreview): GapAnalysis {
  const carbGap = Math.max(0, nutrition.netCarbs - KETO_SCORE_CARB_THRESHOLD);
  const fatGap = Math.max(0, KETO_BADGE_MIN_FAT_PERCENT - nutrition.fatPercent);
  const proteinPenalty = nutrition.proteinPercent > KETO_SCORE_PROTEIN_THRESHOLD;
  
  return {
    carbGap,
    fatGap,
    proteinPenalty,
    currentScore: nutrition.ketoScore,
    targetScore: 100,
  };
}

/**
 * Get carbs per unit for an ingredient
 */
function getCarbsPerUnit(name: string): number {
  const lowerName = name.toLowerCase();
  for (const [pattern, carbs] of Object.entries(HIGH_CARB_INGREDIENTS)) {
    if (lowerName.includes(pattern)) {
      return carbs;
    }
  }
  return 2; // Default for unknown
}

/**
 * Find a swap in the dictionary for an ingredient
 */
function findSwapForIngredient(name: string): { swapTo: string; reason: string } | null {
  const lowerName = name.toLowerCase();
  
  for (const entry of KETO_SWAP_DICTIONARY) {
    // Check exclude keywords first
    if (entry.excludeKeywords?.some(exclude => lowerName.includes(exclude))) {
      continue;
    }
    
    for (const keyword of entry.keywords) {
      if (lowerName.includes(keyword)) {
        return {
          swapTo: entry.alternative,
          reason: entry.reason,
        };
      }
    }
  }
  
  return null;
}

/**
 * Generate prescriptive Smart Actions to reach 100 score
 * Implements the Zero-Quantity Flavor Guard and Gap calculations
 */
export function generateSmartActions(
  nutrition: NutritionPreview,
  ingredients: IngredientData[],
  servings: number
): SmartAction[] {
  const actions: SmartAction[] = [];
  const gaps = calculateGaps(nutrition);
  
  // If already perfect, no actions needed
  if (nutrition.ketoScore >= 100) {
    return [];
  }
  
  const scoreToGain = 100 - nutrition.ketoScore;
  
  // ═══════════════════════════════════════════════════════════════════════
  // PRIORITY 1: Reduce carbs if carbGap > 0
  // ═══════════════════════════════════════════════════════════════════════
  
  if (gaps.carbGap > 0) {
    // Find ingredients sorted by carb impact (highest first)
    const carbIngredients = ingredients
      .filter(ing => ing.quantity && ing.quantity > 0)
      .map(ing => ({
        ...ing,
        carbsPerUnit: getCarbsPerUnit(ing.name),
        totalCarbs: (ing.quantity || 0) * getCarbsPerUnit(ing.name),
      }))
      .filter(ing => ing.carbsPerUnit > 0.5) // Only meaningful carb contributors
      .sort((a, b) => b.totalCarbs - a.totalCarbs);
    
    for (const ing of carbIngredients.slice(0, 2)) { // Top 2 contributors
      const unitsToReduce = Math.ceil(gaps.carbGap / ing.carbsPerUnit);
      const canReduce = Math.floor(ing.quantity! - 1); // Leave at least 1
      
      // ZERO-QUANTITY FLAVOR GUARD
      if (unitsToReduce >= ing.quantity!) {
        // Would remove entirely - check for swap first
        const swap = findSwapForIngredient(ing.name);
        
        if (swap) {
          // Suggest swap instead of removal
          const swapScoreImpact = Math.min(gaps.carbGap * 10, scoreToGain);
          actions.push({
            id: `swap-${ing.id}`,
            type: 'swap',
            priority: 1,
            title: `Swap ${ing.name.split(' ').slice(0, 2).join(' ')} → ${swap.swapTo}`,
            description: swap.reason,
            scoreImpact: swapScoreImpact,
            isPerfectFix: swapScoreImpact >= scoreToGain,
            ingredientId: ing.id,
            ingredientName: ing.name,
            swapTo: swap.swapTo,
          });
        } else {
          // No swap available - suggest removal as last resort
          const removeScoreImpact = Math.min(ing.totalCarbs * 10, scoreToGain);
          actions.push({
            id: `remove-${ing.id}`,
            type: 'remove',
            priority: 2,
            title: `Remove ${ing.name.split(' ').slice(0, 3).join(' ')}`,
            description: `Eliminates ${ing.totalCarbs.toFixed(1)}g net carbs`,
            scoreImpact: removeScoreImpact,
            isPerfectFix: removeScoreImpact >= scoreToGain,
            ingredientId: ing.id,
            ingredientName: ing.name,
            originalQuantity: ing.quantity!,
            newQuantity: 0,
            unit: ing.unit,
          });
        }
      } else if (canReduce > 0) {
        // Can reduce without removing entirely
        const actualReduction = Math.min(unitsToReduce, canReduce);
        const newQty = ing.quantity! - actualReduction;
        const carbReduction = actualReduction * ing.carbsPerUnit;
        const reduceScoreImpact = Math.min(carbReduction * 10, scoreToGain);
        
        // Format quantity + unit clearly
        const unitLabel = ing.unit || '';
        
        // Handle compound units like "6 oz fillets" - extract the base unit and size
        const compoundUnitMatch = unitLabel.match(/^(\d+\s*(?:oz|g|lb|ml))\s+(.+)$/i);
        let formattedQuantity: string;
        
        if (compoundUnitMatch) {
          // "6 oz fillets" -> "4 fillets (6 oz each)"
          const [, size, baseUnit] = compoundUnitMatch;
          formattedQuantity = `${newQty} ${baseUnit} (${size} each)`;
        } else if (unitLabel) {
          formattedQuantity = `${newQty} ${unitLabel}${newQty !== 1 && !unitLabel.endsWith('s') ? 's' : ''}`;
        } else {
          formattedQuantity = `${newQty}`;
        }
        
        actions.push({
          id: `reduce-${ing.id}`,
          type: 'reduce',
          priority: 1,
          title: `Reduce ${ing.name.split(' ').slice(0, 2).join(' ')} to ${formattedQuantity}`,
          description: `Saves ${carbReduction.toFixed(1)}g net carbs`,
          scoreImpact: reduceScoreImpact,
          isPerfectFix: reduceScoreImpact >= scoreToGain,
          ingredientId: ing.id,
          ingredientName: ing.name,
          originalQuantity: ing.quantity!,
          newQuantity: newQty,
          unit: ing.unit,
        });
      }
      
      // If we found a perfect fix, don't add more carb actions
      if (actions.some(a => a.isPerfectFix)) break;
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // PRIORITY 2: Add fat if fatGap > 0 or protein penalty
  // ═══════════════════════════════════════════════════════════════════════
  
  if (gaps.fatGap > 0 || gaps.proteinPenalty) {
    // Calculate exact fat grams needed using the target formula
    const protein = nutrition.protein_g;
    const netCarbs = nutrition.netCarbs;
    const currentFat = nutrition.fat_g;
    
    const nonFatCals = protein * CALORIES_PER_GRAM.protein + netCarbs * CALORIES_PER_GRAM.carbs;
    const targetFatCals = (0.601 * nonFatCals) / 0.399;
    const currentFatCals = currentFat * CALORIES_PER_GRAM.fat;
    const additionalFatCalsNeeded = Math.max(0, targetFatCals - currentFatCals);
    const fatGramsNeeded = Math.ceil(additionalFatCalsNeeded / CALORIES_PER_GRAM.fat);
    
    if (fatGramsNeeded > 0 && fatGramsNeeded <= 60) {
      // Suggest top 2-3 fat sources
      const fatSources = [
        { id: 'olive-oil', name: 'Olive Oil', gramsPerUnit: 13.5, unit: 'tbsp' },
        { id: 'butter', name: 'Butter', gramsPerUnit: 11.5, unit: 'tbsp' },
        { id: 'coconut-oil', name: 'MCT Oil', gramsPerUnit: 14, unit: 'tbsp' },
      ];
      
      // Only add one fat action (the best one)
      const bestFat = fatSources[0];
      const unitsNeeded = Math.ceil(fatGramsNeeded / bestFat.gramsPerUnit);
      const actualFatGrams = unitsNeeded * bestFat.gramsPerUnit;
      
      // Calculate score impact from adding fat
      const fatScoreImpact = gaps.proteinPenalty ? 5 : 0; // Protein penalty fix
      const fatAddScoreImpact = Math.min(fatScoreImpact + 10, scoreToGain - actions.reduce((sum, a) => sum + a.scoreImpact, 0));
      
      const remainingScoreNeeded = scoreToGain - actions.reduce((sum, a) => sum + a.scoreImpact, 0);
      
      actions.push({
        id: `add-fat-${bestFat.id}`,
        type: 'add_fat',
        priority: 3,
        title: `Add ${unitsNeeded} ${bestFat.unit} ${bestFat.name}`,
        description: `+${actualFatGrams.toFixed(0)}g fat to balance macros`,
        scoreImpact: Math.max(5, fatAddScoreImpact),
        isPerfectFix: remainingScoreNeeded <= 5 && (gaps.carbGap <= 0),
        fatAdditionId: bestFat.id,
        fatGrams: actualFatGrams,
        unit: bestFat.unit,
        newQuantity: unitsNeeded,
      });
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // Sort by priority and mark perfect fixes
  // ═══════════════════════════════════════════════════════════════════════
  
  actions.sort((a, b) => a.priority - b.priority);
  
  // Recalculate isPerfectFix based on cumulative score
  let cumulativeScore = nutrition.ketoScore;
  for (const action of actions) {
    cumulativeScore += action.scoreImpact;
    if (cumulativeScore >= 100) {
      action.isPerfectFix = true;
      break; // Only first action to hit 100 gets the label
    }
  }
  
  return actions.slice(0, 4); // Max 4 actions
}
