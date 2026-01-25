import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useMealPlanStore } from '@/stores/mealPlanStore';
import { supabase } from '@/integrations/supabase/client';

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

interface RecipeIngredient {
  recipe_id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  aisle: string | null;
}

interface RecipeServings {
  id: string;
  servings: number | null;
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
  const { generatedPlan, numberOfDays, recipePoolsBySlot, exactAssignments } = useMealPlanStore();

  type PlannedMeal = { recipeId: string; neededServings: number };

  // Build a list of planned meals (may include duplicates across days/slots)
  const plannedMeals = useMemo<PlannedMeal[]>(() => {
    // 1) Prefer the generated plan when available
    if (generatedPlan?.days?.length) {
      const meals: PlannedMeal[] = [];
      const daysToProcess = generatedPlan.days.slice(0, numberOfDays);
      for (const day of daysToProcess) {
        for (const slot of day.slots) {
          if (!slot.recipeId) continue;
          meals.push({
            recipeId: slot.recipeId,
            neededServings: slot.servingMultiplier || 1,
          });
        }
      }
      return meals;
    }

    // 2) Otherwise, use exact assignments (if present)
    const exactMeals: PlannedMeal[] = [];
    for (const [dayIndexStr, dayAssignments] of Object.entries(exactAssignments ?? {})) {
      // Only process days that are part of the plan duration
      const dayIndex = Number(dayIndexStr);
      if (Number.isNaN(dayIndex) || dayIndex < 0 || dayIndex >= numberOfDays) continue;

      for (const assignment of Object.values(dayAssignments ?? {})) {
        if (!assignment?.recipeId) continue;
        exactMeals.push({
          recipeId: assignment.recipeId,
          neededServings: assignment.servingMultiplier || 1,
        });
      }
    }
    if (exactMeals.length > 0) return exactMeals;

    // 3) Finally, fall back to pools: include the first recipe in each slot pool (preview)
    const poolMeals: PlannedMeal[] = [];
    for (const pool of Object.values(recipePoolsBySlot ?? {})) {
      const recipeId = pool?.[0];
      if (!recipeId) continue;
      poolMeals.push({ recipeId, neededServings: 1 });
    }
    return poolMeals;
  }, [generatedPlan, numberOfDays, exactAssignments, recipePoolsBySlot]);

  // Extract unique recipe IDs
  const recipeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const m of plannedMeals) ids.add(m.recipeId);
    return Array.from(ids);
  }, [plannedMeals]);

  // Fetch ingredients for all recipes in the plan
  const { data: ingredientsData, isLoading: ingredientsLoading } = useQuery({
    queryKey: ['grocery-ingredients', recipeIds],
    queryFn: async () => {
      if (recipeIds.length === 0) return { ingredients: [], servings: [] };

      const [ingredientsRes, servingsRes] = await Promise.all([
        supabase
          .from('recipe_ingredients')
          .select('recipe_id, name, quantity, unit, aisle')
          .in('recipe_id', recipeIds),
        supabase
          .from('recipes')
          .select('id, servings')
          .in('id', recipeIds),
      ]);

      return {
        ingredients: (ingredientsRes.data || []) as RecipeIngredient[],
        servings: (servingsRes.data || []) as RecipeServings[],
      };
    },
    enabled: recipeIds.length > 0,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  const groceryList = useMemo<GroceryAisle[]>(() => {
    if (!ingredientsData || ingredientsData.ingredients.length === 0 || plannedMeals.length === 0) {
      return [];
    }

    // Build maps for quick lookup
    const ingredientsByRecipe = new Map<string, RecipeIngredient[]>();
    for (const ing of ingredientsData.ingredients) {
      const list = ingredientsByRecipe.get(ing.recipe_id) || [];
      list.push(ing);
      ingredientsByRecipe.set(ing.recipe_id, list);
    }

    const servingsMap = new Map<string, number>();
    for (const r of ingredientsData.servings) {
      servingsMap.set(r.id, r.servings || 1);
    }

    // Aggregate ingredients across all days and slots
    const ingredientMap = new Map<string, {
      name: string;
      quantity: number;
      unit: string | null;
      aisle: string;
    }>();

    for (const meal of plannedMeals) {
      const ingredients = ingredientsByRecipe.get(meal.recipeId);
      if (!ingredients || ingredients.length === 0) continue;

      const baseServings = servingsMap.get(meal.recipeId) || 1;
      const neededServings = meal.neededServings || 1;
      const ingredientRatio = neededServings / baseServings;

      for (const ingredient of ingredients) {
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
  }, [ingredientsData, plannedMeals]);

  const totalItems = useMemo(() => 
    groceryList.reduce((acc, aisle) => acc + aisle.items.length, 0),
    [groceryList]
  );

  const hasPlan = plannedMeals.length > 0;

  return {
    groceryList,
    totalItems,
    hasPlan,
    isLoading: ingredientsLoading,
    numberOfDays,
  };
}
