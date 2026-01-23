import { useMemo } from 'react';
import { useMealPlanStore } from '@/stores/mealPlanStore';
import { useGlobalRecipes } from '@/hooks/useGlobalRecipes';

export interface GroceryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string | null;
  aisle: string;
  checked: boolean;
}

export interface GroceryAisle {
  aisle: string;
  items: GroceryItem[];
}

// Normalize ingredient names for aggregation (lowercase, trim, remove plurals)
function normalizeIngredientName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    // Remove common trailing 's' for plurals (simple heuristic)
    .replace(/ies$/, 'y')
    .replace(/es$/, '')
    .replace(/s$/, '');
}

// Default aisle for ingredients without one
const DEFAULT_AISLE = 'Other';

// Aisle sort order for better shopping flow
const AISLE_ORDER: Record<string, number> = {
  'Produce': 1,
  'Meat': 2,
  'Meat & Seafood': 2,
  'Seafood': 3,
  'Dairy': 4,
  'Bakery': 5,
  'Canned': 6,
  'Canned Goods': 6,
  'Pantry': 7,
  'Spices': 8,
  'Frozen': 9,
  'Beverages': 10,
  'Other': 99,
};

export function useGroceryList() {
  const { generatedPlan, numberOfDays } = useMealPlanStore();
  const { data: recipes, isLoading: recipesLoading } = useGlobalRecipes();

  const groceryList = useMemo<GroceryAisle[]>(() => {
    if (!generatedPlan || !recipes || recipes.length === 0) {
      return [];
    }

    // Build a map of recipeId -> recipe for quick lookup
    const recipeMap = new Map(recipes.map(r => [r.id, r]));

    // Aggregate ingredients across all days and slots
    // Key: normalized name + unit combo, Value: aggregated data
    const ingredientMap = new Map<string, {
      name: string;
      quantity: number;
      unit: string | null;
      aisle: string;
    }>();

    // Only process days that are part of the plan
    const daysToProcess = generatedPlan.days.slice(0, numberOfDays);

    for (const day of daysToProcess) {
      for (const slot of day.slots) {
        const recipe = recipeMap.get(slot.recipeId);
        if (!recipe) continue;

        // servingMultiplier is the absolute number of servings needed for this slot
        // We need to calculate the ratio vs the recipe's base servings
        const baseServings = recipe.servings || 1;
        const neededServings = slot.servingMultiplier || 1;
        const ingredientRatio = neededServings / baseServings;

        for (const ingredient of recipe.ingredients) {
          const normalizedName = normalizeIngredientName(ingredient.name);
          const unit = ingredient.unit?.toLowerCase().trim() || null;
          
          // Create a unique key for aggregation (name + unit)
          const key = `${normalizedName}|${unit || ''}`;

          const existing = ingredientMap.get(key);
          const scaledQuantity = (ingredient.quantity || 0) * ingredientRatio;

          if (existing) {
            existing.quantity += scaledQuantity;
          } else {
            ingredientMap.set(key, {
              name: ingredient.name,
              quantity: scaledQuantity,
              unit: ingredient.unit || null,
              aisle: ingredient.aisle || DEFAULT_AISLE,
            });
          }
        }
      }
    }

    // Group by aisle
    const aisleMap = new Map<string, GroceryItem[]>();

    let idCounter = 0;
    for (const [key, data] of ingredientMap) {
      const aisle = data.aisle || DEFAULT_AISLE;
      
      if (!aisleMap.has(aisle)) {
        aisleMap.set(aisle, []);
      }

      aisleMap.get(aisle)!.push({
        id: `grocery-${idCounter++}`,
        name: data.name,
        quantity: Math.round(data.quantity * 100) / 100, // Round to 2 decimals
        unit: data.unit,
        aisle,
        checked: false,
      });
    }

    // Sort aisles by predefined order, then alphabetically
    const sortedAisles = Array.from(aisleMap.entries())
      .sort(([a], [b]) => {
        const orderA = AISLE_ORDER[a] ?? 50;
        const orderB = AISLE_ORDER[b] ?? 50;
        if (orderA !== orderB) return orderA - orderB;
        return a.localeCompare(b);
      })
      .map(([aisle, items]) => ({
        aisle,
        // Sort items within aisle alphabetically
        items: items.sort((a, b) => a.name.localeCompare(b.name)),
      }));

    return sortedAisles;
  }, [generatedPlan, recipes, numberOfDays]);

  const totalItems = useMemo(() => 
    groceryList.reduce((acc, aisle) => acc + aisle.items.length, 0),
    [groceryList]
  );

  const hasPlan = !!generatedPlan && generatedPlan.days.length > 0;

  return {
    groceryList,
    totalItems,
    hasPlan,
    isLoading: recipesLoading,
    numberOfDays,
  };
}
