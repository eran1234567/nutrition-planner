/**
 * Neutron Engine - Dual-mode nutrition calculation system
 * 
 * The engine handles two calculation modes:
 * - Standard Mode: Uses total carbs for display and calculations
 * - Keto Mode: Uses net carbs (total - fiber - sugar alcohols) for display and percentages
 * 
 * Badge detection is always performed regardless of mode.
 */

// Types
export type { 
  NeutronMode, 
  RawNutritionData, 
  NeutronNutrition, 
  KetoScore, 
  NeutronBadges, 
  NeutronResult 
} from './types';

// Constants
export {
  KETO_BADGE_MAX_NET_CARBS,
  KETO_BADGE_MIN_FAT_PERCENT,
  KETO_SCORE_CARB_THRESHOLD,
  KETO_SCORE_CARB_PENALTY,
  KETO_SCORE_PROTEIN_THRESHOLD,
  KETO_SCORE_PROTEIN_PENALTY,
  CALORIES_PER_GRAM,
  HEALTH_THRESHOLDS,
  DIET_EXCLUSIONS,
} from './constants';

// Core calculations
export {
  calculateNetCarbs,
  calculateStandardEnergy,
  calculateNetEnergy,
  calculateMacroPercents,
  isKetoBadgeEligible,
  calculateKetoScore,
  processNutrition,
} from './calculations';

// Badge detection
export {
  detectHealthBadges,
  detectDietBadges,
  getNeutronBadges,
  meetsHealthConsideration,
} from './badges';

// Keto optimization
export {
  getKetoOptimization,
  getPrimaryOptimizationTip,
  findKetoSwaps,
  KETO_SWAP_DICTIONARY,
  type KetoOptimizationResult,
  type KetoOptimizationSuggestion,
  type KetoSwapSuggestion,
} from './optimization';

// Ingredient grouping utilities
export {
  groupIngredientsBySection,
  getSectionOrder,
  groupAndOrderIngredients,
  type GroupableIngredient,
} from './ingredientGrouping';

// Import for the main engine function
import type { NeutronMode, RawNutritionData, NeutronResult } from './types';
import { processNutrition } from './calculations';
import { getNeutronBadges } from './badges';

interface IngredientData {
  name: string;
  normalized_name?: string | null;
}

/**
 * Main Neutron Engine function
 * Processes nutrition data and returns mode-aware results with badges
 */
export function neutronProcess(
  nutrition: RawNutritionData | null | undefined,
  mode: NeutronMode,
  ingredients?: IngredientData[],
  recipeTags?: Array<{ tag_type: string; tag_value: string }>
): NeutronResult {
  const processedNutrition = processNutrition(nutrition, mode);
  const badges = getNeutronBadges(nutrition, ingredients, recipeTags);

  return {
    mode,
    nutrition: processedNutrition,
    badges,
  };
}
