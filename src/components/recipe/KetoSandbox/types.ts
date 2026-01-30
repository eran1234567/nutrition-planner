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

export interface QuantityChange {
  type: 'quantity';
  ingredientId: string;
  ingredientName: string;
  originalQuantity: number;
  newQuantity: number;
  unit: string | null;
  percentChange: number; // e.g., -20 for 20% reduction
  isHighCarb: boolean;
}

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

// High-carb ingredient patterns for auto-suggest reduce
export const HIGH_CARB_PATTERNS = [
  'bread', 'rice', 'pasta', 'noodle', 'potato', 'onion', 'garlic',
  'carrot', 'corn', 'bean', 'lentil', 'chickpea', 'flour', 'sugar',
  'honey', 'maple', 'tortilla', 'wrap', 'crouton', 'milk', 'oat',
];
