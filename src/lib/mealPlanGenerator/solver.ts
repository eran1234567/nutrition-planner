// ============================================================================
// Staged Meal Plan Solver
// A deterministic, fast algorithm that:
// 1. Fits calories first
// 2. Applies diet-specific macro corrections with add-ons
// 3. Evaluates feasibility and generates suggestions
// ============================================================================

import type { GlobalRecipe } from '@/hooks/useGlobalRecipes';
import type { MealSlotId, DailyTargets } from '@/types/mealPlan';
import type {
  RecipeMacros,
  DietType,
  PlanMeal,
  AppliedAddOn,
  DayResult,
  PlanFlagDetail,
  SwapSuggestion,
  AddOnSuggestion,
  SolverConfig,
  AddOn,
} from './types';
import { DEFAULT_SOLVER_CONFIG } from './types';
import { ADD_ONS_LIBRARY, calculateAddOnMacros, getAddOnsByPrimaryMacro } from './addOnsLibrary';

// ============================================================================
// Utility Functions
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

function scaleMacros(macros: RecipeMacros, multiplier: number): RecipeMacros {
  return {
    calories: Math.round(macros.calories * multiplier),
    protein: Math.round(macros.protein * multiplier * 10) / 10,
    carbs: Math.round(macros.carbs * multiplier * 10) / 10,
    fat: Math.round(macros.fat * multiplier * 10) / 10,
  };
}

