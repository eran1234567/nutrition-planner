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
  nextOffset: number | null;
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

async function fetchPage(offset: number): Promise<PageData> {
  try {
    // Fetch list essentials first (fast), then fetch tags + nutrition in separate queries.
    // We page in chunks to avoid statement timeouts.
    const { data: recipes, error: recipesError } = await supabase
      .from('recipes')
      .select(
        [
          'id',
          'title',
          'description',
          'image_url',
          'prep_time',
          'cook_time',
          'total_time',
          'servings',
          'serving_size',
          'difficulty',
          'cuisine',
          'is_kid_friendly',
          'is_meal_prep_friendly',
          'is_budget_friendly',
          'scope',
        ].join(',')
      )
      .eq('scope', 'global')
      .eq('is_deleted', false)
      .order('title', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (recipesError) {
      if (import.meta.env.DEV) {
        console.warn('[useGlobalRecipesInfinite] global recipes query failed; using seed fallback', recipesError);
      }
      // Fallback to seed data (no pagination needed)
      if (offset === 0) {
        return { recipes: getSeedFallback(), nextOffset: null, hasNextPage: false };
      }
      return { recipes: [], nextOffset: null, hasNextPage: false };
    }

    const safeRecipes = (recipes ?? []) as any[];
    const ids = safeRecipes.map((r) => r.id).filter(Boolean);

    const [nutritionRes, tagsRes, ingredientsRes] = ids.length
      ? await Promise.all([
          supabase
            .from('recipe_nutrition')
            .select('recipe_id, calories, protein_g, carbs_g, fat_g, fiber_g, sodium_mg')
            .in('recipe_id', ids),
          supabase
            .from('recipe_tags')
            .select('recipe_id, tag_type, tag_value')
            .in('recipe_id', ids),
          supabase
            .from('recipe_ingredients')
            .select('recipe_id, name, normalized_name')
            .in('recipe_id', ids),
        ])
      : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }];

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

    // Map ingredients by recipe_id
    const ingredientsById = new Map<string, GlobalRecipe['ingredients']>();
    (ingredientsRes.data || []).forEach((ing: any) => {
      if (!ing?.recipe_id) return;
      const list = ingredientsById.get(ing.recipe_id) || [];
      list.push({
        name: ing.name || '',
        quantity: null,
        unit: null,
        normalized_name: ing.normalized_name || null,
        aisle: null,
        order_index: null,
      });
      ingredientsById.set(ing.recipe_id, list);
    });

    const mapped: GlobalRecipe[] = safeRecipes.map((r: any) => ({
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
      nutrition: nutritionById.get(r.id) || undefined,
      ingredients: ingredientsById.get(r.id) || [],
      steps: [],
      tags: tagsById.get(r.id) || [],
      isUserRecipe: false,
    }));

    const hasNextPage = mapped.length === PAGE_SIZE;
    return {
      recipes: mapped,
      hasNextPage,
      nextOffset: hasNextPage ? offset + PAGE_SIZE : null,
    };
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[useGlobalRecipesInfinite] request failed; using seed fallback', err);
    if (offset === 0) {
      return { recipes: getSeedFallback(), nextOffset: null, hasNextPage: false };
    }
    return { recipes: [], nextOffset: null, hasNextPage: false };
  }
}

export function useGlobalRecipesInfinite() {
  return useInfiniteQuery<PageData, Error>({
    queryKey: ['global-recipes-infinite'],
    queryFn: ({ pageParam }) => fetchPage(pageParam as number),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => (lastPage.hasNextPage ? (lastPage.nextOffset ?? undefined) : undefined),
    staleTime: 1000 * 60 * 10,
    retry: 1,
    retryDelay: 1000,
  });
}
