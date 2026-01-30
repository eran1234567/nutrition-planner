/**
 * Keto Sandbox Types - Manages optimization preview state
 */

export interface IngredientData {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  normalized_name?: string | null;
  order_index?: number | null;
}

export interface SwapChange {
  type: 'swap';
  ingredientId: string;
  originalName: string;
  newName: string;
  estimatedCarbReduction: number;
  category: string;
  reason: string;
  enabled: boolean;
}

export type IncrementType = 'countable' | 'avocado' | 'liquid-small' | 'liquid-cup' | 'weight' | 'default';

export interface QuantityChange {
  type: 'quantity';
  ingredientId: string;
  ingredientName: string;
  originalQuantity: number;
  newQuantity: number;
  unit: string | null;
  isHighCarb: boolean;
  incrementType: IncrementType;
  carbsPerUnit: number; // estimated carbs per unit for high-carb display
}

// Increment configurations
export const COUNTABLE_UNITS = ['slice', 'slices', 'piece', 'pieces', 'egg', 'eggs', 'strip', 'strips'];
export const AVOCADO_OPTIONS = [0, 0.25, 0.5, 0.75, 1.0];
export const LIQUID_SMALL_UNITS = ['tsp', 'tbsp', 'teaspoon', 'tablespoon'];
export const LIQUID_SMALL_OPTIONS = [
  { value: 1, unit: 'tsp', label: '1 tsp' },
  { value: 1, unit: 'tbsp', label: '1 tbsp' },
  { value: 1, unit: 'fl oz', label: '1 fl oz' },
];
export const CUP_UNITS = ['cup', 'cups'];
export const CUP_INCREMENT = 0.25;

export interface AdditionChange {
  type: 'addition';
  id: string;
  name: string;
  quantity: number;
  unit: string;
  estimatedFatAddition: number;
  enabled: boolean;
}

export type SandboxChange = SwapChange | QuantityChange | AdditionChange;

export interface SandboxPreviewState {
  swaps: SwapChange[];
  quantities: QuantityChange[];
  additions: AdditionChange[];
}

export interface NutritionPreview {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  netCarbs: number;
  fatPercent: number;
  proteinPercent: number;
  carbPercent: number;
  ketoScore: number;
  isKeto: boolean;
}

export interface KetoSandboxProps {
  recipeId: string;
  nutrition: {
    calories?: number | null;
    protein_g?: number | null;
    carbs_g?: number | null;
    fat_g?: number | null;
    fiber_g?: number | null;
    sugar_alcohols_g?: number | null;
  } | null;
  ingredients: IngredientData[];
  steps: Array<{ id: string; instruction: string; step_number: number }>;
  servings: number;
  onCommit: () => void;
}

// Fat-adding ingredients with known macros
export interface FatAddition {
  id: string;
  name: string;
  unit: string;
  fatPerUnit: number;
  defaultQuantity: number;
}

export const FAT_ADDITIONS: FatAddition[] = [
  { id: 'olive-oil', name: 'Olive Oil', unit: 'tbsp', fatPerUnit: 13.5, defaultQuantity: 1 },
  { id: 'butter', name: 'Butter', unit: 'tbsp', fatPerUnit: 11.5, defaultQuantity: 1 },
  { id: 'avocado', name: 'Avocado', unit: 'half', fatPerUnit: 15, defaultQuantity: 1 },
  { id: 'coconut-oil', name: 'Coconut Oil', unit: 'tbsp', fatPerUnit: 14, defaultQuantity: 1 },
  { id: 'heavy-cream', name: 'Heavy Cream', unit: 'tbsp', fatPerUnit: 5.5, defaultQuantity: 2 },
];

// High-carb ingredient patterns with estimated carbs per unit
export const HIGH_CARB_INGREDIENTS: Record<string, number> = {
  'bread': 12, // g carbs per slice
  'keto bread': 1.5, // g net carbs per slice
  'rice': 15, // g per 1/4 cup
  'pasta': 20, // g per serving
  'noodle': 18,
  'potato': 15,
  'onion': 3, // g per 1/4 cup
  'garlic': 1, // g per clove
  'carrot': 6,
  'corn': 15,
  'bean': 10,
  'lentil': 12,
  'chickpea': 15,
  'flour': 23, // g per 1/4 cup
  'sugar': 12, // g per tbsp
  'honey': 17,
  'maple': 13,
  'tortilla': 15,
  'wrap': 20,
  'crouton': 5,
  'milk': 12, // g per cup
  'oat': 27, // g per 1/2 cup
};

export const HIGH_CARB_PATTERNS = Object.keys(HIGH_CARB_INGREDIENTS);
