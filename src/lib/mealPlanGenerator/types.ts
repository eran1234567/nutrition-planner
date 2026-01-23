// ============================================================================
// Meal Plan Generator Types
// ============================================================================

import type { MealSlotId, DailyTargets, GeneratedSlot } from '@/types/mealPlan';
import type { GlobalRecipe } from '@/hooks/useGlobalRecipes';

// ============================================================================
// Core Types
// ============================================================================

export type DietType = 'default' | 'keto' | 'low_carb' | 'high_protein' | 'balanced';

export type PlanStatus = 'success' | 'needs_changes';

export interface RecipeMacros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

// ============================================================================
// Add-on Types
// ============================================================================

export interface AddOn {
  id: string;
  name: string;
  emoji: string;
  unit: string;
  stepSize: number;
  maxPerDay: number;
  macrosPerUnit: RecipeMacros;
  primaryMacro: 'protein' | 'carbs' | 'fat' | 'calories';
  description: string;
}

export interface AppliedAddOn {
  id: string;
  addOnId: string;
  name: string;
  emoji: string;
  quantity: number;
  unit: string;
  slot: MealSlotId | 'day';
  macros: RecipeMacros;
  reason?: string;
}

// ============================================================================
// Suggestion Types
// ============================================================================

export interface SwapSuggestion {
  replaceSlot: MealSlotId;
  removeRecipeId: string;
  removeRecipeName: string;
  suggestedRecipeId: string;
  suggestedRecipeName: string;
  reason: string;
  estimatedImpact: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

export interface AddOnSuggestion {
  addOnId: string;
  name: string;
  emoji: string;
  suggestedQuantity: number;
  unit: string;
  slot: MealSlotId | 'day';
  reason: string;
  macros: RecipeMacros;
}

export interface PlanSuggestions {
  swaps: SwapSuggestion[];
  addOns: AddOnSuggestion[];
}

// ============================================================================
// Flags
// ============================================================================

export type PlanFlag = 
  | 'calories_too_low'
  | 'calories_too_high'
  | 'protein_too_low'
  | 'protein_too_high'
  | 'carbs_over_cap'
  | 'carbs_too_low'
  | 'fat_too_low'
  | 'fat_too_high'
  | 'multiplier_below_minimum'
  | 'insufficient_recipe_variety'
  | 'no_recipes_for_slot';

export interface PlanFlagDetail {
  flag: PlanFlag;
  message: string;
  severity: 'warning' | 'error';
  slot?: MealSlotId;
}

// ============================================================================
// Plan Result Types
// ============================================================================

export interface PlanMeal {
  slot: MealSlotId;
  recipeId: string;
  recipeName: string;
  multiplier: number;
  isLocked: boolean;
  totals: RecipeMacros;
}

export interface DayResult {
  dayIndex: number;
  status: PlanStatus;
  meals: PlanMeal[];
  addOns: AppliedAddOn[];
  totals: RecipeMacros & { fiber?: number; sodium?: number };
  deltas: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  flags: PlanFlagDetail[];
  suggestions: PlanSuggestions;
}

export interface PlanResult {
  status: PlanStatus;
  days: DayResult[];
  overallFlags: PlanFlagDetail[];
  createdAt: string;
}

// ============================================================================
// Input Types
// ============================================================================

export interface GeneratePlanInput {
  dailyTargets: DailyTargets;
  selectedMealSlots: { id: MealSlotId; label: string; percentOfDay: number }[];
  recipePoolsBySlot: Record<string, string[]>;
  exactAssignments: Record<number, Record<string, { recipeId: string; servingMultiplier: number }>>;
  recipes: GlobalRecipe[];
  numberOfDays: number;
  dietType: DietType;
  lockedSlots?: Record<number, string[]>;
  existingPlan?: { days: { dayIndex: number; slots: GeneratedSlot[] }[] } | null;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  missingSlots: string[];
}

// ============================================================================
// Solver Configuration
// ============================================================================

export interface SolverConfig {
  // Multiplier constraints
  minMultiplier: number;
  maxMultiplier: number;
  multiplierStep: number;
  preferredMinMultiplier: number; // Below this triggers a warning
  
  // Calorie tolerance
  calorieTolerancePercent: number; // e.g., 0.02 for ±2%
  
  // Macro tolerances (percentage deviation considered "large")
  macroLargeDeviationPercent: number; // e.g., 0.10 for 10%
  
  // Keto-specific
  ketoCarbCapOvershootGrams: number; // e.g., 5g allowed overshoot
  
  // Add-on limits
  maxOilButterTbspPerDay: number;
  maxPowderScoopsPerDay: number;
  maxAddOnsPerDay: number;
}

export const DEFAULT_SOLVER_CONFIG: SolverConfig = {
  minMultiplier: 0.25,
  maxMultiplier: 5.0,
  multiplierStep: 0.05,
  preferredMinMultiplier: 0.5,
  
  calorieTolerancePercent: 0.02,
  macroLargeDeviationPercent: 0.10,
  
  ketoCarbCapOvershootGrams: 5,
  
  maxOilButterTbspPerDay: 4,
  maxPowderScoopsPerDay: 2,
  maxAddOnsPerDay: 3,
};
