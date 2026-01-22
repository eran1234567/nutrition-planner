import type { 
  MealSlot, 
  MealSlotId, 
  DailyTargets, 
  GeneratedPlan, 
  GeneratedDay, 
  GeneratedSlot,
} from '@/types/mealPlan';
import type { GlobalRecipe } from '@/hooks/useGlobalRecipes';

// Finer-grained multipliers for more precise macro matching (0.05 steps from 0.25 to 5.0)
const MULTIPLIERS: number[] = [];
for (let m = 0.25; m <= 5.0; m += 0.05) {
  MULTIPLIERS.push(Math.round(m * 100) / 100);
}

interface RecipeMacros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

function getRecipeMacros(recipe: GlobalRecipe): RecipeMacros | null {
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

/**
 * Calculate fit score using percentage-based deviation from targets.
 * This ensures all macros are weighted equally regardless of their absolute values.
 * Lower score = better fit.
 */
function calculateFitScore(actual: RecipeMacros, target: RecipeMacros): number {
  // Use percentage deviation from target for each macro
  // This ensures all macros contribute equally to the score
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
  
  // Sum of percentage deviations - all macros weighted equally
  return calorieDeviation + proteinDeviation + carbsDeviation + fatDeviation;
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

/**
 * Optimize day's multipliers to hit daily targets exactly.
 * Uses an iterative approach: find the slot with highest calorie impact 
 * and adjust its multiplier to get closer to target.
 */
/**
 * Optimize day's multipliers using iterative greedy optimization.
 * Uses percentage-based scoring to balance ALL macros equally.
 */
function optimizeDayMultipliers(
  slots: GeneratedSlot[],
  recipeMap: Map<string, GlobalRecipe>,
  dailyTargets: DailyTargets,
  lockedSlotIds: string[]
): GeneratedSlot[] {
  const calculateTotals = (slotList: GeneratedSlot[]): RecipeMacros => {
    return slotList.reduce(
      (acc, slot) => ({
        calories: acc.calories + slot.slotTotals.calories,
        protein: acc.protein + slot.slotTotals.protein,
        carbs: acc.carbs + slot.slotTotals.carbs,
        fat: acc.fat + slot.slotTotals.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  };

  let currentSlots = [...slots];
  let currentTotals = calculateTotals(currentSlots);
  let currentScore = calculateFitScore(currentTotals, dailyTargets);
  
  // Multiple passes for thorough optimization
  const maxIterations = 50;
  let noImprovementCount = 0;
  
  for (let iter = 0; iter < maxIterations && noImprovementCount < 5; iter++) {
    let bestAdjustment: { slotIndex: number; newMultiplier: number; newScore: number } | null = null;
    let bestScore = currentScore;
    
    for (let i = 0; i < currentSlots.length; i++) {
      const slot = currentSlots[i];
      
      if (lockedSlotIds.includes(slot.slotId) || !slot.recipeId) continue;
      
      const recipe = recipeMap.get(slot.recipeId);
      const recipeMacros = recipe ? getRecipeMacros(recipe) : null;
      if (!recipeMacros) continue;
      
      // Try each multiplier
      for (const mult of MULTIPLIERS) {
        if (Math.abs(mult - slot.servingMultiplier) < 0.01) continue;
        
        const newSlotTotals = calculateMacrosWithMultiplier(recipeMacros, mult);
        
        const testTotals: RecipeMacros = {
          calories: currentTotals.calories - slot.slotTotals.calories + newSlotTotals.calories,
          protein: currentTotals.protein - slot.slotTotals.protein + newSlotTotals.protein,
          carbs: currentTotals.carbs - slot.slotTotals.carbs + newSlotTotals.carbs,
          fat: currentTotals.fat - slot.slotTotals.fat + newSlotTotals.fat,
        };
        
        const score = calculateFitScore(testTotals, dailyTargets);
        
        if (score < bestScore - 0.001) { // Small threshold to avoid floating point issues
          bestScore = score;
          bestAdjustment = { slotIndex: i, newMultiplier: mult, newScore: score };
        }
      }
    }
    
    if (bestAdjustment) {
      const slot = currentSlots[bestAdjustment.slotIndex];
      const recipe = recipeMap.get(slot.recipeId);
      const recipeMacros = recipe ? getRecipeMacros(recipe) : null;
      
      if (recipeMacros) {
        currentSlots = currentSlots.map((s, idx) => 
          idx === bestAdjustment!.slotIndex
            ? {
                ...s,
                servingMultiplier: bestAdjustment!.newMultiplier,
                slotTotals: calculateMacrosWithMultiplier(recipeMacros, bestAdjustment!.newMultiplier),
              }
            : s
        );
        currentTotals = calculateTotals(currentSlots);
        currentScore = bestAdjustment.newScore;
        noImprovementCount = 0;
      }
    } else {
      noImprovementCount++;
    }
    
    // Check if we're close enough (all macros within 2%)
    const allMacrosWithin2Percent = 
      (dailyTargets.calories === 0 || Math.abs(currentTotals.calories - dailyTargets.calories) / dailyTargets.calories < 0.02) &&
      (dailyTargets.protein === 0 || Math.abs(currentTotals.protein - dailyTargets.protein) / dailyTargets.protein < 0.02) &&
      (dailyTargets.carbs === 0 || Math.abs(currentTotals.carbs - dailyTargets.carbs) / dailyTargets.carbs < 0.02) &&
      (dailyTargets.fat === 0 || Math.abs(currentTotals.fat - dailyTargets.fat) / dailyTargets.fat < 0.02);
    
    if (allMacrosWithin2Percent) break;
  }
  
  return currentSlots;
}

/**
 * Public function to optimize a single day's servings to hit targets.
 * Returns the optimized day with updated slots and totals.
 */
export function optimizeDayServings(
  day: GeneratedDay,
  recipes: GlobalRecipe[],
  dailyTargets: DailyTargets,
  lockedSlotIds: string[] = []
): GeneratedDay {
  const recipeMap = new Map<string, GlobalRecipe>();
  for (const recipe of recipes) {
    recipeMap.set(recipe.id, recipe);
  }

  const optimizedSlots = optimizeDayMultipliers(
    day.slots,
    recipeMap,
    dailyTargets,
    lockedSlotIds
  );

  // Recalculate day totals
  const dayTotals = optimizedSlots.reduce(
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

  return {
    ...day,
    slots: optimizedSlots,
    dayTotals,
    deltaVsTarget,
  };
}

/**
 * Score how well a set of recipes with optimized multipliers hits daily targets.
 * Used to find the best combination of recipes across all slots.
 */
function scoreRecipeCombination(
  recipeIds: string[],
  recipeMap: Map<string, GlobalRecipe>,
  dailyTargets: DailyTargets
): { score: number; slots: { recipeId: string; multiplier: number; macros: RecipeMacros }[] } {
  const slots: { recipeId: string; multiplier: number; macros: RecipeMacros }[] = [];
  
  for (const recipeId of recipeIds) {
    const recipe = recipeMap.get(recipeId);
    const macros = recipe ? getRecipeMacros(recipe) : null;
    
    if (!macros) {
      slots.push({ recipeId, multiplier: 1, macros: { calories: 0, protein: 0, carbs: 0, fat: 0 } });
      continue;
    }
    
    slots.push({ recipeId, multiplier: 1, macros });
  }
  
  // Now optimize multipliers for this combination
  let currentTotals = slots.reduce(
    (acc, s) => ({
      calories: acc.calories + s.macros.calories,
      protein: acc.protein + s.macros.protein,
      carbs: acc.carbs + s.macros.carbs,
      fat: acc.fat + s.macros.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
  
  // Iterative optimization for this combination
  for (let iter = 0; iter < 30; iter++) {
    let improved = false;
    
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const recipe = recipeMap.get(slot.recipeId);
      const baseMacros = recipe ? getRecipeMacros(recipe) : null;
      if (!baseMacros || baseMacros.calories === 0) continue;
      
      let bestMult = slot.multiplier;
      let bestScore = calculateFitScore(currentTotals, dailyTargets);
      
      for (const mult of MULTIPLIERS) {
        if (Math.abs(mult - slot.multiplier) < 0.01) continue;
        
        const newMacros = calculateMacrosWithMultiplier(baseMacros, mult);
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
        const baseMacrosAgain = getRecipeMacros(recipeMap.get(slot.recipeId)!)!;
        const newMacros = calculateMacrosWithMultiplier(baseMacrosAgain, bestMult);
        
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
  
  const finalScore = calculateFitScore(currentTotals, dailyTargets);
  return { score: finalScore, slots };
}

/**
 * Select the best recipes from pools that together hit daily targets.
 * Uses a greedy approach with look-ahead optimization.
 */
function selectBestRecipesForDay(
  pools: { slotId: string; recipes: string[] }[],
  recipeMap: Map<string, GlobalRecipe>,
  dailyTargets: DailyTargets,
  dayIndex: number,
  recentlyUsedBySlot: Map<string, Map<string, number[]>>
): { slotId: string; recipeId: string; multiplier: number }[] {
  // For each slot, get available recipes (not used within 2 days)
  const slotCandidates = pools.map(({ slotId, recipes }) => {
    const usedMap = recentlyUsedBySlot.get(slotId) || new Map();
    const available = recipes.filter(recipeId => {
      const usedDays = usedMap.get(recipeId) || [];
      return !usedDays.some(d => Math.abs(d - dayIndex) <= 2);
    });
    return {
      slotId,
      candidates: available.length > 0 ? available : recipes,
    };
  });
  
  // If small enough, try all combinations
  const totalCombinations = slotCandidates.reduce((acc, s) => acc * Math.max(s.candidates.length, 1), 1);
  
  if (totalCombinations <= 100 && totalCombinations > 0) {
    // Enumerate all combinations
    let bestCombo: { slotId: string; recipeId: string; multiplier: number }[] = [];
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
  
  // For large pools, use greedy approach with scoring
  const result: { slotId: string; recipeId: string; multiplier: number }[] = [];
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
    
    for (const recipeId of candidates) {
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
  
  // Final optimization pass on the selected combination
  const finalScored = scoreRecipeCombination(selectedIds, recipeMap, dailyTargets);
  return result.map((r, i) => ({
    ...r,
    multiplier: finalScored.slots[i]?.multiplier ?? r.multiplier,
  }));
}

export interface GeneratePlanInput {
  dailyTargets: DailyTargets;
  selectedMealSlots: MealSlot[];
  recipePoolsBySlot: Record<string, string[]>;
  exactAssignments: Record<number, Record<string, { recipeId: string; servingMultiplier: number }>>;
  recipes: GlobalRecipe[];
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
  const recipeMap = new Map<string, GlobalRecipe>();
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
    
    // Separate locked slots (keep from existing) vs unlocked slots (need to select)
    const lockedSlotResults: GeneratedSlot[] = [];
    const unlockedSlotInfos: { slotId: string; recipes: string[] }[] = [];
    const exactSlotResults: GeneratedSlot[] = [];
    
    for (const slot of selectedMealSlots) {
      const isLocked = dayLocks.includes(slot.id);
      
      // If locked and we have existing plan, keep the existing assignment
      if (isLocked && existingPlan) {
        const existingSlot = existingPlan.days[dayIndex]?.slots.find(s => s.slotId === slot.id);
        if (existingSlot) {
          lockedSlotResults.push(existingSlot);
          
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
        const recipe = recipeMap.get(exactAssignment.recipeId);
        const recipeMacros = recipe ? getRecipeMacros(recipe) : null;
        
        exactSlotResults.push({
          slotId: slot.id,
          recipeId: exactAssignment.recipeId,
          servingMultiplier: exactAssignment.servingMultiplier,
          isLocked,
          slotTotals: recipeMacros 
            ? calculateMacrosWithMultiplier(recipeMacros, exactAssignment.servingMultiplier)
            : { calories: 0, protein: 0, carbs: 0, fat: 0 },
        });
        
        // Track as used
        const usedMap = recentlyUsedBySlot.get(slot.id)!;
        const usedDays = usedMap.get(exactAssignment.recipeId) || [];
        usedMap.set(exactAssignment.recipeId, [...usedDays, dayIndex]);
        continue;
      }
      
      // Need to select from pool
      const pool = recipePoolsBySlot[slot.id] || [];
      if (pool.length > 0) {
        unlockedSlotInfos.push({ slotId: slot.id, recipes: pool });
      } else {
        // No recipes for this slot
        exactSlotResults.push({
          slotId: slot.id,
          recipeId: '',
          servingMultiplier: 1.0,
          isLocked: false,
          slotTotals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
        });
      }
    }
    
    // Calculate remaining targets after locked/exact slots
    const fixedTotals = [...lockedSlotResults, ...exactSlotResults].reduce(
      (acc, slot) => ({
        calories: acc.calories + slot.slotTotals.calories,
        protein: acc.protein + slot.slotTotals.protein,
        carbs: acc.carbs + slot.slotTotals.carbs,
        fat: acc.fat + slot.slotTotals.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
    
    const remainingTargets: DailyTargets = {
      calories: Math.max(0, dailyTargets.calories - fixedTotals.calories),
      protein: Math.max(0, dailyTargets.protein - fixedTotals.protein),
      carbs: Math.max(0, dailyTargets.carbs - fixedTotals.carbs),
      fat: Math.max(0, dailyTargets.fat - fixedTotals.fat),
    };
    
    // Select best recipes for unlocked slots using holistic optimization
    let selectedSlots: GeneratedSlot[] = [];
    
    if (unlockedSlotInfos.length > 0) {
      const bestSelections = selectBestRecipesForDay(
        unlockedSlotInfos,
        recipeMap,
        remainingTargets,
        dayIndex,
        recentlyUsedBySlot
      );
      
      selectedSlots = bestSelections.map(sel => {
        const recipe = recipeMap.get(sel.recipeId);
        const recipeMacros = recipe ? getRecipeMacros(recipe) : null;
        
        // Track as used
        if (sel.recipeId) {
          const usedMap = recentlyUsedBySlot.get(sel.slotId)!;
          const usedDays = usedMap.get(sel.recipeId) || [];
          usedMap.set(sel.recipeId, [...usedDays, dayIndex]);
        }
        
        return {
          slotId: sel.slotId as MealSlotId,
          recipeId: sel.recipeId,
          servingMultiplier: sel.multiplier,
          isLocked: false,
          slotTotals: recipeMacros 
            ? calculateMacrosWithMultiplier(recipeMacros, sel.multiplier)
            : { calories: 0, protein: 0, carbs: 0, fat: 0 },
        };
      });
    }
    
    // Combine all slots in the right order
    const allSlotIds = selectedMealSlots.map(s => s.id);
    const slotResultMap = new Map<string, GeneratedSlot>();
    
    [...lockedSlotResults, ...exactSlotResults, ...selectedSlots].forEach(slot => {
      slotResultMap.set(slot.slotId, slot);
    });
    
    const orderedSlots = allSlotIds
      .map(id => slotResultMap.get(id))
      .filter((s): s is GeneratedSlot => s !== undefined);
    
    // Final optimization pass to fine-tune multipliers
    const optimizedSlots = optimizeDayMultipliers(
      orderedSlots, 
      recipeMap, 
      dailyTargets, 
      dayLocks
    );
    
    // Calculate day totals after optimization
    const dayTotals = optimizedSlots.reduce(
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
      slots: optimizedSlots,
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
