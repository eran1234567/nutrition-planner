import { useInfiniteQuery } from '@tanstack/react-query';
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

interface PageData {
  recipes: GlobalRecipe[];
  nextCursor: string | null;
  hasNextPage: boolean;
}

const PAGE_SIZE = 100;

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
      serving_size: null,
      difficulty: r.difficulty ?? null,
      cuisine: r.cuisine ?? null,
      is_kid_friendly: r.is_kid_friendly ?? null,
      is_meal_prep_friendly: r.is_meal_prep_friendly ?? null,
      is_budget_friendly: r.is_budget_friendly ?? null,
      scope: r.scope,
      nutrition: r.nutrition ? {
        calories: r.nutrition.calories ?? null,
        protein_g: r.nutrition.protein_g ?? null,
        carbs_g: r.nutrition.carbs_g ?? null,
        fat_g: r.nutrition.fat_g ?? null,
        fiber_g: r.nutrition.fiber_g ?? null,
        sodium_mg: r.nutrition.sodium_mg ?? null,
      } : undefined,
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
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

async function fetchPage(cursor: string | null): Promise<PageData> {
  try {
    const { data, error } = await supabase.functions.invoke('list-global-recipes', {
      body: { limit: PAGE_SIZE, cursor },
    });

    if (!error && data?.recipes?.length > 0) {
      const recipes: GlobalRecipe[] = (data.recipes || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        description: r.description ?? null,
        image_url: r.image_url ?? null,
        prep_time: r.prep_time ?? null,
        cook_time: r.cook_time ?? null,
        total_time: r.total_time ?? null,
        servings: r.servings ?? null,
        serving_size: r.serving_size ?? null,
        difficulty: r.difficulty ?? null,
        cuisine: r.cuisine ?? null,
        is_kid_friendly: r.is_kid_friendly ?? null,
        is_meal_prep_friendly: r.is_meal_prep_friendly ?? null,
        is_budget_friendly: r.is_budget_friendly ?? null,
        scope: r.scope ?? 'global',
        nutrition: r.nutrition ?? undefined,
        ingredients: [],
        steps: [],
        tags: r.tags ?? [],
        isUserRecipe: false,
      }));

      return {
        recipes,
        nextCursor: data.nextCursor ?? null,
        hasNextPage: data.hasNextPage ?? false,
      };
    }
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[useGlobalRecipesInfinite] Edge function failed, using seed fallback');
  }

  // Fallback to seed data (no pagination needed - all in one page)
  if (!cursor) {
    return { recipes: getSeedFallback(), nextCursor: null, hasNextPage: false };
  }
  return { recipes: [], nextCursor: null, hasNextPage: false };
}

export function useGlobalRecipesInfinite() {
  return useInfiniteQuery<PageData, Error>({
    queryKey: ['global-recipes-infinite'],
    queryFn: ({ pageParam }) => fetchPage(pageParam as string | null),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => (lastPage.hasNextPage ? lastPage.nextCursor : undefined),
    staleTime: 1000 * 60 * 10,
    retry: 1,
    retryDelay: 1000,
  });
}
