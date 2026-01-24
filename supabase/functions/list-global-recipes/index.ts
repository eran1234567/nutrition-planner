import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ListGlobalRecipesBody = {
  limit?: number;
  cursor?: string; // title of last recipe from previous page (cursor-based pagination)
};

type RecipeRow = {
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
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing backend configuration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body: ListGlobalRecipesBody = req.body
      ? await req.json().catch(() => ({}))
      : {};
    const limit = Math.min(Math.max(Number(body?.limit ?? 100) || 100, 1), 200);
    const cursor = typeof body?.cursor === "string" ? body.cursor : null;

    // Use raw REST API to bypass any SDK overhead
    // Build query params
    const selectCols = [
      "id",
      "title",
      "description",
      "image_url",
      "prep_time",
      "cook_time",
      "total_time",
      "servings",
      "serving_size",
      "difficulty",
      "cuisine",
      "is_kid_friendly",
      "is_meal_prep_friendly",
      "is_budget_friendly",
      "scope",
    ].join(",");

    const url = new URL(`${supabaseUrl}/rest/v1/recipes`);
    url.searchParams.set("select", selectCols);
    url.searchParams.set("scope", "eq.global");
    url.searchParams.set("is_deleted", "eq.false");
    if (cursor) {
      url.searchParams.set("title", `gt.${cursor}`);
    }
    // Fetch one extra to detect next page
    url.searchParams.set("limit", String(limit + 1));

    const recipesRes = await fetch(url.toString(), {
      method: "GET",
      headers: {
        apikey: supabaseServiceKey,
        Authorization: `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
        Prefer: "count=none",
      },
    });

    if (!recipesRes.ok) {
      const errText = await recipesRes.text();
      console.error("[list-global-recipes] recipes fetch failed:", errText);
      return new Response(
        JSON.stringify({ error: "Failed to load recipes" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const recipesRaw = (await recipesRes.json()) as RecipeRow[];

    // Sort in-app to avoid DB sort timeout
    let safeRecipes = recipesRaw
      .filter((r) => !!r?.id)
      .sort((a, b) => (a.title ?? "").localeCompare(b.title ?? "", undefined, { sensitivity: "base" }));

    // Determine if there's a next page
    const hasNextPage = safeRecipes.length > limit;
    if (hasNextPage) {
      safeRecipes = safeRecipes.slice(0, limit);
    }
    const nextCursor = hasNextPage && safeRecipes.length > 0
      ? safeRecipes[safeRecipes.length - 1].title
      : null;

    const ids = safeRecipes.map((r) => r.id);

    if (ids.length === 0) {
      return new Response(
        JSON.stringify({ recipes: [], nextCursor: null, hasNextPage: false }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=60",
          },
        },
      );
    }

    // Fetch nutrition and tags in parallel via REST
    const nutritionUrl = new URL(`${supabaseUrl}/rest/v1/recipe_nutrition`);
    nutritionUrl.searchParams.set("select", "recipe_id,calories,protein_g,carbs_g,fat_g,fiber_g,sodium_mg");
    nutritionUrl.searchParams.set("recipe_id", `in.(${ids.join(",")})`);

    const tagsUrl = new URL(`${supabaseUrl}/rest/v1/recipe_tags`);
    tagsUrl.searchParams.set("select", "recipe_id,tag_type,tag_value");
    tagsUrl.searchParams.set("recipe_id", `in.(${ids.join(",")})`);

    const [nutritionRes, tagsRes] = await Promise.all([
      fetch(nutritionUrl.toString(), {
        headers: {
          apikey: supabaseServiceKey,
          Authorization: `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
        },
      }),
      fetch(tagsUrl.toString(), {
        headers: {
          apikey: supabaseServiceKey,
          Authorization: `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
        },
      }),
    ]);

    const nutritionData = nutritionRes.ok ? ((await nutritionRes.json()) as any[]) : [];
    const tagsData = tagsRes.ok ? ((await tagsRes.json()) as any[]) : [];

    const nutritionById = new Map<string, any>();
    nutritionData.forEach((n) => {
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

    const tagsById = new Map<string, any[]>();
    tagsData.forEach((t) => {
      if (!t?.recipe_id) return;
      const list = tagsById.get(t.recipe_id) ?? [];
      list.push({ tag_type: t.tag_type, tag_value: t.tag_value });
      tagsById.set(t.recipe_id, list);
    });

    const payload = safeRecipes.map((r) => ({
      ...r,
      nutrition: nutritionById.get(r.id) ?? null,
      tags: tagsById.get(r.id) ?? [],
    }));

    return new Response(
      JSON.stringify({ recipes: payload, nextCursor, hasNextPage }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=60",
        },
      },
    );
  } catch (err) {
    console.error("[list-global-recipes] unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Unexpected error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
