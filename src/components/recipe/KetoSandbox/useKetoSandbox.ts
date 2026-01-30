/**
 * useKetoSandbox - Hook for managing Keto Sandbox preview state
 * Refactored to use context-aware increments instead of percentages
 */

import { useState, useMemo, useCallback } from 'react';
import { 
  findKetoSwaps, 
  calculateNetCarbs, 
  calculateNetEnergy,
  calculateMacroPercents,
  calculateKetoScore,
  CALORIES_PER_GRAM,
} from '@/lib/neutron';
import type {
  IngredientData,
  SwapChange,
  QuantityChange,
  AdditionChange,
  SandboxPreviewState,
  NutritionPreview,
  IncrementType,
} from './types';
import { 
  FAT_ADDITIONS, 
  HIGH_CARB_PATTERNS,
  HIGH_CARB_INGREDIENTS,
  COUNTABLE_UNITS,
  AVOCADO_OPTIONS,
  LIQUID_SMALL_UNITS,
  CUP_UNITS,
  CUP_INCREMENT,
} from './types';

interface UseKetoSandboxProps {
  nutrition: {
    calories?: number | null;
    protein_g?: number | null;
    carbs_g?: number | null;
    fat_g?: number | null;
    fiber_g?: number | null;
    sugar_alcohols_g?: number | null;
  } | null;
  ingredients: IngredientData[];
  servings: number;
}

// Detect increment type based on ingredient name and unit
function detectIncrementType(name: string, unit: string | null): IncrementType {
  const lowerName = name.toLowerCase();
  const lowerUnit = (unit || '').toLowerCase();
  
  // Check for avocado first
  if (lowerName.includes('avocado')) {
    return 'avocado';
  }
  
  // Check for countable units
  if (COUNTABLE_UNITS.some(u => lowerUnit.includes(u))) {
    return 'countable';
  }
  
  // Check for liquid small units (tsp, tbsp)
  if (LIQUID_SMALL_UNITS.some(u => lowerUnit.includes(u))) {
    return 'liquid-small';
  }
  
  // Check for cup units
  if (CUP_UNITS.some(u => lowerUnit.includes(u))) {
    return 'liquid-cup';
  }
  
  // Check for weight units
  if (['g', 'gram', 'grams', 'oz', 'ounce', 'ounces', 'lb', 'pound'].some(u => lowerUnit.includes(u))) {
    return 'weight';
  }
  
  return 'default';
}

// Get carbs per unit for high-carb ingredients
function getCarbsPerUnit(name: string): number {
  const lowerName = name.toLowerCase();
  for (const [pattern, carbs] of Object.entries(HIGH_CARB_INGREDIENTS)) {
    if (lowerName.includes(pattern)) {
      return carbs;
    }
  }
  return 2; // default estimation
}

// Get increment value based on type
function getIncrementValue(incrementType: IncrementType, currentQty: number, direction: 'up' | 'down'): number {
  const delta = direction === 'up' ? 1 : -1;
  
  switch (incrementType) {
    case 'countable':
      return delta * 1; // +/- 1 unit
    case 'avocado': {
      const currentIndex = AVOCADO_OPTIONS.findIndex(opt => Math.abs(opt - currentQty) < 0.01);
      const newIndex = Math.max(0, Math.min(AVOCADO_OPTIONS.length - 1, currentIndex + delta));
      return AVOCADO_OPTIONS[newIndex] - currentQty;
    }
    case 'liquid-cup':
      return delta * CUP_INCREMENT; // +/- 0.25 cup
    case 'liquid-small':
      return delta * 0.5; // +/- 0.5 for small liquids
    case 'weight':
      return delta * 10; // +/- 10g
    default:
      return delta * 0.5; // default increment
  }
}

// Get min quantity based on increment type
function getMinQuantity(incrementType: IncrementType): number {
  switch (incrementType) {
    case 'avocado':
      return 0;
    case 'countable':
      return 1;
    case 'liquid-cup':
      return 0.25;
    case 'liquid-small':
      return 0.5;
    default:
      return 0.1;
  }
}

