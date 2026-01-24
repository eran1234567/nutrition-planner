import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

serve(async (req) => {
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
    
    const { content, title, filters, _seedKey } = await req.json();
    
    // This function works with service-role access OR internal seeding key
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    // Allow access if: service-role key matches OR _seedKey matches LOVABLE_API_KEY
    const isAuthorized = token === supabaseServiceKey || _seedKey === LOVABLE_API_KEY;
    
    if (!isAuthorized) {
      console.error('Unauthorized: service-role or seed key required');
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized: service-role access required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!content || typeof content !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'Content is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Seeding global recipe: ${title || 'untitled'}`);

    // Comprehensive system prompt with all recipe generation rules
    const systemPrompt = `You are an AI expert in nutrition science, metabolic health, professional cooking, recipe engineering, macro calculation, and meal scaling.
Your job is to generate one complete, accurate, and HEALTH-OPTIMIZED recipe based on the provided description.

CORE PRINCIPLES:
- Be accurate, deterministic, and practical
- Each ingredient needs: name, quantity (numeric), unit (or null)
- Calculate realistic nutrition per serving based on actual ingredients

HEALTH OPTIMIZATION (DEFAULT BEHAVIOR - always apply unless specific diet requires otherwise):
- MINIMIZE sodium: Use minimal added salt (typically 1/4 to 1/2 tsp total for 4 servings max)
- Target sodium: < 600mg per serving for most recipes, < 400mg preferred
- Use fresh herbs, garlic, lemon, spices for flavor instead of salt
- Prefer lean proteins when appropriate (e.g., 90/10 ground beef over 80/20)
- Balance macros: aim for reasonable calories per serving (400-600 kcal for main dishes)
- Include vegetables and fiber sources when possible

PORTION CONTROL:
- Main dish servings should be reasonable (400-600 kcal unless high-protein/athlete meal)
- For meatballs/patties: 3-4 medium-sized per serving is typical
- For meat portions: 4-6 oz cooked per serving
- For starch portions: 1/2 to 1 cup per serving

SERVINGS RULE:
- Default to 4 servings for main dishes unless specified otherwise
- Every recipe MUST define serving size explicitly

DISCRETE FOODS RULE (For countable items like meatballs, patties, stuffed peppers):
- State total units made
- State how many units equal one serving
- Instructions must specify how many units to form
Example: "Makes 16 meatballs. 1 serving = 4 meatballs."

NUTRITION CALCULATION (per serving):
- Calculate based on actual ingredients and quantities
- Divide by servings to get per-serving values
- Calories must be accurate within ±2%
- Use standard nutrition databases knowledge

HEALTH TAGS (Hard Constraints - only tag if fully compliant):
- Low Sodium: < 300 mg sodium per serving
- Kidney Friendly: < 400 mg sodium AND < 30 g protein per serving
- Diabetes Friendly: ≥ 5 g fiber AND < 40 g carbs per serving
- Heart Healthy: ≥ 5 g fiber AND < 300 mg sodium per serving

DIET RULES (Strict compliance required for tags):
- Keto: ≤ 8g net carbs, ≥ 60% calories from fat, ≤ 35% calories from protein
- Paleo: No grains, legumes, dairy, or refined oils
- Mediterranean: No red meat, processed foods, or refined grains
- Vegan: No animal products
- Vegetarian: No meat or fish
- Pescatarian: Fish allowed, no meat

Always respond with valid JSON only, no markdown code blocks or explanation.`;

    const jsonFormat = `REQUIRED JSON structure (respond with ONLY this JSON, no markdown):
{
  "recipe": {
    "title": "Recipe title",
    "description": "Brief description of the dish including what makes it special",
    "prep_time": 15,
    "cook_time": 30,
    "total_time": 45,
    "servings": 4,
    "serving_size": "1 cup" or "4 meatballs + sauce",
    "difficulty": "easy|medium|hard",
    "cuisine": "American|Italian|Mexican|Asian|Mediterranean|Indian|Japanese|Thai|French|Greek|Brazilian",
    "is_kid_friendly": false,
    "is_meal_prep_friendly": true,
    "is_budget_friendly": true,
    "ingredients": [
      { "name": "ingredient name", "quantity": 2, "unit": "cups", "aisle": "Produce|Meat|Dairy|Bakery|Canned Goods|Spices|Oils|Health Foods" }
    ],
    "steps": [
      "Step 1 instruction with specific details",
      "Step 2 instruction including portion info for discrete items"
    ],
    "nutrition": {
      "calories": 250,
      "protein_g": 12,
      "carbs_g": 30,
      "fat_g": 10,
      "fiber_g": 5,
      "sodium_mg": 400,
      "sugar_g": 8,
      "saturated_fat_g": 3,
      "cholesterol_mg": 50
    },
    "diet_tags": ["vegetarian", "mediterranean"],
    "health_tags": ["diabetes-friendly", "heart-healthy"],
    "units_info": {
      "total_units": 16,
      "units_per_serving": 4,
      "unit_name": "meatballs"
    }
  }
}

CRITICAL RULES:
1. Include ALL ingredients with exact quantities
2. Calculate accurate nutrition per serving
3. For countable items (meatballs, patties), include units_info
4. Only add diet_tags and health_tags if recipe FULLY complies with rules
5. Include serving_size as human-readable portion (e.g., "4 meatballs + 1 cup sauce")
6. Steps should specify quantities for discrete items`;

    // Build filter context
    let filterContext = '';
    if (filters) {
      if (filters.meal_type) filterContext += `Meal type: ${filters.meal_type}. `;
      if (filters.cuisine) filterContext += `Cuisine: ${filters.cuisine}. `;
      if (filters.diet_type) filterContext += `Diet: ${filters.diet_type}. `;
      if (filters.max_time) filterContext += `Max cooking time: ${filters.max_time} minutes. `;
      if (filters.allergies?.length) filterContext += `Allergies to avoid: ${filters.allergies.join(', ')}. `;
      if (filters.dislikes?.length) filterContext += `Dislikes to avoid: ${filters.dislikes.join(', ')}. `;
      if (filters.health?.length) filterContext += `Health considerations: ${filters.health.join(', ')}. `;
    }

    const userPrompt = `Generate a complete recipe based on this description:

${title ? `Title: ${title}` : ''}
${content}

${filterContext ? `Filters: ${filterContext}` : ''}

${jsonFormat}`;

    console.log('Calling AI for recipe generation...');
    const aiStartTime = Date.now();

    const aiResponse = await fetch(LOVABLE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;

    if (!aiContent) {
      throw new Error('No response from AI');
    }

    console.log(`AI response received in ${Date.now() - aiStartTime}ms`);

    // Parse the JSON response
    let parsedRecipe;
    try {
      let cleanContent = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsedRecipe = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.error('Raw response:', aiContent.substring(0, 500));
      throw new Error('Failed to parse AI response as JSON');
    }

    const recipe = parsedRecipe.recipe || parsedRecipe.recipes?.[0];
    if (!recipe) {
      throw new Error('No recipe found in AI response');
    }

    // Sanitize and insert the recipe
    const sanitizedTitle = (recipe.title || title || 'Untitled Recipe').trim().substring(0, 200);
    const sanitizedDescription = typeof recipe.description === 'string' 
      ? recipe.description.trim().substring(0, 1000) 
      : null;
    const sanitizedCuisine = typeof recipe.cuisine === 'string'
      ? recipe.cuisine.trim().substring(0, 50)
      : filters?.cuisine || null;
    
    const sanitizedServings = (typeof recipe.servings === 'number' && recipe.servings >= 1 && recipe.servings <= 100)
      ? Math.round(recipe.servings) : 4;
    const sanitizedPrepTime = (typeof recipe.prep_time === 'number' && recipe.prep_time >= 0 && recipe.prep_time <= 1440)
      ? Math.round(recipe.prep_time) : null;
    const sanitizedCookTime = (typeof recipe.cook_time === 'number' && recipe.cook_time >= 0 && recipe.cook_time <= 1440)
      ? Math.round(recipe.cook_time) : null;
    const sanitizedTotalTime = (typeof recipe.total_time === 'number' && recipe.total_time >= 0 && recipe.total_time <= 2880)
      ? Math.round(recipe.total_time) : ((sanitizedPrepTime || 0) + (sanitizedCookTime || 0)) || null;
    
    const validDifficulties = ['easy', 'medium', 'hard'];
    const sanitizedDifficulty = validDifficulties.includes(recipe.difficulty) ? recipe.difficulty : 'medium';

    // Insert the recipe as global
    const { data: newRecipe, error: recipeError } = await supabase
      .from('recipes')
      .insert({
        owner_user_id: null,
        title: sanitizedTitle,
        description: sanitizedDescription,
        prep_time: sanitizedPrepTime,
        cook_time: sanitizedCookTime,
        total_time: sanitizedTotalTime,
        servings: sanitizedServings,
        difficulty: sanitizedDifficulty,
        cuisine: sanitizedCuisine,
        scope: 'global',
        is_kid_friendly: typeof recipe.is_kid_friendly === 'boolean' ? recipe.is_kid_friendly : false,
        is_meal_prep_friendly: typeof recipe.is_meal_prep_friendly === 'boolean' ? recipe.is_meal_prep_friendly : false,
        is_budget_friendly: typeof recipe.is_budget_friendly === 'boolean' ? recipe.is_budget_friendly : false,
      })
      .select()
      .single();

    if (recipeError) {
      console.error('Error creating recipe:', recipeError);
      throw new Error('Failed to create recipe');
    }

    console.log(`Recipe created: ${newRecipe.id}`);

    // Insert related data in parallel
    const relatedPromises = [];

    // Ingredients
    if (Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0) {
      const validIngredients = recipe.ingredients
        .filter((ing: any) => ing && typeof ing.name === 'string' && ing.name.trim())
        .slice(0, 100)
        .map((ing: any, idx: number) => ({
          recipe_id: newRecipe.id,
          name: ing.name.trim().substring(0, 200),
          quantity: (typeof ing.quantity === 'number' && ing.quantity >= 0 && ing.quantity <= 10000) ? ing.quantity : null,
          unit: typeof ing.unit === 'string' ? ing.unit.trim().substring(0, 50) : null,
          aisle: typeof ing.aisle === 'string' ? ing.aisle.trim().substring(0, 50) : null,
          order_index: idx,
        }));
      
      if (validIngredients.length > 0) {
        relatedPromises.push(supabase.from('recipe_ingredients').insert(validIngredients));
      }
    }

    // Steps
    if (Array.isArray(recipe.steps) && recipe.steps.length > 0) {
      const validSteps = recipe.steps
        .filter((step: any) => typeof step === 'string' && step.trim())
        .slice(0, 50)
        .map((step: string, idx: number) => ({
          recipe_id: newRecipe.id,
          step_number: idx + 1,
          instruction: step.trim().substring(0, 2000),
        }));
      
      if (validSteps.length > 0) {
        relatedPromises.push(supabase.from('recipe_steps').insert(validSteps));
      }
    }

    // Nutrition
    const validateNutrition = (val: any, max: number): number | null => {
      if (typeof val === 'number' && val >= 0 && val <= max) {
        return Math.round(val * 10) / 10;
      }
      return null;
    };
    
    relatedPromises.push(supabase.from('recipe_nutrition').insert({
      recipe_id: newRecipe.id,
      calories: validateNutrition(recipe.nutrition?.calories, 10000),
      protein_g: validateNutrition(recipe.nutrition?.protein_g, 1000),
      carbs_g: validateNutrition(recipe.nutrition?.carbs_g, 1000),
      fat_g: validateNutrition(recipe.nutrition?.fat_g, 1000),
      fiber_g: validateNutrition(recipe.nutrition?.fiber_g, 500),
      sodium_mg: validateNutrition(recipe.nutrition?.sodium_mg, 50000),
      sugar_g: validateNutrition(recipe.nutrition?.sugar_g, 500),
      saturated_fat_g: validateNutrition(recipe.nutrition?.saturated_fat_g, 200),
      cholesterol_mg: validateNutrition(recipe.nutrition?.cholesterol_mg, 2000),
    }));

    // Tags - meal type from filters
    const allTags: { recipe_id: string; tag_type: string; tag_value: string }[] = [];
    
    if (filters?.meal_type) {
      allTags.push({
        recipe_id: newRecipe.id,
        tag_type: 'meal',
        tag_value: filters.meal_type.toLowerCase(),
      });
    }
    
    // Diet tags
    if (Array.isArray(recipe.diet_tags)) {
      recipe.diet_tags
        .filter((tag: any) => typeof tag === 'string' && tag.trim())
        .slice(0, 10)
        .forEach((tag: string) => {
          allTags.push({
            recipe_id: newRecipe.id,
            tag_type: 'diet',
            tag_value: tag.trim().toLowerCase().replace(/\s+/g, '-').substring(0, 50),
          });
        });
    }
    
    // Health tags
    if (Array.isArray(recipe.health_tags)) {
      recipe.health_tags
        .filter((tag: any) => typeof tag === 'string' && tag.trim())
        .slice(0, 10)
        .forEach((tag: string) => {
          allTags.push({
            recipe_id: newRecipe.id,
            tag_type: 'health',
            tag_value: tag.trim().toLowerCase().replace(/\s+/g, '-').substring(0, 50),
          });
        });
    }
    
    if (allTags.length > 0) {
      relatedPromises.push(supabase.from('recipe_tags').insert(allTags));
    }

    await Promise.all(relatedPromises);

    // Generate image in background
    console.log('Generating recipe image...');
    const imagePrompt = `Professional food photography of a home-cooked ${sanitizedTitle}. ${sanitizedDescription || ''}
Final plated dish only. Realistic home-cooked appearance. Match the actual ingredients and portions from the recipe.
No text, no extra garnish or props not in the recipe. Natural lighting, overhead or 45-degree angle, clean simple background, appetizing presentation.
4:3 aspect ratio, high-quality food photography style.`;

    try {
      const imageResponse = await fetch(LOVABLE_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-image-preview',
          messages: [{ role: 'user', content: imagePrompt }],
          modalities: ['image', 'text']
        }),
      });

      if (imageResponse.ok) {
        const imageData = await imageResponse.json();
        const generatedImageUrl = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        
        if (generatedImageUrl) {
          await supabase.from('recipes').update({
            image_url: generatedImageUrl
          }).eq('id', newRecipe.id);
          console.log('Image saved successfully');
        }
      }
    } catch (imgErr) {
      console.error('Image generation failed:', imgErr);
      // Continue without image - not critical
    }

    console.log(`Recipe seeding complete: ${sanitizedTitle}`);

    return new Response(
      JSON.stringify({
        success: true,
        recipe: {
          id: newRecipe.id,
          title: sanitizedTitle,
          description: sanitizedDescription,
          nutrition: recipe.nutrition,
          health_tags: recipe.health_tags,
          diet_tags: recipe.diet_tags,
          units_info: recipe.units_info,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error seeding recipe:', errorMessage);
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
