import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface IngredientSection {
  name: string;
  ingredients: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiApiKey = Deno.env.get("GOOGLE_AI_STUDIO_GEMINI_API_KEY");

    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Gemini API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const genAI = new GoogleGenerativeAI(geminiApiKey);

    // Parse request body for optional filters
    let recipeId: string | null = null;
    let limit = 10;
    
    try {
      const body = await req.json();
      recipeId = body.recipeId || null;
      limit = body.limit || 10;
    } catch {
      // No body provided, use defaults
    }

    // Find recipes with source URLs that need section updates
    let query = supabase
      .from("upload_recipe_links")
      .select(`
        recipe_id,
        uploads!inner(source_url, owner_user_id)
      `)
      .not("uploads.source_url", "is", null);

    if (recipeId) {
      query = query.eq("recipe_id", recipeId);
    }

    const { data: links, error: linksError } = await query.limit(limit);

    if (linksError) {
      console.error("Error fetching upload links:", linksError);
      return new Response(
        JSON.stringify({ success: false, error: linksError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!links || links.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No recipes with source URLs found", updated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${links.length} recipes with source URLs to process`);

    const results: { recipeId: string; success: boolean; error?: string; sectionsFound?: string[] }[] = [];

    for (const link of links) {
      const { recipe_id, uploads } = link as any;
      const sourceUrl = uploads?.source_url;

      if (!sourceUrl) {
        results.push({ recipeId: recipe_id, success: false, error: "No source URL" });
        continue;
      }

      try {
        // Fetch current ingredients for this recipe
        const { data: ingredients, error: ingError } = await supabase
          .from("recipe_ingredients")
          .select("id, name, order_index, section")
          .eq("recipe_id", recipe_id)
          .order("order_index", { ascending: true });

        if (ingError || !ingredients?.length) {
          results.push({ recipeId: recipe_id, success: false, error: "No ingredients found" });
          continue;
        }

        // Fetch the source content
        let sourceContent = "";
        
        try {
          // Handle Instagram URLs specially
          if (sourceUrl.includes("instagram.com")) {
            const response = await fetch(sourceUrl, {
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "text/html,application/xhtml+xml",
              },
            });
            const html = await response.text();
            
            // Extract og:description (caption)
            const ogMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
            if (ogMatch) {
              sourceContent = ogMatch[1]
                .replace(/&amp;/g, "&")
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">")
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'");
            }
          } else {
            // Generic URL fetch
            const response = await fetch(sourceUrl, {
              headers: { "User-Agent": "Mozilla/5.0" },
            });
            sourceContent = await response.text();
          }
        } catch (fetchErr) {
          console.error(`Failed to fetch ${sourceUrl}:`, fetchErr);
          results.push({ recipeId: recipe_id, success: false, error: "Failed to fetch source URL" });
          continue;
        }

        if (!sourceContent || sourceContent.length < 50) {
          results.push({ recipeId: recipe_id, success: false, error: "Source content too short" });
          continue;
        }

        // Use Gemini to extract ingredient sections from source content
        const ingredientNames = ingredients.map((i: any) => i.name).join("\n");
        
        const prompt = `You are analyzing a recipe source to extract ingredient section/category information.

SOURCE CONTENT:
${sourceContent.substring(0, 8000)}

CURRENT RECIPE INGREDIENTS (in order):
${ingredientNames}

TASK:
1. Identify all ingredient sections/categories mentioned in the source content
2. Match each ingredient from the list above to its correct section
3. PRESERVE the EXACT section names from the source (e.g., "Creamy Tehina", "Onion Sumac Salad", "Crispy Pita")
4. DO NOT use generic labels if the source has specific names
5. Maintain the original ORDER of sections as they appear in the source

Return a JSON object with this structure:
{
  "sections": [
    {
      "name": "Section Name From Source",
      "ingredients": ["ingredient name 1", "ingredient name 2"]
    }
  ]
}

CRITICAL: 
- Section names must match the source EXACTLY
- Order sections in the same sequence as the source
- If a section name has an emoji in the source, you can omit the emoji
- If no sections found, use a single "Main" section`;

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Parse the JSON response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          results.push({ recipeId: recipe_id, success: false, error: "Failed to parse AI response" });
          continue;
        }

        const parsed = JSON.parse(jsonMatch[0]);
        const sections: IngredientSection[] = parsed.sections || [];

        if (sections.length === 0) {
          results.push({ recipeId: recipe_id, success: false, error: "No sections extracted" });
          continue;
        }

        // Build a map of ingredient name -> section
        const ingredientToSection = new Map<string, string>();
        const sectionOrder = new Map<string, number>();
        
        sections.forEach((sec, idx) => {
          sectionOrder.set(sec.name, idx);
          sec.ingredients.forEach((ingName) => {
            // Normalize for matching
            const normalizedName = ingName.toLowerCase().trim();
            ingredientToSection.set(normalizedName, sec.name);
          });
        });

        // Update ingredients with their sections
        let updatedCount = 0;
        const sectionsFound = new Set<string>();

        for (const ing of ingredients) {
          const normalizedName = ing.name.toLowerCase().trim();
          
          // Try exact match first, then partial match
          let section = ingredientToSection.get(normalizedName);
          
          if (!section) {
            // Try partial matching
            for (const [key, value] of ingredientToSection.entries()) {
              if (normalizedName.includes(key) || key.includes(normalizedName)) {
                section = value;
                break;
              }
            }
          }

          if (section && section !== ing.section) {
            const sectionIdx = sectionOrder.get(section) ?? 0;
            const newOrderIndex = sectionIdx * 100 + (ing.order_index % 100);
            
            const { error: updateErr } = await supabase
              .from("recipe_ingredients")
              .update({ 
                section,
                order_index: newOrderIndex
              })
              .eq("id", ing.id);

            if (!updateErr) {
              updatedCount++;
              sectionsFound.add(section);
            }
          } else if (section) {
            sectionsFound.add(section);
          }
        }

        results.push({ 
          recipeId: recipe_id, 
          success: true, 
          sectionsFound: Array.from(sectionsFound)
        });
        
        console.log(`Updated ${updatedCount} ingredients for recipe ${recipe_id}`);

        // Small delay to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 500));

      } catch (err) {
        console.error(`Error processing recipe ${recipe_id}:`, err);
        results.push({ recipeId: recipe_id, success: false, error: String(err) });
      }
    }

    const successCount = results.filter((r) => r.success).length;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.length} recipes, ${successCount} updated successfully`,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Backfill error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
