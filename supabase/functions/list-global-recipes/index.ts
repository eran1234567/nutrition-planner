import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ListGlobalRecipesBody = {
  limit?: number;
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
    const limit = Math.min(Math.max(Number(body?.limit ?? 1000) || 1000, 1), 1000);

    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: recipes, error: recipesError } = await admin
      .from("recipes")
      .select(
        [
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
        ].join(","),
      )
      .eq("scope", "global")
      .eq("is_deleted", false)
      .order("title", { ascending: true })
      .limit(limit);

    if (recipesError) {
      console.error("[list-global-recipes] recipes query failed:", recipesError);
      return new Response(
        JSON.stringify({ error: "Failed to load recipes" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // The Deno/esm typings for supabase-js can produce overly-broad union types;
    // we narrow defensively here.
    const safeRecipes = ((recipes ?? []) as unknown as RecipeRow[]).filter((r) => !!r?.id);
    const ids = safeRecipes.map((r) => r.id);

    if (ids.length === 0) {
      return new Response(
        JSON.stringify({ recipes: [] }),
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

    const [nutritionRes, tagsRes] = await Promise.all([
      admin
        .from("recipe_nutrition")
        .select("recipe_id, calories, protein_g, carbs_g, fat_g, fiber_g, sodium_mg")
        .in("recipe_id", ids),
      admin
        .from("recipe_tags")
        .select("recipe_id, tag_type, tag_value")
        .in("recipe_id", ids),
    ]);

    if (nutritionRes.error) {
      console.error("[list-global-recipes] nutrition query failed:", nutritionRes.error);
    }
    if (tagsRes.error) {
      console.error("[list-global-recipes] tags query failed:", tagsRes.error);
    }

    const nutritionById = new Map<string, any>();
    (nutritionRes.data ?? []).forEach((n: any) => {
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
    (tagsRes.data ?? []).forEach((t: any) => {
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
      JSON.stringify({ recipes: payload }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          // Cache briefly to reduce repeated load during browsing
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
