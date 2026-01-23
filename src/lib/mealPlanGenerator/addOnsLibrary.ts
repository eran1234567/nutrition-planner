// ============================================================================
// Add-Ons Library
// A curated set of simple food items that can be added to fine-tune macros
// without requiring per-ingredient recipe data.
// ============================================================================

import type { AddOn, RecipeMacros } from './types';

export const ADD_ONS_LIBRARY: AddOn[] = [
  // ===== FAT SOURCES =====
  {
    id: 'olive-oil',
    name: 'Olive Oil',
    emoji: '🫒',
    unit: 'tbsp',
    stepSize: 0.5,
    maxPerDay: 4,
    macrosPerUnit: {
      calories: 119,
      protein: 0,
      carbs: 0,
      fat: 13.5,
    },
    primaryMacro: 'fat',
    description: 'Extra virgin olive oil for healthy fats',
  },
  {
    id: 'butter',
    name: 'Butter',
    emoji: '🧈',
    unit: 'tbsp',
    stepSize: 0.5,
    maxPerDay: 4,
    macrosPerUnit: {
      calories: 102,
      protein: 0.1,
      carbs: 0,
      fat: 11.5,
    },
    primaryMacro: 'fat',
    description: 'Adds richness and fat to meals',
  },
  {
    id: 'avocado',
    name: 'Avocado',
    emoji: '🥑',
    unit: 'g',
    stepSize: 25,
    maxPerDay: 200,
    macrosPerUnit: {
      calories: 1.6,
      protein: 0.02,
      carbs: 0.085,
      fat: 0.147,
    },
    primaryMacro: 'fat',
    description: 'Healthy fats with fiber and nutrients',
  },
  {
    id: 'almonds',
    name: 'Almonds',
    emoji: '🥜',
    unit: 'g',
    stepSize: 15,
    maxPerDay: 60,
    macrosPerUnit: {
      calories: 5.77,
      protein: 0.2,
      carbs: 0.2,
      fat: 0.5,
    },
    primaryMacro: 'fat',
    description: 'Nuts for healthy fats and protein',
  },
  {
    id: 'coconut-oil',
    name: 'Coconut Oil',
    emoji: '🥥',
    unit: 'tbsp',
    stepSize: 0.5,
    maxPerDay: 3,
    macrosPerUnit: {
      calories: 121,
      protein: 0,
      carbs: 0,
      fat: 13.5,
    },
    primaryMacro: 'fat',
    description: 'MCT-rich oil for keto diets',
  },

  // ===== PROTEIN SOURCES =====
  {
    id: 'whey-isolate',
    name: 'Whey Protein',
    emoji: '🥛',
    unit: 'scoop',
    stepSize: 0.5,
    maxPerDay: 2,
    macrosPerUnit: {
      calories: 110,
      protein: 25,
      carbs: 1,
      fat: 0.5,
    },
    primaryMacro: 'protein',
    description: 'Fast-absorbing protein powder',
  },
  {
    id: 'egg-whites',
    name: 'Egg Whites',
    emoji: '🥚',
    unit: 'g',
    stepSize: 25,
    maxPerDay: 200,
    macrosPerUnit: {
      calories: 0.52,
      protein: 0.11,
      carbs: 0.007,
      fat: 0.002,
    },
    primaryMacro: 'protein',
    description: 'Pure protein with minimal calories',
  },
  {
    id: 'greek-yogurt',
    name: 'Greek Yogurt',
    emoji: '🥣',
    unit: 'g',
    stepSize: 50,
    maxPerDay: 300,
    macrosPerUnit: {
      calories: 0.59,
      protein: 0.10,
      carbs: 0.036,
      fat: 0.005,
    },
    primaryMacro: 'protein',
    description: 'High-protein dairy with probiotics',
  },
  {
    id: 'cottage-cheese',
    name: 'Cottage Cheese',
    emoji: '🧀',
    unit: 'g',
    stepSize: 50,
    maxPerDay: 250,
    macrosPerUnit: {
      calories: 0.98,
      protein: 0.112,
      carbs: 0.034,
      fat: 0.042,
    },
    primaryMacro: 'protein',
    description: 'Casein-rich protein for sustained release',
  },
  {
    id: 'collagen-peptides',
    name: 'Collagen Peptides',
    emoji: '✨',
    unit: 'scoop',
    stepSize: 0.5,
    maxPerDay: 2,
    macrosPerUnit: {
      calories: 70,
      protein: 18,
      carbs: 0,
      fat: 0,
    },
    primaryMacro: 'protein',
    description: 'Protein for joints and skin health',
  },

  // ===== CARB SOURCES =====
  {
    id: 'cooked-rice',
    name: 'Cooked Rice',
    emoji: '🍚',
    unit: 'g',
    stepSize: 25,
    maxPerDay: 300,
    macrosPerUnit: {
      calories: 1.30,
      protein: 0.027,
      carbs: 0.28,
      fat: 0.003,
    },
    primaryMacro: 'carbs',
    description: 'Simple carb source for energy',
  },
  {
    id: 'honey',
    name: 'Honey',
    emoji: '🍯',
    unit: 'tbsp',
    stepSize: 0.5,
    maxPerDay: 3,
    macrosPerUnit: {
      calories: 64,
      protein: 0.1,
      carbs: 17,
      fat: 0,
    },
    primaryMacro: 'carbs',
    description: 'Natural sweetener with quick energy',
  },
  {
    id: 'banana',
    name: 'Banana',
    emoji: '🍌',
    unit: 'g',
    stepSize: 25,
    maxPerDay: 200,
    macrosPerUnit: {
      calories: 0.89,
      protein: 0.011,
      carbs: 0.228,
      fat: 0.003,
    },
    primaryMacro: 'carbs',
    description: 'Natural carbs with potassium',
  },
  {
    id: 'oats',
    name: 'Rolled Oats',
    emoji: '🥣',
    unit: 'g',
    stepSize: 20,
    maxPerDay: 100,
    macrosPerUnit: {
      calories: 3.89,
      protein: 0.169,
      carbs: 0.66,
      fat: 0.069,
    },
    primaryMacro: 'carbs',
    description: 'Complex carbs with fiber',
  },
  {
    id: 'sweet-potato',
    name: 'Sweet Potato',
    emoji: '🍠',
    unit: 'g',
    stepSize: 50,
    maxPerDay: 300,
    macrosPerUnit: {
      calories: 0.86,
      protein: 0.016,
      carbs: 0.201,
      fat: 0.001,
    },
    primaryMacro: 'carbs',
    description: 'Nutrient-dense carb source',
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

export function getAddOnById(id: string): AddOn | undefined {
  return ADD_ONS_LIBRARY.find(a => a.id === id);
}

export function getAddOnsByPrimaryMacro(macro: 'protein' | 'carbs' | 'fat'): AddOn[] {
  return ADD_ONS_LIBRARY.filter(a => a.primaryMacro === macro);
}

export function calculateAddOnMacros(addOn: AddOn, quantity: number): RecipeMacros {
  return {
    calories: Math.round(addOn.macrosPerUnit.calories * quantity),
    protein: Math.round(addOn.macrosPerUnit.protein * quantity * 10) / 10,
    carbs: Math.round(addOn.macrosPerUnit.carbs * quantity * 10) / 10,
    fat: Math.round(addOn.macrosPerUnit.fat * quantity * 10) / 10,
  };
}

/**
 * Returns add-ons that would help fill a specific macro gap
 */
export function getSuggestedAddOnsForGap(
  gapType: 'protein' | 'carbs' | 'fat' | 'calories',
  gapAmount: number,
  isKeto: boolean = false
): AddOn[] {
  if (gapType === 'calories') {
    // For calories, prefer fat sources (most calorie-dense)
    return isKeto 
      ? ADD_ONS_LIBRARY.filter(a => a.primaryMacro === 'fat')
      : ADD_ONS_LIBRARY.filter(a => a.primaryMacro === 'fat' || a.primaryMacro === 'carbs');
  }
  
  if (gapType === 'carbs' && isKeto) {
    // Don't suggest carbs for keto
    return [];
  }
  
  return getAddOnsByPrimaryMacro(gapType);
}
