// ============================================================================
// Meal Plan Generator - Main Entry Point
// Refactored with staged solver, add-ons support, and feasibility detection
// ============================================================================

export type { 
  DietType, 
  PlanStatus, 
  RecipeMacros, 
  AddOn, 
  AppliedAddOn, 
  SwapSuggestion, 
  AddOnSuggestion, 
  PlanSuggestions, 
  PlanFlag, 
  PlanFlagDetail, 
  PlanMeal, 
  DayResult, 
  PlanResult, 
  ValidationResult,
  SolverConfig,
} from './types';
export { DEFAULT_SOLVER_CONFIG } from './types';
export { ADD_ONS_LIBRARY, getAddOnById, getAddOnsByPrimaryMacro, calculateAddOnMacros, getSuggestedAddOnsForGap } from './addOnsLibrary';
export { solveDay } from './solver';
export type { SolveDayInput } from './solver';

import type { GlobalRecipe } from '@/hooks/useGlobalRecipes';
import type { 
  MealSlot, 
  MealSlotId, 
  DailyTargets, 
  GeneratedPlan, 
  GeneratedDay, 
  GeneratedSlot,
} from '@/types/mealPlan';
import type {
  GeneratePlanInput,
  ValidationResult,
  PlanResult,
  DayResult,
  DietType,
  RecipeMacros,
} from './types';
import { DEFAULT_SOLVER_CONFIG } from './types';
import { solveDay } from './solver';

// ============================================================================
// Validation
// ============================================================================

export interface ValidatePlanInput {
  dailyTargets: DailyTargets;
  selectedMealSlots: { id: string; label: string }[];
  recipePoolsBySlot: Record<string, string[]>;
  exactAssignments: Record<number, Record<string, { recipeId: string; servingMultiplier: number }>>;
  recipes: GlobalRecipe[];
  numberOfDays: number;
}

