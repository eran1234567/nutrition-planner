import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("Missing or invalid Authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized - missing authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the JWT token by getting user
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    
    if (userError || !user) {
      console.error("Invalid token:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized - invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;
    console.log(`Authenticated user: ${userId}`);
    console.log(`Authenticated user: ${userId}`);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { recipeId, imageBase64, fileName } = await req.json();

    // Validate required fields
    if (!recipeId || !imageBase64 || !fileName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: recipeId, imageBase64, fileName" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the user owns this recipe
    const { data: recipe, error: recipeError } = await supabase
      .from("recipes")
      .select("id, owner_user_id, scope")
      .eq("id", recipeId)
      .single();

    if (recipeError || !recipe) {
      console.error("Recipe not found:", recipeError);
      return new Response(
        JSON.stringify({ error: "Recipe not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only allow updating if user owns the recipe (or it's a global recipe for admins)
    if (recipe.owner_user_id !== userId && recipe.scope !== "global") {
      console.error(`User ${userId} does not own recipe ${recipeId}`);
      return new Response(
        JSON.stringify({ error: "Forbidden - you do not own this recipe" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decode base64 to binary
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("recipe-images")
      .upload(`global/${fileName}`, binaryData, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("recipe-images")
      .getPublicUrl(`global/${fileName}`);

    const publicUrl = urlData.publicUrl;

    // Update recipe with new image URL using ID (not title)
    const { error: updateError } = await supabase
      .from("recipes")
      .update({ image_url: publicUrl })
      .eq("id", recipeId);

    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify({ success: true, url: publicUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
