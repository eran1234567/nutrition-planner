import type { 
  MealSlot, 
  MealSlotId, 
  DailyTargets, 
  GeneratedPlan, 
  GeneratedDay, 
  GeneratedSlot,
  SERVING_MULTIPLIERS,
} from '@/types/mealPlan';
import type { Recipe } from '@/types';

const MULTIPLIERS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

interface RecipeMacros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

function getRecipeMacros(recipe: Recipe): RecipeMacros | null {
  if (!recipe.nutrition) return null;
  
  return {
    calories: recipe.nutrition.calories ?? 0,
    protein: recipe.nutrition.protein_g ?? 0,
    carbs: recipe.nutrition.carbs_g ?? 0,
    fat: recipe.nutrition.fat_g ?? 0,
  };
}

function calculateSlotTargets(dailyTargets: DailyTargets, percentOfDay: number): RecipeMacros {
  const factor = percentOfDay / 100;
  return {
    calories: Math.round(dailyTargets.calories * factor),
    protein: Math.round(dailyTargets.protein * factor),
    carbs: Math.round(dailyTargets.carbs * factor),
    fat: Math.round(dailyTargets.fat * factor),
  };
}

function calculateMacrosWithMultiplier(macros: RecipeMacros, multiplier: number): RecipeMacros {
  return {
    calories: Math.round(macros.calories * multiplier),
    protein: Math.round(macros.protein * multiplier),
    carbs: Math.round(macros.carbs * multiplier),
    fat: Math.round(macros.fat * multiplier),
  };
}

function calculateFitScore(actual: RecipeMacros, target: RecipeMacros): number {
  // Lower score = better fit
  // Weight protein more heavily (2x)
  return (
    Math.abs(actual.calories - target.calories) +
    2 * Math.abs(actual.protein - target.protein) +
    Math.abs(actual.carbs - target.carbs) +
    Math.abs(actual.fat - target.fat)
  );
}

function findBestMultiplier(
  recipeMacros: RecipeMacros,
  slotTargets: RecipeMacros
): { multiplier: number; macros: RecipeMacros; score: number } {
  let bestResult = {
    multiplier: 1.0,
    macros: recipeMacros,
    score: calculateFitScore(recipeMacros, slotTargets),
  };
  
  for (const multiplier of MULTIPLIERS) {
    const scaledMacros = calculateMacrosWithMultiplier(recipeMacros, multiplier);
    const score = calculateFitScore(scaledMacros, slotTargets);
    
    if (score < bestResult.score) {
      bestResult = { multiplier, macros: scaledMacros, score };
    }
  }
  
  return bestResult;
}

function selectRecipeFromPool(
  pool: string[],
  recipes: Map<string, Recipe>,
  dayIndex: number,
  slotIndex: number,
  recentlyUsed: Map<string, number[]> // recipeId -> [dayIndices where used for this slot]
): string | null {
  if (pool.length === 0) return null;
  
  // Filter out recipes used in the same slot within last 2 days
  const availableRecipes = pool.filter(recipeId => {
    const usedDays = recentlyUsed.get(recipeId) || [];
    return !usedDays.some(d => Math.abs(d - dayIndex) <= 2);
  });
  
  // If all recipes are recently used, allow any
  const candidates = availableRecipes.length > 0 ? availableRecipes : pool;
  
  // Rotate based on day and slot index for variety
  const rotationIndex = (dayIndex + slotIndex) % candidates.length;
  return candidates[rotationIndex];
}

export interface GeneratePlanInput {
  dailyTargets: DailyTargets;
  selectedMealSlots: MealSlot[];
  recipePoolsBySlot: Record<string, string[]>;
  exactAssignments: Record<number, Record<string, { recipeId: string; servingMultiplier: number }>>;
  recipes: Recipe[];
  numberOfDays: number;
  lockedSlots?: Record<number, string[]>;
  existingPlan?: GeneratedPlan | null;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  missingSlots: string[];
}