export function useKetoSandbox({ nutrition, ingredients, servings }: UseKetoSandboxProps) {
  // Initialize sandbox state
  const [previewState, setPreviewState] = useState<SandboxPreviewState>({
    swaps: [],
    quantities: [],
    additions: [],
  });

  // Generate swap suggestions from Neutron Engine
  const swapSuggestions = useMemo(() => {
    const ingredientNames = ingredients.map(ing => ing.name);
    const swaps = findKetoSwaps(ingredientNames);
    
    return swaps.map(swap => {
      const ingredient = ingredients.find(
        ing => ing.name.toLowerCase() === swap.originalIngredient.toLowerCase()
      );
      return {
        type: 'swap' as const,
        ingredientId: ingredient?.id || '',
        originalName: swap.originalIngredient,
        newName: swap.swapTo,
        estimatedCarbReduction: swap.estimatedCarbReduction,
        category: swap.category,
        reason: swap.reason,
        enabled: false,
      };
    });
  }, [ingredients]);

  // Generate quantity tweaks for all ingredients with context-aware increments
  const quantityTweaks = useMemo(() => {
    return ingredients
      .filter(ing => ing.quantity && ing.quantity > 0)
      .map(ing => {
        const isHighCarb = HIGH_CARB_PATTERNS.some(pattern => 
          ing.name.toLowerCase().includes(pattern)
        );
        
        const incrementType = detectIncrementType(ing.name, ing.unit);
        const carbsPerUnit = getCarbsPerUnit(ing.name);
        
        // Find existing quantity change or use original
        const existingChange = previewState.quantities.find(q => q.ingredientId === ing.id);
        const currentQuantity = existingChange?.newQuantity ?? ing.quantity!;
        
        return {
          type: 'quantity' as const,
          ingredientId: ing.id,
          ingredientName: ing.name,
          originalQuantity: ing.quantity!,
          newQuantity: currentQuantity,
          unit: ing.unit,
          isHighCarb,
          incrementType,
          carbsPerUnit,
        };
      });
  }, [ingredients, previewState.quantities]);

  // Available fat additions
  const availableAdditions = useMemo(() => {
    return FAT_ADDITIONS.map(addition => {
      const existingAddition = previewState.additions.find(a => a.id === addition.id);
      return {
        type: 'addition' as const,
        id: addition.id,
        name: addition.name,
        quantity: existingAddition?.quantity ?? addition.defaultQuantity,
        unit: addition.unit,
        estimatedFatAddition: (existingAddition?.quantity ?? addition.defaultQuantity) * addition.fatPerUnit,
        enabled: existingAddition?.enabled ?? false,
      };
    });
  }, [previewState.additions]);

  // Calculate preview nutrition with all enabled changes
  const previewNutrition = useMemo((): NutritionPreview => {
    const baseProtein = nutrition?.protein_g ?? 0;
    const baseFat = nutrition?.fat_g ?? 0;
    const baseCarbs = nutrition?.carbs_g ?? 0;
    const baseFiber = nutrition?.fiber_g ?? 0;
    const baseCalories = nutrition?.calories ?? 0;
    const sugarAlcohols = nutrition?.sugar_alcohols_g ?? 0;

    let deltaCarbs = 0;
    let deltaFat = 0;
    let deltaCalories = 0;

    // Apply enabled swaps
    previewState.swaps.filter(s => s.enabled).forEach(swap => {
      deltaCarbs -= swap.estimatedCarbReduction;
      deltaCalories -= swap.estimatedCarbReduction * CALORIES_PER_GRAM.carbs;
    });

    // Apply quantity changes using exact unit-based calculations
    previewState.quantities.forEach(q => {
      const unitDelta = q.newQuantity - q.originalQuantity;
      if (unitDelta !== 0) {
        // Use carbsPerUnit for accurate calculation
        const carbDelta = (unitDelta * q.carbsPerUnit) / servings;
        deltaCarbs += carbDelta;
        deltaCalories += carbDelta * CALORIES_PER_GRAM.carbs;
      }
    });

    // Apply enabled additions
    previewState.additions.filter(a => a.enabled).forEach(addition => {
      const fatAddition = FAT_ADDITIONS.find(f => f.id === addition.id);
      if (fatAddition) {
        const addedFat = (addition.quantity * fatAddition.fatPerUnit) / servings;
        deltaFat += addedFat;
        deltaCalories += addedFat * CALORIES_PER_GRAM.fat;
      }
    });

    // Calculate new values
    const newCarbs = Math.max(0, baseCarbs + deltaCarbs);
    const newFat = Math.max(0, baseFat + deltaFat);
    const newCalories = Math.max(0, baseCalories + deltaCalories);
    const netCarbs = calculateNetCarbs(newCarbs, baseFiber, sugarAlcohols);
    const netEnergy = calculateNetEnergy(newFat, baseProtein, netCarbs);
    const percents = calculateMacroPercents(newFat, baseProtein, netCarbs, netEnergy);
    const ketoScore = calculateKetoScore(netCarbs, newFat, baseProtein);

    return {
      calories: Math.round(newCalories),
      protein_g: Math.round(baseProtein),
      carbs_g: Math.round(newCarbs),
      fat_g: Math.round(newFat),
      fiber_g: Math.round(baseFiber),
      netCarbs: Math.round(netCarbs * 10) / 10,
      fatPercent: percents.fatPercent,
      proteinPercent: percents.proteinPercent,
      carbPercent: percents.carbPercent,
      ketoScore: ketoScore.score,
      isKeto: ketoScore.isKeto,
    };
  }, [nutrition, previewState, servings]);

  // Original nutrition for comparison
  const originalNutrition = useMemo((): NutritionPreview => {
    const protein = nutrition?.protein_g ?? 0;
    const fat = nutrition?.fat_g ?? 0;
    const carbs = nutrition?.carbs_g ?? 0;
    const fiber = nutrition?.fiber_g ?? 0;
    const calories = nutrition?.calories ?? 0;
    const sugarAlcohols = nutrition?.sugar_alcohols_g ?? 0;
    
    const netCarbs = calculateNetCarbs(carbs, fiber, sugarAlcohols);
    const netEnergy = calculateNetEnergy(fat, protein, netCarbs);
    const percents = calculateMacroPercents(fat, protein, netCarbs, netEnergy);
    const ketoScore = calculateKetoScore(netCarbs, fat, protein);

    return {
      calories: Math.round(calories),
      protein_g: Math.round(protein),
      carbs_g: Math.round(carbs),
      fat_g: Math.round(fat),
      fiber_g: Math.round(fiber),
      netCarbs: Math.round(netCarbs * 10) / 10,
      fatPercent: percents.fatPercent,
      proteinPercent: percents.proteinPercent,
      carbPercent: percents.carbPercent,
      ketoScore: ketoScore.score,
      isKeto: ketoScore.isKeto,
    };
  }, [nutrition]);

  // Toggle swap
  const toggleSwap = useCallback((ingredientId: string) => {
    setPreviewState(prev => {
      const existingIndex = prev.swaps.findIndex(s => s.ingredientId === ingredientId);
      
      if (existingIndex >= 0) {
        // Toggle existing
        const newSwaps = [...prev.swaps];
        newSwaps[existingIndex] = { 
          ...newSwaps[existingIndex], 
          enabled: !newSwaps[existingIndex].enabled 
        };
        return { ...prev, swaps: newSwaps };
      } else {
        // Add new swap from suggestions
        const suggestion = swapSuggestions.find(s => s.ingredientId === ingredientId);
        if (suggestion) {
          return { 
            ...prev, 
            swaps: [...prev.swaps, { ...suggestion, enabled: true }] 
          };
        }
        return prev;
      }
    });
  }, [swapSuggestions]);

  // Update quantity with context-aware increments
  const updateQuantity = useCallback((ingredientId: string, direction: 'up' | 'down') => {
    setPreviewState(prev => {
      const ingredient = ingredients.find(i => i.id === ingredientId);
      if (!ingredient || !ingredient.quantity) return prev;

      const incrementType = detectIncrementType(ingredient.name, ingredient.unit);
      const carbsPerUnit = getCarbsPerUnit(ingredient.name);
      const isHighCarb = HIGH_CARB_PATTERNS.some(pattern => 
        ingredient.name.toLowerCase().includes(pattern)
      );

      const existingIndex = prev.quantities.findIndex(q => q.ingredientId === ingredientId);
      const existingChange = existingIndex >= 0 ? prev.quantities[existingIndex] : null;
      
      const currentQty = existingChange?.newQuantity ?? ingredient.quantity;
      const delta = getIncrementValue(incrementType, currentQty, direction);
      const minQty = getMinQuantity(incrementType);
      const maxQty = ingredient.quantity * 3; // Allow up to 3x original
      
      const newQuantity = Math.max(minQty, Math.min(maxQty, currentQty + delta));
      
      // Round appropriately based on increment type
      const roundedQuantity = incrementType === 'avocado' 
        ? Math.round(newQuantity * 4) / 4 // Round to nearest 0.25
        : incrementType === 'countable'
          ? Math.round(newQuantity)
          : Math.round(newQuantity * 100) / 100;

      const newChange: QuantityChange = {
        type: 'quantity',
        ingredientId,
        ingredientName: ingredient.name,
        originalQuantity: ingredient.quantity,
        newQuantity: roundedQuantity,
        unit: ingredient.unit,
        isHighCarb,
        incrementType,
        carbsPerUnit,
      };

      if (existingIndex >= 0) {
        const newQuantities = [...prev.quantities];
        newQuantities[existingIndex] = newChange;
        return { ...prev, quantities: newQuantities };
      } else {
        return { ...prev, quantities: [...prev.quantities, newChange] };
      }
    });
  }, [ingredients]);

  // Reset quantity to original
  const resetQuantity = useCallback((ingredientId: string) => {
    setPreviewState(prev => ({
      ...prev,
      quantities: prev.quantities.filter(q => q.ingredientId !== ingredientId),
    }));
  }, []);

  // Toggle addition
  const toggleAddition = useCallback((additionId: string) => {
    setPreviewState(prev => {
      const existingIndex = prev.additions.findIndex(a => a.id === additionId);
      
      if (existingIndex >= 0) {
        const newAdditions = [...prev.additions];
        newAdditions[existingIndex] = { 
          ...newAdditions[existingIndex], 
          enabled: !newAdditions[existingIndex].enabled 
        };
        return { ...prev, additions: newAdditions };
      } else {
        const addition = FAT_ADDITIONS.find(a => a.id === additionId);
        if (addition) {
          return {
            ...prev,
            additions: [...prev.additions, {
              type: 'addition' as const,
              id: addition.id,
              name: addition.name,
              quantity: addition.defaultQuantity,
              unit: addition.unit,
              estimatedFatAddition: addition.defaultQuantity * addition.fatPerUnit,
              enabled: true,
            }],
          };
        }
        return prev;
      }
    });
  }, []);

  // Update addition quantity
  const updateAdditionQuantity = useCallback((additionId: string, quantity: number) => {
    setPreviewState(prev => {
      const existingIndex = prev.additions.findIndex(a => a.id === additionId);
      
      if (existingIndex >= 0) {
        const addition = FAT_ADDITIONS.find(a => a.id === additionId);
        const newAdditions = [...prev.additions];
        newAdditions[existingIndex] = {
          ...newAdditions[existingIndex],
          quantity: Math.max(0.5, quantity),
          estimatedFatAddition: Math.max(0.5, quantity) * (addition?.fatPerUnit ?? 0),
        };
        return { ...prev, additions: newAdditions };
      }
      return prev;
    });
  }, []);

  // Check if there are any active changes
  const hasChanges = useMemo(() => {
    return (
      previewState.swaps.some(s => s.enabled) ||
      previewState.quantities.some(q => q.newQuantity !== q.originalQuantity) ||
      previewState.additions.some(a => a.enabled)
    );
  }, [previewState]);

  // Get all active changes for commit
  const getActiveChanges = useCallback(() => {
    return {
      swaps: previewState.swaps.filter(s => s.enabled),
      quantities: previewState.quantities.filter(q => q.newQuantity !== q.originalQuantity),
      additions: previewState.additions.filter(a => a.enabled),
    };
  }, [previewState]);

  // Reset all changes
  const resetAll = useCallback(() => {
    setPreviewState({
      swaps: [],
      quantities: [],
      additions: [],
    });
  }, []);

  return {
    // Data
    swapSuggestions,
    quantityTweaks,
    availableAdditions,
    previewState,
    previewNutrition,
    originalNutrition,
    hasChanges,
    
    // Actions
    toggleSwap,
    updateQuantity,
    resetQuantity,
    toggleAddition,
    updateAdditionQuantity,
    getActiveChanges,
    resetAll,
  };
}