function sumMacros(items: RecipeMacros[]): RecipeMacros {
  return items.reduce(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fat: acc.fat + m.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

// ============================================================================
// Stage 1: Calorie Fit with Selected Recipes Only
// ============================================================================

interface MealState {
  slotId: MealSlotId;
  recipeId: string;
  recipeName: string;
  baseMacros: RecipeMacros;
  multiplier: number;
  isLocked: boolean;
  caloriesPerServing: number;
}

/**
 * Adjusts multipliers to match target calories within tolerance.
 * Starts all at 1.0, then scales up/down based on calorie efficiency.
 */
function fitCalories(
  meals: MealState[],
  targetCalories: number,
  config: SolverConfig
): MealState[] {
  const result = meals.map(m => ({ ...m }));
  const unlockedMeals = result.filter(m => !m.isLocked && m.baseMacros.calories > 0);
  
  if (unlockedMeals.length === 0) return result;
  
  const tolerance = targetCalories * config.calorieTolerancePercent;
  const maxIterations = 100;
  
  for (let iter = 0; iter < maxIterations; iter++) {
    // Calculate current total
    const currentTotal = result.reduce(
      (sum, m) => sum + scaleMacros(m.baseMacros, m.multiplier).calories,
      0
    );
    
    const delta = targetCalories - currentTotal;
    
    // Check if within tolerance
    if (Math.abs(delta) <= tolerance) break;
    
    // Sort unlocked meals by calorie efficiency (calories per serving)
    const sortedUnlocked = [...unlockedMeals].sort((a, b) => {
      // For increasing: prioritize high-calorie meals
      // For decreasing: prioritize low-calorie meals (so we reduce them more)
      return delta > 0 
        ? b.caloriesPerServing - a.caloriesPerServing
        : a.caloriesPerServing - b.caloriesPerServing;
    });
    
    // Adjust the most efficient meal
    const targetMeal = sortedUnlocked[0];
    const mealIndex = result.findIndex(m => m.slotId === targetMeal.slotId);
    
    if (mealIndex === -1) break;
    
    const meal = result[mealIndex];
    const currentMealCals = scaleMacros(meal.baseMacros, meal.multiplier).calories;
    
    // Calculate desired new calories for this meal
    const desiredDelta = delta * 0.5; // Take half the gap at a time for stability
    const desiredNewCals = currentMealCals + desiredDelta;
    const desiredMultiplier = meal.baseMacros.calories > 0 
      ? desiredNewCals / meal.baseMacros.calories 
      : 1;
    
    // Clamp and round to step
    const newMultiplier = roundToStep(
      clamp(desiredMultiplier, config.minMultiplier, config.maxMultiplier),
      config.multiplierStep
    );
    
    // Update if different
    if (Math.abs(newMultiplier - meal.multiplier) >= config.multiplierStep / 2) {
      result[mealIndex] = { ...meal, multiplier: newMultiplier };
    } else {
      // Can't adjust further, try next meal
      break;
    }
  }
  
  return result;
}

// ============================================================================
// Stage 2: Diet-Specific Macro Correction with Add-Ons
// ============================================================================

interface Stage2Result {
  meals: MealState[];
  addOns: AppliedAddOn[];
  flags: PlanFlagDetail[];
}

/**
 * For Keto: Enforce carb cap, then balance fat/protein
 * For Default: Prioritize protein, then carbs, then fat
 */
function applyMacroCorrestions(
  meals: MealState[],
  targets: DailyTargets,
  dietType: DietType,
  config: SolverConfig
): Stage2Result {
  let currentMeals = [...meals];
  const addOns: AppliedAddOn[] = [];
  const flags: PlanFlagDetail[] = [];
  
  const isKeto = dietType === 'keto' || dietType === 'low_carb';
  
  // Calculate current totals
  const getMealTotals = () => sumMacros(currentMeals.map(m => scaleMacros(m.baseMacros, m.multiplier)));
  let totals = getMealTotals();
  
  // ===== KETO: Enforce carb cap first =====
  if (isKeto) {
    const carbCap = targets.carbs;
    const maxAllowedCarbs = carbCap + config.ketoCarbCapOvershootGrams;
    
    if (totals.carbs > maxAllowedCarbs) {
      // Sort unlocked meals by carbs (highest first) and reduce multipliers
      const unlockedByCarbs = currentMeals
        .filter(m => !m.isLocked && m.baseMacros.carbs > 0)
        .sort((a, b) => {
          const aCarbs = scaleMacros(a.baseMacros, a.multiplier).carbs;
          const bCarbs = scaleMacros(b.baseMacros, b.multiplier).carbs;
          return bCarbs - aCarbs;
        });
      
      for (const meal of unlockedByCarbs) {
        if (totals.carbs <= maxAllowedCarbs) break;
        
        const mealIndex = currentMeals.findIndex(m => m.slotId === meal.slotId);
        const currentMultiplier = currentMeals[mealIndex].multiplier;
        
        // Try reducing multiplier
        for (let mult = currentMultiplier - config.multiplierStep; mult >= config.minMultiplier; mult -= config.multiplierStep) {
          const newMult = roundToStep(mult, config.multiplierStep);
          const newCarbs = sumMacros(
            currentMeals.map((m, i) => 
              scaleMacros(m.baseMacros, i === mealIndex ? newMult : m.multiplier)
            )
          ).carbs;
          
          if (newCarbs <= maxAllowedCarbs) {
            currentMeals[mealIndex] = { ...currentMeals[mealIndex], multiplier: newMult };
            
            // Flag if below preferred minimum
            if (newMult < config.preferredMinMultiplier) {
              flags.push({
                flag: 'multiplier_below_minimum',
                message: `${meal.recipeName} serving reduced to ${newMult}x to meet carb target`,
                severity: 'warning',
                slot: meal.slotId,
              });
            }
            break;
          }
        }
        
        totals = getMealTotals();
      }
      
      // Recalculate totals after carb adjustment
      totals = getMealTotals();
      
      // If still over cap, flag it
      if (totals.carbs > maxAllowedCarbs) {
        flags.push({
          flag: 'carbs_over_cap',
          message: `Carbs (${Math.round(totals.carbs)}g) exceed keto limit (${carbCap}g)`,
          severity: 'error',
        });
      }
    }
  }
  
  // ===== Apply Add-Ons to fill macro gaps =====
  totals = getMealTotals();
  const addOnTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  
  // Determine priority order based on diet
  const macroPriority: Array<'protein' | 'carbs' | 'fat'> = isKeto
    ? ['fat', 'protein'] // Keto: minimize carbs, prioritize fat, then protein
    : ['protein', 'carbs', 'fat']; // Default: protein first
  
  let addOnCount = 0;
  let oilButterCount = 0;
  let powderCount = 0;
  
  for (const macro of macroPriority) {
    if (addOnCount >= config.maxAddOnsPerDay) break;
    
    const currentValue = totals[macro] + addOnTotals[macro];
    const targetValue = targets[macro];
    const gap = targetValue - currentValue;
    
    // Only add if we're significantly below target (>5% gap)
    if (gap <= targetValue * 0.05) continue;
    
    // Skip carbs for keto
    if (isKeto && macro === 'carbs') continue;
    
    // Find suitable add-ons
    const candidates = getAddOnsByPrimaryMacro(macro);
    
    for (const addOn of candidates) {
      if (addOnCount >= config.maxAddOnsPerDay) break;
      
      // Check category limits
      const isOilButter = ['olive-oil', 'butter', 'coconut-oil'].includes(addOn.id);
      const isPowder = ['whey-isolate', 'collagen-peptides'].includes(addOn.id);
      
      if (isOilButter && oilButterCount >= config.maxOilButterTbspPerDay) continue;
      if (isPowder && powderCount >= config.maxPowderScoopsPerDay) continue;
      
      // Calculate how much we need
      const macroPerUnit = addOn.macrosPerUnit[macro];
      if (macroPerUnit <= 0) continue;
      
      const unitsNeeded = gap / macroPerUnit;
      const quantity = roundToStep(
        clamp(unitsNeeded, addOn.stepSize, addOn.maxPerDay),
        addOn.stepSize
      );
      
      if (quantity < addOn.stepSize) continue;
      
      const macros = calculateAddOnMacros(addOn, quantity);
      
      // Check if this would push carbs over for keto
      if (isKeto && macros.carbs > 2) continue;
      
      // Check calorie impact doesn't overshoot
      const newCalories = totals.calories + addOnTotals.calories + macros.calories;
      if (newCalories > targets.calories * (1 + config.calorieTolerancePercent * 2)) continue;
      
      // Apply add-on
      addOns.push({
        id: `${addOn.id}-${Date.now()}-${addOnCount}`,
        addOnId: addOn.id,
        name: addOn.name,
        emoji: addOn.emoji,
        quantity,
        unit: addOn.unit,
        slot: 'day',
        macros,
        reason: `Add ${macro} to meet daily target`,
      });
      
      addOnTotals.calories += macros.calories;
      addOnTotals.protein += macros.protein;
      addOnTotals.carbs += macros.carbs;
      addOnTotals.fat += macros.fat;
      
      addOnCount++;
      if (isOilButter) oilButterCount += quantity;
      if (isPowder) powderCount += quantity;
      
      break; // One add-on per macro gap
    }
  }
  
  return { meals: currentMeals, addOns, flags };
}

// ============================================================================
// Stage 3: Feasibility Evaluation & Suggestions
// ============================================================================

interface Stage3Result {
  status: 'success' | 'needs_changes';
  flags: PlanFlagDetail[];
  suggestions: {
    swaps: SwapSuggestion[];
    addOns: AddOnSuggestion[];
  };
}

function evaluateFeasibility(
  meals: MealState[],
  addOns: AppliedAddOn[],
  targets: DailyTargets,
  dietType: DietType,
  recipePool: GlobalRecipe[],
  existingFlags: PlanFlagDetail[],
  config: SolverConfig
): Stage3Result {
  const flags: PlanFlagDetail[] = [...existingFlags];
  const swapSuggestions: SwapSuggestion[] = [];
  const addOnSuggestions: AddOnSuggestion[] = [];
  
  const isKeto = dietType === 'keto' || dietType === 'low_carb';
  
  // Calculate final totals
  const mealTotals = sumMacros(meals.map(m => scaleMacros(m.baseMacros, m.multiplier)));
  const addOnTotals = sumMacros(addOns.map(a => a.macros));
  const totals = sumMacros([mealTotals, addOnTotals]);
  
  // Check calories
  const calorieDelta = totals.calories - targets.calories;
  const calorieDeviationPercent = Math.abs(calorieDelta) / targets.calories;
  
  if (calorieDeviationPercent > config.calorieTolerancePercent) {
    flags.push({
      flag: calorieDelta < 0 ? 'calories_too_low' : 'calories_too_high',
      message: `Calories ${calorieDelta < 0 ? 'below' : 'above'} target by ${Math.abs(Math.round(calorieDelta))} kcal`,
      severity: calorieDeviationPercent > 0.05 ? 'error' : 'warning',
    });
  }
  
  // Check protein
  const proteinDelta = totals.protein - targets.protein;
  const proteinDeviationPercent = Math.abs(proteinDelta) / targets.protein;
  
  if (proteinDeviationPercent > config.macroLargeDeviationPercent) {
    flags.push({
      flag: proteinDelta < 0 ? 'protein_too_low' : 'protein_too_high',
      message: `Protein ${proteinDelta < 0 ? 'below' : 'above'} target by ${Math.abs(Math.round(proteinDelta))}g`,
      severity: proteinDelta < 0 ? 'error' : 'warning',
    });
  }
  
  // Check carbs (especially for keto)
  const carbsDelta = totals.carbs - targets.carbs;
  if (isKeto && carbsDelta > config.ketoCarbCapOvershootGrams) {
    if (!flags.some(f => f.flag === 'carbs_over_cap')) {
      flags.push({
        flag: 'carbs_over_cap',
        message: `Carbs exceed keto limit by ${Math.round(carbsDelta - config.ketoCarbCapOvershootGrams)}g`,
        severity: 'error',
      });
    }
  } else if (!isKeto && Math.abs(carbsDelta) / targets.carbs > config.macroLargeDeviationPercent) {
    flags.push({
      flag: carbsDelta < 0 ? 'carbs_too_low' : 'carbs_over_cap',
      message: `Carbs ${carbsDelta < 0 ? 'below' : 'above'} target by ${Math.abs(Math.round(carbsDelta))}g`,
      severity: 'warning',
    });
  }
  
  // Check fat
  const fatDelta = totals.fat - targets.fat;
  const fatDeviationPercent = Math.abs(fatDelta) / targets.fat;
  
  if (fatDeviationPercent > config.macroLargeDeviationPercent) {
    flags.push({
      flag: fatDelta < 0 ? 'fat_too_low' : 'fat_too_high',
      message: `Fat ${fatDelta < 0 ? 'below' : 'above'} target by ${Math.abs(Math.round(fatDelta))}g`,
      severity: 'warning',
    });
  }
  
  // ===== Generate swap suggestions if needed =====
  const hasErrors = flags.some(f => f.severity === 'error');
  
  if (hasErrors) {
    // Find the primary problem
    const primaryIssue = flags.find(f => f.severity === 'error');
    
    if (primaryIssue) {
      // Get pool recipes not currently in use
      const usedRecipeIds = new Set(meals.map(m => m.recipeId));
      const availableRecipes = recipePool.filter(r => !usedRecipeIds.has(r.id) && getRecipeMacros(r));
      
      // Sort recipes based on the issue
      let sortedCandidates: GlobalRecipe[] = [];
      
      if (primaryIssue.flag === 'carbs_over_cap') {
        // Suggest low-carb recipes
        sortedCandidates = availableRecipes
          .filter(r => {
            const macros = getRecipeMacros(r);
            return macros && macros.carbs < 10; // Low carb threshold
          })
          .sort((a, b) => {
            const aM = getRecipeMacros(a)!;
            const bM = getRecipeMacros(b)!;
            return aM.carbs - bM.carbs;
          });
      } else if (primaryIssue.flag === 'protein_too_low') {
        // Suggest high-protein recipes
        sortedCandidates = availableRecipes
          .sort((a, b) => {
            const aM = getRecipeMacros(a)!;
            const bM = getRecipeMacros(b)!;
            // Protein per calorie efficiency
            return (bM.protein / bM.calories) - (aM.protein / aM.calories);
          });
      } else if (primaryIssue.flag === 'calories_too_low' || primaryIssue.flag === 'calories_too_high') {
        // Suggest recipes with appropriate calorie density
        const needMore = primaryIssue.flag === 'calories_too_low';
        sortedCandidates = availableRecipes.sort((a, b) => {
          const aM = getRecipeMacros(a)!;
          const bM = getRecipeMacros(b)!;
          return needMore 
            ? bM.calories - aM.calories 
            : aM.calories - bM.calories;
        });
      }
      
      // Find meal to replace (the one contributing most to the problem)
      let mealToReplace: MealState | null = null;
      
      if (primaryIssue.flag === 'carbs_over_cap') {
        // Replace highest-carb meal
        mealToReplace = [...meals]
          .filter(m => !m.isLocked)
          .sort((a, b) => {
            const aCarbs = scaleMacros(a.baseMacros, a.multiplier).carbs;
            const bCarbs = scaleMacros(b.baseMacros, b.multiplier).carbs;
            return bCarbs - aCarbs;
          })[0] || null;
      } else if (primaryIssue.flag === 'protein_too_low') {
        // Replace lowest-protein meal
        mealToReplace = [...meals]
          .filter(m => !m.isLocked)
          .sort((a, b) => {
            const aP = scaleMacros(a.baseMacros, a.multiplier).protein;
            const bP = scaleMacros(b.baseMacros, b.multiplier).protein;
            return aP - bP;
          })[0] || null;
      }
      
      // Generate up to 3 swap suggestions
      if (mealToReplace) {
        const currentMacros = scaleMacros(mealToReplace.baseMacros, mealToReplace.multiplier);
        
        for (let i = 0; i < Math.min(3, sortedCandidates.length); i++) {
          const candidate = sortedCandidates[i];
          const candidateMacros = getRecipeMacros(candidate)!;
          
          swapSuggestions.push({
            replaceSlot: mealToReplace.slotId,
            removeRecipeId: mealToReplace.recipeId,
            removeRecipeName: mealToReplace.recipeName,
            suggestedRecipeId: candidate.id,
            suggestedRecipeName: candidate.title,
            reason: getSwapReason(primaryIssue.flag, candidate, candidateMacros),
            estimatedImpact: {
              calories: candidateMacros.calories - currentMacros.calories,
              protein: candidateMacros.protein - currentMacros.protein,
              carbs: candidateMacros.carbs - currentMacros.carbs,
              fat: candidateMacros.fat - currentMacros.fat,
            },
          });
        }
      }
    }
    
    // Generate add-on suggestions
    if (proteinDelta < 0 && Math.abs(proteinDelta) > 10) {
      const proteinAddOns = getAddOnsByPrimaryMacro('protein');
      for (const addOn of proteinAddOns.slice(0, 2)) {
        const quantity = roundToStep(
          Math.min(addOn.maxPerDay, Math.abs(proteinDelta) / addOn.macrosPerUnit.protein),
          addOn.stepSize
        );
        if (quantity >= addOn.stepSize) {
          addOnSuggestions.push({
            addOnId: addOn.id,
            name: addOn.name,
            emoji: addOn.emoji,
            suggestedQuantity: quantity,
            unit: addOn.unit,
            slot: 'day',
            reason: `Add ~${Math.round(addOn.macrosPerUnit.protein * quantity)}g protein`,
            macros: calculateAddOnMacros(addOn, quantity),
          });
        }
      }
    }
    
    if (fatDelta < 0 && Math.abs(fatDelta) > 10 && !isKeto) {
      const fatAddOns = getAddOnsByPrimaryMacro('fat');
      for (const addOn of fatAddOns.slice(0, 2)) {
        const quantity = roundToStep(
          Math.min(addOn.maxPerDay, Math.abs(fatDelta) / addOn.macrosPerUnit.fat),
          addOn.stepSize
        );
        if (quantity >= addOn.stepSize) {
          addOnSuggestions.push({
            addOnId: addOn.id,
            name: addOn.name,
            emoji: addOn.emoji,
            suggestedQuantity: quantity,
            unit: addOn.unit,
            slot: 'day',
            reason: `Add ~${Math.round(addOn.macrosPerUnit.fat * quantity)}g fat`,
            macros: calculateAddOnMacros(addOn, quantity),
          });
        }
      }
    }
  }
  
  // Determine status
  const status = hasErrors ? 'needs_changes' : 'success';
  
  return {
    status,
    flags,
    suggestions: {
      swaps: swapSuggestions.slice(0, 5),
      addOns: addOnSuggestions.slice(0, 4),
    },
  };
}

function getSwapReason(flag: string, recipe: GlobalRecipe, macros: RecipeMacros): string {
  switch (flag) {
    case 'carbs_over_cap':
      return `Low carb option (${Math.round(macros.carbs)}g carbs)`;
    case 'protein_too_low':
      return `High protein (${Math.round(macros.protein)}g per serving)`;
    case 'calories_too_low':
      return `Higher calories (${Math.round(macros.calories)} kcal)`;
    case 'calories_too_high':
      return `Lower calories (${Math.round(macros.calories)} kcal)`;
    default:
      return 'Better macro balance';
  }
}

// ============================================================================
// Main Solver Function
// ============================================================================

export interface SolveDayInput {
  dayIndex: number;
  slots: Array<{
    slotId: MealSlotId;
    recipeId: string;
    multiplier: number;
    isLocked: boolean;
  }>;
  targets: DailyTargets;
  dietType: DietType;
  recipes: GlobalRecipe[];
  recipePool: GlobalRecipe[];
  config?: SolverConfig;
}

export function solveDay(input: SolveDayInput): DayResult {
  const { dayIndex, slots, targets, dietType, recipes, recipePool, config = DEFAULT_SOLVER_CONFIG } = input;
  
  // Build recipe map
  const recipeMap = new Map<string, GlobalRecipe>();
  recipes.forEach(r => recipeMap.set(r.id, r));
  
  // Initialize meal states
  const initialMeals: MealState[] = slots.map(slot => {
    const recipe = recipeMap.get(slot.recipeId);
    const baseMacros = recipe ? getRecipeMacros(recipe) : null;
    
    return {
      slotId: slot.slotId,
      recipeId: slot.recipeId,
      recipeName: recipe?.title || 'Unknown Recipe',
      baseMacros: baseMacros || { calories: 0, protein: 0, carbs: 0, fat: 0 },
      multiplier: slot.multiplier,
      isLocked: slot.isLocked,
      caloriesPerServing: baseMacros?.calories || 0,
    };
  });
  
  // Stage 1: Fit calories
  const afterCalorieFit = fitCalories(initialMeals, targets.calories, config);
  
  // Stage 2: Apply macro corrections with add-ons
  const { meals: correctedMeals, addOns, flags: correctionFlags } = applyMacroCorrestions(
    afterCalorieFit,
    targets,
    dietType,
    config
  );
  
  // Stage 3: Evaluate feasibility and generate suggestions
  const { status, flags, suggestions } = evaluateFeasibility(
    correctedMeals,
    addOns,
    targets,
    dietType,
    recipePool,
    correctionFlags,
    config
  );
  
  // Calculate final totals
  const mealTotals = sumMacros(correctedMeals.map(m => scaleMacros(m.baseMacros, m.multiplier)));
  const addOnTotals = sumMacros(addOns.map(a => a.macros));
  const totals = sumMacros([mealTotals, addOnTotals]);
  
  const deltas = {
    calories: totals.calories - targets.calories,
    protein: totals.protein - targets.protein,
    carbs: totals.carbs - targets.carbs,
    fat: totals.fat - targets.fat,
  };
  
  // Convert to output format
  const planMeals: PlanMeal[] = correctedMeals.map(m => ({
    slot: m.slotId,
    recipeId: m.recipeId,
    recipeName: m.recipeName,
    multiplier: m.multiplier,
    isLocked: m.isLocked,
    totals: scaleMacros(m.baseMacros, m.multiplier),
  }));
  
  return {
    dayIndex,
    status,
    meals: planMeals,
    addOns,
    totals,
    deltas,
    flags,
    suggestions,
  };
}
