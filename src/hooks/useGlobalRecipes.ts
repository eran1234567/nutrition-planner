import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { seedRecipes } from '@/data/seedRecipes';

export interface GlobalRecipe {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  prep_time: number | null;
  cook_time: number | null;
  total_time: number | null;
  servings: number | null;
  difficulty: string | null;
  cuisine: string | null;
  is_kid_friendly: boolean | null;
  is_meal_prep_friendly: boolean | null;
  is_budget_friendly: boolean | null;
  scope: string | null;
  nutrition?: {
    calories: number | null;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
    fiber_g: number | null;
    sodium_mg: number | null;
  };
  ingredients: Array<{
    name: string;
    quantity: number | null;
    unit: string | null;
    normalized_name: string | null;
    aisle: string | null;
    order_index: number | null;
  }>;
  steps: Array<{
    step_number: number;
    instruction: string;
  }>;
  tags: Array<{
    tag_type: string;
    tag_value: string;
  }>;
  isUserRecipe: boolean;
}

function getSeedFallback(): GlobalRecipe[] {
  return seedRecipes
    .filter((r) => r.scope === 'global' && !r.is_deleted)
    .map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description ?? null,
      image_url: r.image_url ?? null,
      prep_time: r.prep_time ?? null,
      cook_time: r.cook_time ?? null,
      total_time: r.total_time ?? null,
      servings: r.servings ?? null,
      difficulty: r.difficulty ?? null,
      cuisine: r.cuisine ?? null,
      is_kid_friendly: r.is_kid_friendly ?? null,
      is_meal_prep_friendly: r.is_meal_prep_friendly ?? null,
      is_budget_friendly: r.is_budget_friendly ?? null,
      scope: r.scope,
      nutrition: r.nutrition
        ? {
            calories: r.nutrition.calories ?? null,
            protein_g: r.nutrition.protein_g ?? null,
            carbs_g: r.nutrition.carbs_g ?? null,
            fat_g: r.nutrition.fat_g ?? null,
            fiber_g: r.nutrition.fiber_g ?? null,
            sodium_mg: r.nutrition.sodium_mg ?? null,
          }
        : undefined,
      ingredients: (r.ingredients ?? []).map((i) => ({
        name: i.name,
        quantity: i.quantity ?? null,
        unit: i.unit ?? null,
        normalized_name: i.normalized_name ?? null,
        aisle: i.aisle ?? null,
        order_index: i.order_index ?? null,
      })),
      steps: (r.steps ?? []).map((s) => ({
        step_number: s.step_number,
        instruction: s.instruction,
      })),
      tags: (r.tags ?? []).map((t) => ({
        tag_type: t.tag_type,
        tag_value: t.tag_value,
      })),
      isUserRecipe: false,
    }));
}

export function useGlobalRecipes() {
  return useQuery({
    queryKey: ['global-recipes'],
    queryFn: async (): Promise<GlobalRecipe[]> => {
      try {
        const { data, error } = await supabase
          .from('recipes')
          .select(
            `
            id,
            title,
            description,
            image_url,
            prep_time,
            cook_time,
            total_time,
            servings,
            difficulty,
            cuisine,
            is_kid_friendly,
            is_meal_prep_friendly,
            is_budget_friendly,
            scope,
            recipe_nutrition(calories, protein_g, carbs_g, fat_g, fiber_g, sodium_mg),
            recipe_ingredients(name, quantity, unit, normalized_name, aisle, order_index),
            recipe_steps(step_number, instruction),
            recipe_tags(tag_type, tag_value)
          `
          )
          .eq('scope', 'global')
          .or('is_deleted.is.null,is_deleted.eq.false')
          .order('title');

        if (error) {
          if (import.meta.env.DEV) console.warn('[useGlobalRecipes] backend error, using seed fallback:', error);
          return getSeedFallback();
        }

        return (data || []).map((r: any) => {
          // recipe_nutrition is a one-to-one relation, so it's an object (or null), not an array
          const nutritionData = r.recipe_nutrition;

          return {
            id: r.id,
            title: r.title,
            description: r.description,
            image_url: r.image_url,
            prep_time: r.prep_time,
            cook_time: r.cook_time,
            total_time: r.total_time,
            servings: r.servings,
            difficulty: r.difficulty,
            cuisine: r.cuisine,
            is_kid_friendly: r.is_kid_friendly,
            is_meal_prep_friendly: r.is_meal_prep_friendly,
            is_budget_friendly: r.is_budget_friendly,
            scope: r.scope,
            nutrition: nutritionData || undefined,
            ingredients: r.recipe_ingredients || [],
            steps: r.recipe_steps || [],
            tags: r.recipe_tags || [],
            isUserRecipe: false,
          } as GlobalRecipe;
        });
      } catch (err) {
        if (import.meta.env.DEV) console.warn('[useGlobalRecipes] request failed, using seed fallback:', err);
        return getSeedFallback();
      }
    },
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });
}

export function useRecipeById(id: string | undefined) {
  return useQuery({
    queryKey: ['recipe', id],
    queryFn: async () => {
      if (!id) return null;

      const { data: recipeData, error: recipeError } = await supabase
        .from('recipes')
        .select('*')
        .eq('id', id)
        .single();

      if (recipeError || !recipeData) return null;

      // Fetch related data
      const [ingredientsRes, stepsRes, nutritionRes, tagsRes] = await Promise.all([
        supabase.from('recipe_ingredients').select('*').eq('recipe_id', id).order('order_index'),
        supabase.from('recipe_steps').select('*').eq('recipe_id', id).order('step_number'),
        supabase.from('recipe_nutrition').select('*').eq('recipe_id', id).single(),
        supabase.from('recipe_tags').select('*').eq('recipe_id', id),
      ]);

      return {
        ...recipeData,
        ingredients: ingredientsRes.data || [],
        steps: stepsRes.data || [],
        nutrition: nutritionRes.data,
        tags: tagsRes.data || [],
      };
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}