export function validatePlanInputs(input: ValidatePlanInput): ValidationResult {
  const errors: string[] = [];
  const missingSlots: string[] = [];
  
  if (!input.dailyTargets) {
    errors.push('Daily targets not set');
  }
  
  if (input.selectedMealSlots.length === 0) {
    errors.push('No meal slots selected');
  }
  
  // Check each slot has recipes
  for (const slot of input.selectedMealSlots) {
    const poolRecipes = input.recipePoolsBySlot[slot.id] || [];
    
    // Check if all days are covered by exact assignments
    let allDaysCovered = true;
    for (let day = 0; day < input.numberOfDays; day++) {
      const exactAssignment = input.exactAssignments[day]?.[slot.id];
      if (!exactAssignment && poolRecipes.length === 0) {
        allDaysCovered = false;
        break;
      }
    }
    
    if (!allDaysCovered && poolRecipes.length === 0) {
      missingSlots.push(slot.label);
    }
  }
  
  if (missingSlots.length > 0) {
    errors.push(`Missing recipes for: ${missingSlots.join(', ')}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    missingSlots,
  };
}

// ============================================================================
// Recipe Selection (from pools)
// ============================================================================

function getRecipeMacros(recipe: GlobalRecipe): RecipeMacros | null {
  if (!recipe.nutrition) return null;
  return {
    calories: recipe.nutrition.calories ?? 0,
    protein: recipe.nutrition.protein_g ?? 0,
    carbs: recipe.nutrition.carbs_g ?? 0,
    fat: recipe.nutrition.fat_g ?? 0,
  };
}

function calculateFitScore(actual: RecipeMacros, target: RecipeMacros): number {
  const calorieDeviation = target.calories > 0 
    ? Math.abs(actual.calories - target.calories) / target.calories 
    : 0;
  const proteinDeviation = target.protein > 0 
    ? Math.abs(actual.protein - target.protein) / target.protein 
    : 0;
  const carbsDeviation = target.carbs > 0 
    ? Math.abs(actual.carbs - target.carbs) / target.carbs 
    : 0;
  const fatDeviation = target.fat > 0 
    ? Math.abs(actual.fat - target.fat) / target.fat 
    : 0;
  
  return calorieDeviation + proteinDeviation + carbsDeviation + fatDeviation;
}

function scaleMacros(macros: RecipeMacros, multiplier: number): RecipeMacros {
  return {
    calories: Math.round(macros.calories * multiplier),
    protein: Math.round(macros.protein * multiplier * 10) / 10,
    carbs: Math.round(macros.carbs * multiplier * 10) / 10,
    fat: Math.round(macros.fat * multiplier * 10) / 10,
  };
}

/**
 * Select best recipes for a day from pools using holistic scoring
 */
function selectBestRecipesForDay(
  pools: { slotId: MealSlotId; recipes: string[] }[],
  recipeMap: Map<string, GlobalRecipe>,
  dailyTargets: DailyTargets,
  dayIndex: number,
  recentlyUsedBySlot: Map<string, Map<string, number[]>>,
  dietType: DietType
): { slotId: MealSlotId; recipeId: string; multiplier: number }[] {
  const isKeto = dietType === 'keto' || dietType === 'low_carb';
  
  // For each slot, get available recipes (not used within 2 days)
  const slotCandidates = pools.map(({ slotId, recipes }) => {
    const usedMap = recentlyUsedBySlot.get(slotId) || new Map();
    let available = recipes.filter(recipeId => {
      const usedDays = usedMap.get(recipeId) || [];
      return !usedDays.some(d => Math.abs(d - dayIndex) <= 2);
    });
    
    // For keto, prefer low-carb recipes
    if (isKeto && available.length > 1) {
      available = available.sort((a, b) => {
        const aR = recipeMap.get(a);
        const bR = recipeMap.get(b);
        const aCarbs = aR?.nutrition?.carbs_g ?? Infinity;
        const bCarbs = bR?.nutrition?.carbs_g ?? Infinity;
        return aCarbs - bCarbs;
      });
    }
    
    return {
      slotId,
      candidates: available.length > 0 ? available : recipes,
    };
  });
  
  // Try to find best combination
  const totalCombinations = slotCandidates.reduce((acc, s) => acc * Math.max(s.candidates.length, 1), 1);
  
  if (totalCombinations <= 100 && totalCombinations > 0) {
    // Enumerate all combinations for small pools
    let bestCombo: { slotId: MealSlotId; recipeId: string; multiplier: number }[] = [];
    let bestScore = Infinity;
    
    const enumerate = (index: number, current: string[]): void => {
      if (index === slotCandidates.length) {
        const result = scoreRecipeCombination(current, recipeMap, dailyTargets);
        if (result.score < bestScore) {
          bestScore = result.score;
          bestCombo = slotCandidates.map((s, i) => ({
            slotId: s.slotId,
            recipeId: current[i],
            multiplier: result.slots[i].multiplier,
          }));
        }
        return;
      }
      
      const slot = slotCandidates[index];
      if (slot.candidates.length === 0) {
        enumerate(index + 1, [...current, '']);
        return;
      }
      
      for (const recipeId of slot.candidates) {
        enumerate(index + 1, [...current, recipeId]);
      }
    };
    
    enumerate(0, []);
    return bestCombo;
  }
  
  // Greedy approach for large pools
  const result: { slotId: MealSlotId; recipeId: string; multiplier: number }[] = [];
  const selectedIds: string[] = [];
  
  for (const { slotId, candidates } of slotCandidates) {
    if (candidates.length === 0) {
      result.push({ slotId, recipeId: '', multiplier: 1 });
      selectedIds.push('');
      continue;
    }
    
    let bestRecipe = candidates[0];
    let bestScore = Infinity;
    let bestMult = 1;
    
    for (const recipeId of candidates.slice(0, 10)) { // Limit to top 10 candidates
      const testIds = [...selectedIds, recipeId];
      const scored = scoreRecipeCombination(testIds, recipeMap, dailyTargets);
      if (scored.score < bestScore) {
        bestScore = scored.score;
        bestRecipe = recipeId;
        bestMult = scored.slots[scored.slots.length - 1].multiplier;
      }
    }
    
    result.push({ slotId, recipeId: bestRecipe, multiplier: bestMult });
    selectedIds.push(bestRecipe);
  }
  
  return result;
}

function scoreRecipeCombination(
  recipeIds: string[],
  recipeMap: Map<string, GlobalRecipe>,
  dailyTargets: DailyTargets
): { score: number; slots: { recipeId: string; multiplier: number; macros: RecipeMacros }[] } {
  const slots: { recipeId: string; multiplier: number; macros: RecipeMacros }[] = [];
  
  for (const recipeId of recipeIds) {
    const recipe = recipeMap.get(recipeId);
    const macros = recipe ? getRecipeMacros(recipe) : null;
    slots.push({ recipeId, multiplier: 1, macros: macros || { calories: 0, protein: 0, carbs: 0, fat: 0 } });
  }
  
  // Quick optimization pass
  let currentTotals = slots.reduce(
    (acc, s) => ({
      calories: acc.calories + s.macros.calories,
      protein: acc.protein + s.macros.protein,
      carbs: acc.carbs + s.macros.carbs,
      fat: acc.fat + s.macros.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
  
  const multipliers = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
  
  for (let iter = 0; iter < 10; iter++) {
    let improved = false;
    
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const recipe = recipeMap.get(slot.recipeId);
      const baseMacros = recipe ? getRecipeMacros(recipe) : null;
      if (!baseMacros || baseMacros.calories === 0) continue;
      
      let bestMult = slot.multiplier;
      let bestScore = calculateFitScore(currentTotals, dailyTargets);
      
      for (const mult of multipliers) {
        const newMacros = scaleMacros(baseMacros, mult);
        const testTotals = {
          calories: currentTotals.calories - slot.macros.calories + newMacros.calories,
          protein: currentTotals.protein - slot.macros.protein + newMacros.protein,
          carbs: currentTotals.carbs - slot.macros.carbs + newMacros.carbs,
          fat: currentTotals.fat - slot.macros.fat + newMacros.fat,
        };
        
        const score = calculateFitScore(testTotals, dailyTargets);
        if (score < bestScore - 0.001) {
          bestScore = score;
          bestMult = mult;
        }
      }
      
      if (bestMult !== slot.multiplier) {
        const newMacros = scaleMacros(baseMacros!, bestMult);
        currentTotals = {
          calories: currentTotals.calories - slot.macros.calories + newMacros.calories,
          protein: currentTotals.protein - slot.macros.protein + newMacros.protein,
          carbs: currentTotals.carbs - slot.macros.carbs + newMacros.carbs,
          fat: currentTotals.fat - slot.macros.fat + newMacros.fat,
        };
        slots[i] = { ...slot, multiplier: bestMult, macros: newMacros };
        improved = true;
      }
    }
    
    if (!improved) break;
  }
  
  return { score: calculateFitScore(currentTotals, dailyTargets), slots };
}

// ============================================================================
// Main Generation Function (returns enhanced PlanResult)
// ============================================================================

export function generateMealPlanV2(input: GeneratePlanInput): PlanResult {
  const {
    dailyTargets,
    selectedMealSlots,
    recipePoolsBySlot,
    exactAssignments,
    recipes,
    numberOfDays,
    dietType,
    lockedSlots = {},
    existingPlan,
  } = input;
  
  // Create recipe lookup
  const recipeMap = new Map<string, GlobalRecipe>();
  for (const recipe of recipes) {
    recipeMap.set(recipe.id, recipe);
  }
  
  // Get all pool recipes for suggestions
  const allPoolRecipeIds = new Set<string>();
  Object.values(recipePoolsBySlot).forEach(pool => pool.forEach(id => allPoolRecipeIds.add(id)));
  const recipePool = recipes.filter(r => allPoolRecipeIds.has(r.id));
  
  // Track recently used recipes per slot
  const recentlyUsedBySlot = new Map<string, Map<string, number[]>>();
  for (const slot of selectedMealSlots) {
    recentlyUsedBySlot.set(slot.id, new Map());
  }
  
  const dayResults: DayResult[] = [];
  let hasAnyErrors = false;
  
  for (let dayIndex = 0; dayIndex < numberOfDays; dayIndex++) {
    const dayLocks = lockedSlots[dayIndex] || [];
    const slotsToSolve: Array<{
      slotId: MealSlotId;
      recipeId: string;
      multiplier: number;
      isLocked: boolean;
    }> = [];
    
    // Collect slots for this day
    for (const slot of selectedMealSlots) {
      const isLocked = dayLocks.includes(slot.id);
      
      // Check for locked slot from existing plan
      if (isLocked && existingPlan) {
        const existingSlot = existingPlan.days[dayIndex]?.slots.find(s => s.slotId === slot.id);
        if (existingSlot) {
          slotsToSolve.push({
            slotId: slot.id as MealSlotId,
            recipeId: existingSlot.recipeId,
            multiplier: existingSlot.servingMultiplier,
            isLocked: true,
          });
          
          // Track as used
          const usedMap = recentlyUsedBySlot.get(slot.id)!;
          const usedDays = usedMap.get(existingSlot.recipeId) || [];
          usedMap.set(existingSlot.recipeId, [...usedDays, dayIndex]);
          continue;
        }
      }
      
      // Check for exact assignment
      const exactAssignment = exactAssignments[dayIndex]?.[slot.id];
      if (exactAssignment) {
        slotsToSolve.push({
          slotId: slot.id as MealSlotId,
          recipeId: exactAssignment.recipeId,
          multiplier: exactAssignment.servingMultiplier,
          isLocked,
        });
        
        // Track as used
        const usedMap = recentlyUsedBySlot.get(slot.id)!;
        const usedDays = usedMap.get(exactAssignment.recipeId) || [];
        usedMap.set(exactAssignment.recipeId, [...usedDays, dayIndex]);
        continue;
      }
      
      // Select from pool
      const pool = recipePoolsBySlot[slot.id] || [];
      if (pool.length > 0) {
        const selections = selectBestRecipesForDay(
          [{ slotId: slot.id as MealSlotId, recipes: pool }],
          recipeMap,
          dailyTargets,
          dayIndex,
          recentlyUsedBySlot,
          dietType
        );
        
        if (selections[0]) {
          slotsToSolve.push({
            slotId: slot.id as MealSlotId,
            recipeId: selections[0].recipeId,
            multiplier: selections[0].multiplier,
            isLocked: false,
          });
          
          // Track as used
          if (selections[0].recipeId) {
            const usedMap = recentlyUsedBySlot.get(slot.id)!;
            const usedDays = usedMap.get(selections[0].recipeId) || [];
            usedMap.set(selections[0].recipeId, [...usedDays, dayIndex]);
          }
        }
      } else {
        // No recipes for this slot
        slotsToSolve.push({
          slotId: slot.id as MealSlotId,
          recipeId: '',
          multiplier: 1,
          isLocked: false,
        });
      }
    }
    
    // Run the solver for this day
    const dayResult = solveDay({
      dayIndex,
      slots: slotsToSolve,
      targets: dailyTargets,
      dietType,
      recipes,
      recipePool,
      config: DEFAULT_SOLVER_CONFIG,
    });
    
    dayResults.push(dayResult);
    
    if (dayResult.status === 'needs_changes') {
      hasAnyErrors = true;
    }
  }
  
  // Collect overall flags
  const overallFlags = dayResults.flatMap(d => d.flags.filter(f => f.severity === 'error'));
  
  return {
    status: hasAnyErrors ? 'needs_changes' : 'success',
    days: dayResults,
    overallFlags,
    createdAt: new Date().toISOString(),
  };
}

// ============================================================================
// Legacy Compatibility Layer
// Converts new PlanResult to old GeneratedPlan format for existing store/sync
// ============================================================================

export function convertToLegacyPlan(result: PlanResult): GeneratedPlan {
  const days: GeneratedDay[] = result.days.map(day => ({
    dayIndex: day.dayIndex,
    slots: day.meals.map(meal => ({
      slotId: meal.slot,
      recipeId: meal.recipeId,
      servingMultiplier: meal.multiplier,
      isLocked: meal.isLocked,
      slotTotals: meal.totals,
    })),
    extras: day.addOns.map(addon => ({
      id: addon.id,
      name: addon.name,
      emoji: addon.emoji,
      macros: addon.macros,
    })),
    dayTotals: day.totals,
    deltaVsTarget: day.deltas,
  }));
  
  return {
    days,
    createdAt: result.createdAt,
  };
}

// ============================================================================
// Main Export - Unified Generator (replaces old generateMealPlan)
// ============================================================================

/**
 * Generate a meal plan using the new staged solver.
 * Returns the legacy GeneratedPlan format for backwards compatibility,
 * but also stores the enhanced result in the returned object.
 */
export function generateMealPlan(input: Omit<GeneratePlanInput, 'dietType'> & { dietType?: DietType }): GeneratedPlan & { _enhanced?: PlanResult } {
  // Default to 'default' diet type if not specified
  const fullInput: GeneratePlanInput = {
    ...input,
    dietType: input.dietType || 'default',
  };
  
  // Generate using new solver
  const enhancedResult = generateMealPlanV2(fullInput);
  
  // Convert to legacy format
  const legacyPlan = convertToLegacyPlan(enhancedResult);
  
  // Attach enhanced result for UI access
  return {
    ...legacyPlan,
    _enhanced: enhancedResult,
  };
}

// ============================================================================
// Helper: Recalculate day totals (for UI updates)
// ============================================================================

export function recalculateDayTotals(
  day: GeneratedDay,
  recipes: GlobalRecipe[]
): GeneratedDay {
  const recipeMap = new Map<string, GlobalRecipe>();
  for (const recipe of recipes) {
    recipeMap.set(recipe.id, recipe);
  }
  
  const updatedSlots = day.slots.map(slot => {
    const recipe = recipeMap.get(slot.recipeId);
    const recipeMacros = recipe ? getRecipeMacros(recipe) : null;
    
    if (!recipeMacros) return slot;
    
    return {
      ...slot,
      slotTotals: scaleMacros(recipeMacros, slot.servingMultiplier),
    };
  });
  
  const slotTotals = updatedSlots.reduce(
    (acc, slot) => ({
      calories: acc.calories + slot.slotTotals.calories,
      protein: acc.protein + slot.slotTotals.protein,
      carbs: acc.carbs + slot.slotTotals.carbs,
      fat: acc.fat + slot.slotTotals.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
  
  // Include extras
  const extrasTotals = (day.extras || []).reduce(
    (acc, extra) => ({
      calories: acc.calories + extra.macros.calories,
      protein: acc.protein + extra.macros.protein,
      carbs: acc.carbs + extra.macros.carbs,
      fat: acc.fat + extra.macros.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
  
  const dayTotals = {
    calories: slotTotals.calories + extrasTotals.calories,
    protein: slotTotals.protein + extrasTotals.protein,
    carbs: slotTotals.carbs + extrasTotals.carbs,
    fat: slotTotals.fat + extrasTotals.fat,
  };
  
  return {
    ...day,
    slots: updatedSlots,
    dayTotals,
  };
}

// ============================================================================
// Optimize existing day (for manual tweaks)
// ============================================================================

export function optimizeDayServings(
  day: GeneratedDay,
  recipes: GlobalRecipe[],
  dailyTargets: DailyTargets,
  lockedSlotIds: string[] = []
): GeneratedDay {
  // Use the solver to re-optimize
  const recipeMap = new Map<string, GlobalRecipe>();
  recipes.forEach(r => recipeMap.set(r.id, r));
  
  const dayResult = solveDay({
    dayIndex: day.dayIndex,
    slots: day.slots.map(s => ({
      slotId: s.slotId,
      recipeId: s.recipeId,
      multiplier: s.servingMultiplier,
      isLocked: lockedSlotIds.includes(s.slotId),
    })),
    targets: dailyTargets,
    dietType: 'default',
    recipes,
    recipePool: recipes,
  });
  
  // Convert back to GeneratedDay
  return {
    dayIndex: day.dayIndex,
    slots: dayResult.meals.map(m => ({
      slotId: m.slot,
      recipeId: m.recipeId,
      servingMultiplier: m.multiplier,
      isLocked: m.isLocked,
      slotTotals: m.totals,
    })),
    extras: dayResult.addOns.map(a => ({
      id: a.id,
      name: a.name,
      emoji: a.emoji,
      macros: a.macros,
    })),
    dayTotals: dayResult.totals,
    deltaVsTarget: dayResult.deltas,
  };
}
