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
  serving_size: string | null;
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
      serving_size: null, // Seed recipes don't have serving_size
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
        // NOTE: We no longer call the `list-global-recipes` backend function here.
        // It has been unstable (500s due to DB statement timeouts) and was causing the UI
        // to spam failing requests. Instead, load in pages using range() to keep each query small.

        const PAGE_SIZE = 200;
        let offset = 0;
        const all: any[] = [];

        while (true) {
          const { data: page, error: pageError } = await supabase
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
              serving_size,
              difficulty,
              cuisine,
              is_kid_friendly,
              is_meal_prep_friendly,
              is_budget_friendly,
              scope
            `
            )
            .eq('scope', 'global')
            .eq('is_deleted', false)
            .order('title', { ascending: true })
            .range(offset, offset + PAGE_SIZE - 1);

          if (pageError) {
            if (import.meta.env.DEV) console.warn('[useGlobalRecipes] backend error, using seed fallback:', pageError);
            return getSeedFallback();
          }

          const safePage = (page || []) as any[];
          all.push(...safePage);

          if (safePage.length < PAGE_SIZE) break;
          offset += PAGE_SIZE;

          // Safety: Supabase hard limit is 1000 rows anyway.
          if (offset >= 1000) break;
        }

        const safeRecipes = all;
        if (safeRecipes.length === 0) return [];

        const ids = safeRecipes.map((r) => r.id).filter(Boolean);
        if (ids.length === 0) return [];

        const [nutritionRes, tagsRes] = await Promise.all([
          supabase
            .from('recipe_nutrition')
            .select('recipe_id, calories, protein_g, carbs_g, fat_g, fiber_g, sodium_mg')
            .in('recipe_id', ids),
          supabase
            .from('recipe_tags')
            .select('recipe_id, tag_type, tag_value')
            .in('recipe_id', ids),
        ]);

        const nutritionById = new Map<string, GlobalRecipe['nutrition']>();
        (nutritionRes.data || []).forEach((n: any) => {
          if (!n?.recipe_id) return;
          nutritionById.set(n.recipe_id, {
            calories: n.calories ?? null,
            protein_g: n.protein_g ?? null,
            carbs_g: n.carbs_g ?? null,
            fat_g: n.fat_g ?? null,
            fiber_g: n.fiber_g ?? null,
            sodium_mg: n.sodium_mg ?? null,
          });
        });

        const tagsById = new Map<string, GlobalRecipe['tags']>();
        (tagsRes.data || []).forEach((t: any) => {
          if (!t?.recipe_id) return;
          const list = tagsById.get(t.recipe_id) || [];
          list.push({ tag_type: t.tag_type, tag_value: t.tag_value });
          tagsById.set(t.recipe_id, list);
        });

        return safeRecipes.map((r: any) => {
          return {
            id: r.id,
            title: r.title,
            description: r.description,
            image_url: r.image_url,
            prep_time: r.prep_time,
            cook_time: r.cook_time,
            total_time: r.total_time,
            servings: r.servings,
            serving_size: r.serving_size,
            difficulty: r.difficulty,
            cuisine: r.cuisine,
            is_kid_friendly: r.is_kid_friendly,
            is_meal_prep_friendly: r.is_meal_prep_friendly,
            is_budget_friendly: r.is_budget_friendly,
            scope: r.scope,
            nutrition: nutritionById.get(r.id) || undefined,
            ingredients: [], // Loaded on-demand via useRecipeById
            steps: [], // Loaded on-demand via useRecipeById
            tags: tagsById.get(r.id) || [],
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