export function validatePlanInputs(input: GeneratePlanInput): ValidationResult {
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

export function generateMealPlan(input: GeneratePlanInput): GeneratedPlan {
  const {
    dailyTargets,
    selectedMealSlots,
    recipePoolsBySlot,
    exactAssignments,
    recipes,
    numberOfDays,
    lockedSlots = {},
    existingPlan,
  } = input;
  
  // Create recipe lookup
  const recipeMap = new Map<string, Recipe>();
  for (const recipe of recipes) {
    recipeMap.set(recipe.id, recipe);
  }
  
  // Track recently used recipes per slot
  const recentlyUsedBySlot = new Map<string, Map<string, number[]>>();
  for (const slot of selectedMealSlots) {
    recentlyUsedBySlot.set(slot.id, new Map());
  }
  
  const days: GeneratedDay[] = [];
  
  for (let dayIndex = 0; dayIndex < numberOfDays; dayIndex++) {
    const dayLocks = lockedSlots[dayIndex] || [];
    const slots: GeneratedSlot[] = [];
    
    for (let slotIndex = 0; slotIndex < selectedMealSlots.length; slotIndex++) {
      const slot = selectedMealSlots[slotIndex];
      const isLocked = dayLocks.includes(slot.id);
      
      // If locked and we have existing plan, keep the existing assignment
      if (isLocked && existingPlan) {
        const existingSlot = existingPlan.days[dayIndex]?.slots.find(s => s.slotId === slot.id);
        if (existingSlot) {
          slots.push(existingSlot);
          
          // Track as used
          const usedMap = recentlyUsedBySlot.get(slot.id)!;
          const usedDays = usedMap.get(existingSlot.recipeId) || [];
          usedMap.set(existingSlot.recipeId, [...usedDays, dayIndex]);
          
          continue;
        }
      }
      
      // Check for exact assignment first
      const exactAssignment = exactAssignments[dayIndex]?.[slot.id];
      let recipeId: string | null = exactAssignment?.recipeId ?? null;
      let servingMultiplier = exactAssignment?.servingMultiplier ?? 1.0;
      
      // If no exact assignment, select from pool
      if (!recipeId) {
        const pool = recipePoolsBySlot[slot.id] || [];
        const usedMap = recentlyUsedBySlot.get(slot.id)!;
        recipeId = selectRecipeFromPool(pool, recipeMap, dayIndex, slotIndex, usedMap);
      }
      
      if (!recipeId) {
        // No recipe available for this slot
        slots.push({
          slotId: slot.id,
          recipeId: '',
          servingMultiplier: 1.0,
          isLocked: false,
          slotTotals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
        });
        continue;
      }
      
      const recipe = recipeMap.get(recipeId);
      const recipeMacros = recipe ? getRecipeMacros(recipe) : null;
      
      if (!recipeMacros) {
        slots.push({
          slotId: slot.id,
          recipeId,
          servingMultiplier: 1.0,
          isLocked,
          slotTotals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
        });
        continue;
      }
      
      // Calculate optimal multiplier if not exact assignment
      const slotTargets = calculateSlotTargets(dailyTargets, slot.percentOfDay);
      
      if (!exactAssignment) {
        const bestFit = findBestMultiplier(recipeMacros, slotTargets);
        servingMultiplier = bestFit.multiplier;
      }
      
      const slotTotals = calculateMacrosWithMultiplier(recipeMacros, servingMultiplier);
      
      slots.push({
        slotId: slot.id,
        recipeId,
        servingMultiplier,
        isLocked,
        slotTotals,
      });
      
      // Track as used
      const usedMap = recentlyUsedBySlot.get(slot.id)!;
      const usedDays = usedMap.get(recipeId) || [];
      usedMap.set(recipeId, [...usedDays, dayIndex]);
    }
    
    // Calculate day totals
    const dayTotals = slots.reduce(
      (acc, slot) => ({
        calories: acc.calories + slot.slotTotals.calories,
        protein: acc.protein + slot.slotTotals.protein,
        carbs: acc.carbs + slot.slotTotals.carbs,
        fat: acc.fat + slot.slotTotals.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
    
    const deltaVsTarget = {
      calories: dayTotals.calories - dailyTargets.calories,
      protein: dayTotals.protein - dailyTargets.protein,
      carbs: dayTotals.carbs - dailyTargets.carbs,
      fat: dayTotals.fat - dailyTargets.fat,
    };
    
    days.push({
      dayIndex,
      slots,
      dayTotals,
      deltaVsTarget,
    });
  }
  
  return {
    days,
    createdAt: new Date().toISOString(),
  };
}

export function recalculateDayTotals(
  day: GeneratedDay,
  recipes: Recipe[]
): GeneratedDay {
  const recipeMap = new Map<string, Recipe>();
  for (const recipe of recipes) {
    recipeMap.set(recipe.id, recipe);
  }
  
  const updatedSlots = day.slots.map(slot => {
    const recipe = recipeMap.get(slot.recipeId);
    const recipeMacros = recipe ? getRecipeMacros(recipe) : null;
    
    if (!recipeMacros) return slot;
    
    return {
      ...slot,
      slotTotals: calculateMacrosWithMultiplier(recipeMacros, slot.servingMultiplier),
    };
  });
  
  const dayTotals = updatedSlots.reduce(
    (acc, slot) => ({
      calories: acc.calories + slot.slotTotals.calories,
      protein: acc.protein + slot.slotTotals.protein,
      carbs: acc.carbs + slot.slotTotals.carbs,
      fat: acc.fat + slot.slotTotals.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
  
  return {
    ...day,
    slots: updatedSlots,
    dayTotals,
  };
}
