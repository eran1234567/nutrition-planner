/**
 * useKetoSandbox - Hook for managing Keto Sandbox preview state
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
  FatAddition,
} from './types';
import { FAT_ADDITIONS, HIGH_CARB_PATTERNS } from './types';

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

  // Generate quantity tweaks for all ingredients
  const quantityTweaks = useMemo(() => {
    return ingredients
      .filter(ing => ing.quantity && ing.quantity > 0)
      .map(ing => {
        const isHighCarb = HIGH_CARB_PATTERNS.some(pattern => 
          ing.name.toLowerCase().includes(pattern)
        );
        
        // Find existing quantity change or use original
        const existingChange = previewState.quantities.find(q => q.ingredientId === ing.id);
        const currentQuantity = existingChange?.newQuantity ?? ing.quantity!;
        const percentChange = existingChange?.percentChange ?? 0;
        
        return {
          type: 'quantity' as const,
          ingredientId: ing.id,
          ingredientName: ing.name,
          originalQuantity: ing.quantity!,
          newQuantity: currentQuantity,
          unit: ing.unit,
          percentChange,
          isHighCarb,
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

    // Apply quantity changes
    previewState.quantities.forEach(q => {
      if (q.percentChange !== 0) {
        // Rough estimation: assume ingredient contributes proportionally to total carbs
        // For high-carb items, assume ~10g carbs per unit
        // For other items, assume ~2g carbs per unit
        const carbsPerUnit = q.isHighCarb ? 10 : 2;
        const unitDelta = q.newQuantity - q.originalQuantity;
        const carbDelta = (unitDelta * carbsPerUnit) / servings;
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

  // Update quantity (in 10% increments)
  const updateQuantity = useCallback((ingredientId: string, delta: number) => {
    setPreviewState(prev => {
      const ingredient = ingredients.find(i => i.id === ingredientId);
      if (!ingredient || !ingredient.quantity) return prev;

      const existingIndex = prev.quantities.findIndex(q => q.ingredientId === ingredientId);
      const existingChange = existingIndex >= 0 ? prev.quantities[existingIndex] : null;
      
      const currentPercent = existingChange?.percentChange ?? 0;
      const newPercent = Math.max(-90, Math.min(100, currentPercent + delta));
      const newQuantity = Math.max(0.1, ingredient.quantity * (1 + newPercent / 100));

      const isHighCarb = HIGH_CARB_PATTERNS.some(pattern => 
        ingredient.name.toLowerCase().includes(pattern)
      );

      const newChange: QuantityChange = {
        type: 'quantity',
        ingredientId,
        ingredientName: ingredient.name,
        originalQuantity: ingredient.quantity,
        newQuantity: Math.round(newQuantity * 10) / 10,
        unit: ingredient.unit,
        percentChange: newPercent,
        isHighCarb,
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
      previewState.quantities.some(q => q.percentChange !== 0) ||
      previewState.additions.some(a => a.enabled)
    );
  }, [previewState]);

  // Get all active changes for commit
  const getActiveChanges = useCallback(() => {
    return {
      swaps: previewState.swaps.filter(s => s.enabled),
      quantities: previewState.quantities.filter(q => q.percentChange !== 0),
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
