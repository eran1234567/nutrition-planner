import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { uploadId, content, sourceUrl, fileType } = await req.json();

    if (!uploadId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Upload ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing upload ${uploadId}, type: ${fileType}`);

    // Update status to parsing
    await supabase.from('uploads').update({ status: 'parsing' }).eq('id', uploadId);

    // Build the prompt based on content type
    let prompt = `You are a recipe extraction expert. Extract recipe information from the following content and return it as JSON.

The JSON should have this structure:
{
  "recipes": [
    {
      "title": "Recipe title",
      "description": "Brief description",
      "prep_time": 15,
      "cook_time": 30,
      "total_time": 45,
      "servings": 4,
      "difficulty": "easy|medium|hard",
      "cuisine": "Italian|Mexican|Asian|etc",
      "ingredients": [
        { "name": "ingredient name", "quantity": 2, "unit": "cups" }
      ],
      "steps": [
        "Step 1 instruction",
        "Step 2 instruction"
      ],
      "nutrition": {
        "calories": 350,
        "protein_g": 25,
        "carbs_g": 30,
        "fat_g": 15
      },
      "tags": ["dinner", "quick", "healthy"]
    }
  ]
}

If you cannot find recipe information, return: { "recipes": [], "error": "Could not extract recipe information" }

Content to analyze:
${content || sourceUrl || 'No content provided'}`;

    // Call Lovable AI
    const aiResponse = await fetch(LOVABLE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a recipe extraction AI. Always respond with valid JSON only, no markdown or explanation.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;
    
    if (!aiContent) {
      throw new Error('No response from AI');
    }

    console.log('AI response received:', aiContent.substring(0, 200));

    // Parse the JSON response
    let parsedRecipes;
    try {
      // Remove markdown code blocks if present
      let cleanContent = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsedRecipes = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      throw new Error('Failed to parse AI response as JSON');
    }

    // Get the upload to find owner
    const { data: upload } = await supabase
      .from('uploads')
      .select('owner_user_id')
      .eq('id', uploadId)
      .single();

    if (!upload) {
      throw new Error('Upload not found');
    }

    // Save recipes to database
    const createdRecipes = [];
    for (const recipe of parsedRecipes.recipes || []) {
      // Insert recipe
      const { data: newRecipe, error: recipeError } = await supabase
        .from('recipes')
        .insert({
          owner_user_id: upload.owner_user_id,
          title: recipe.title,
          description: recipe.description,
          prep_time: recipe.prep_time,
          cook_time: recipe.cook_time,
          total_time: recipe.total_time || ((recipe.prep_time || 0) + (recipe.cook_time || 0)),
          servings: recipe.servings || 4,
          difficulty: recipe.difficulty || 'medium',
          cuisine: recipe.cuisine,
          scope: 'private',
        })
        .select()
        .single();

      if (recipeError) {
        console.error('Error creating recipe:', recipeError);
        continue;
      }

      createdRecipes.push(newRecipe);

      // Insert ingredients
      if (recipe.ingredients?.length > 0) {
        const ingredients = recipe.ingredients.map((ing: any, idx: number) => ({
          recipe_id: newRecipe.id,
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit,
          order_index: idx,
        }));
        await supabase.from('recipe_ingredients').insert(ingredients);
      }

      // Insert steps
      if (recipe.steps?.length > 0) {
        const steps = recipe.steps.map((step: string, idx: number) => ({
          recipe_id: newRecipe.id,
          step_number: idx + 1,
          instruction: step,
        }));
        await supabase.from('recipe_steps').insert(steps);
      }

      // Insert nutrition
      if (recipe.nutrition) {
        await supabase.from('recipe_nutrition').insert({
          recipe_id: newRecipe.id,
          calories: recipe.nutrition.calories,
          protein_g: recipe.nutrition.protein_g,
          carbs_g: recipe.nutrition.carbs_g,
          fat_g: recipe.nutrition.fat_g,
        });
      }

      // Insert tags
      if (recipe.tags?.length > 0) {
        const tags = recipe.tags.map((tag: string) => ({
          recipe_id: newRecipe.id,
          tag_type: 'meal',
          tag_value: tag,
        }));
        await supabase.from('recipe_tags').insert(tags);
      }

      // Link upload to recipe
      await supabase.from('upload_recipe_links').insert({
        upload_id: uploadId,
        recipe_id: newRecipe.id,
      });
    }

    // Update upload status
    await supabase.from('uploads').update({
      status: 'parsed',
      parsed_text: aiContent,
    }).eq('id', uploadId);

    console.log(`Successfully parsed ${createdRecipes.length} recipes`);

    return new Response(
      JSON.stringify({
        success: true,
        recipes: createdRecipes,
        count: createdRecipes.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error parsing recipe:', errorMessage);
    
    // Try to update upload status to failed
    try {
      const { uploadId } = await req.clone().json();
      if (uploadId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await supabase.from('uploads').update({
          status: 'failed',
          error_message: errorMessage,
        }).eq('id', uploadId);
      }
    } catch (e) {
      console.error('Failed to update upload status:', e);
    }

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
