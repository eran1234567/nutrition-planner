import type { IngredientItem } from '@/components/recipe/IngredientInput';

export interface NutritionTotals {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  netCarbs: number;
  fiber: number;
  sugar: number;
  saturatedFat: number;
  cholesterol: number;
  sodium: number;
}

/**
 * Calculate nutrition totals from ingredients
 * Maps to ingredient_nutrition table columns:
 * - carbs -> carbs_g
 * - fiber -> fiber_g
 * - protein -> protein_g
 * - fat -> fat_g
 * - sodium -> sodium_mg
 * - saturatedFat -> saturated_fat_g
 * - cholesterol -> cholesterol_mg
 * - sugar -> sugar_g
 * 
 * Net Carbs = carbs - fiber (minimum 0) for keto calculations
 */
export function calculateIngredientTotals(ingredients: IngredientItem[]): NutritionTotals {
  return ingredients.reduce<NutritionTotals>(
    (acc, ing) => {
      if (!ing.nutrition) return acc;

      const qty = parseFloat(ing.quantity) || 1;
      const n = ing.nutrition;

      const carbs = (n.carbs || 0) * qty;
      const fiber = (n.fiber || 0) * qty;
      // Net Carbs = Total Carbs - Fiber (minimum 0)
      const netCarbs = Math.max(0, carbs - fiber);

      return {
        calories: acc.calories + (n.calories || 0) * qty,
        protein: acc.protein + (n.protein || 0) * qty,
        fat: acc.fat + (n.fat || 0) * qty,
        carbs: acc.carbs + carbs,
        netCarbs: acc.netCarbs + netCarbs,
        fiber: acc.fiber + fiber,
        sugar: acc.sugar + (n.sugar || 0) * qty,
        saturatedFat: acc.saturatedFat + (n.saturatedFat || 0) * qty,
        cholesterol: acc.cholesterol + (n.cholesterol || 0) * qty,
        sodium: acc.sodium + (n.sodium || 0) * qty,
      };
    },
    {
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      netCarbs: 0,
      fiber: 0,
      sugar: 0,
      saturatedFat: 0,
      cholesterol: 0,
      sodium: 0,
    }
  );
}

/**
 * Calculate Net Carbs: carbs_g - fiber_g (minimum 0)
 * This is the key metric for keto compliance
 */
export function calculateNetCarbs(carbs: number, fiber: number): number {
  return Math.max(0, (carbs || 0) - (fiber || 0));
}
