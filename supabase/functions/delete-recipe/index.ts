import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json(401, { success: false, error: "Unauthorized" });
    }

    // Verify user via anon client + incoming JWT
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !userData?.user?.id) {
      return json(401, { success: false, error: "Unauthorized" });
    }

    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const recipeId = (body as any)?.recipeId as string | undefined;
    if (!recipeId) {
      return json(400, { success: false, error: "recipeId is required" });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: recipe, error: recipeErr } = await supabase
      .from("recipes")
      .select("id, owner_user_id, is_deleted")
      .eq("id", recipeId)
      .maybeSingle();

    if (recipeErr) {
      console.error("[delete-recipe] lookup error:", recipeErr);
      return json(500, { success: false, error: "Failed to look up recipe" });
    }
    if (!recipe) {
      return json(404, { success: false, error: "Recipe not found" });
    }
    if (recipe.owner_user_id !== userId) {
      return json(403, { success: false, error: "Forbidden" });
    }

    if (recipe.is_deleted) {
      return json(200, { success: true, alreadyDeleted: true });
    }

    const { error: updateErr } = await supabase
      .from("recipes")
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq("id", recipeId);

    if (updateErr) {
      console.error("[delete-recipe] update error:", updateErr);
      return json(500, { success: false, error: "Failed to delete recipe" });
    }

    return json(200, { success: true });
  } catch (err) {
    console.error("[delete-recipe] Error:", err);
    return json(500, {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});
