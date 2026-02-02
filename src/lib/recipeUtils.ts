import type { IngredientItem } from '@/components/recipe/IngredientInput';

export interface NutritionTotals {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
  sugar: number;
  saturatedFat: number;
  cholesterol: number;
  sodium: number;
}

export function calculateIngredientTotals(ingredients: IngredientItem[]): NutritionTotals {
  return ingredients.reduce<NutritionTotals>(
    (acc, ing) => {
      if (!ing.nutrition) return acc;

      const qty = parseFloat(ing.quantity) || 1;
      const n = ing.nutrition;

      return {
        calories: acc.calories + (n.calories || 0) * qty,
        protein: acc.protein + (n.protein || 0) * qty,
        fat: acc.fat + (n.fat || 0) * qty,
        carbs: acc.carbs + (n.carbs || 0) * qty,
        fiber: acc.fiber + (n.fiber || 0) * qty,
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
      fiber: 0,
      sugar: 0,
      saturatedFat: 0,
      cholesterol: 0,
      sodium: 0,
    }
  );
}
