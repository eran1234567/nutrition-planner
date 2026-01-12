import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowLeft, Clock, Users, Flame, ChefHat, Plus, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BottomNav } from '@/components/layout/BottomNav';
import { seedRecipes } from '@/data/seedRecipes';
import { useAppStore } from '@/stores/appStore';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import type { Recipe } from '@/types';

export default function RecipeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { selectedMeals, addSelectedMeal, removeSelectedMeal } = useAppStore();

  // First try to find in seed recipes
  const seedRecipe = seedRecipes.find(r => r.id === id);

  // If not in seed recipes, fetch from database
  const { data: dbRecipe, isLoading } = useQuery({
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
      } as Recipe;
    },
    enabled: !seedRecipe && !!id,
  });

  const recipe = seedRecipe || dbRecipe;

  if (isLoading && !seedRecipe) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">{t('recipes.notFound')}</p>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </div>
    );
  }

  const isSelected = selectedMeals.some(r => r.id === recipe.id);

  const handleToggleSelect = () => {
    if (isSelected) {
      removeSelectedMeal(recipe.id);
    } else {
      addSelectedMeal(recipe as any);
    }
  };

  const nutrition = recipe.nutrition;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Hero Image */}
      <div className="relative h-72 overflow-hidden">
        <img
          src={recipe.image_url}
          alt={recipe.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
        
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 w-10 h-10 rounded-full bg-card/90 backdrop-blur flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Add to plan button */}
        <button
          onClick={handleToggleSelect}
          className={`absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
            isSelected
              ? 'bg-primary text-primary-foreground'
              : 'bg-card/90 backdrop-blur text-foreground'
          }`}
        >
          {isSelected ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
        </button>
      </div>

      <div className="page-container -mt-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-t-3xl p-6"
        >
          {/* Title and badges */}
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-foreground mb-2">{recipe.title}</h1>
            <div className="flex flex-wrap gap-2">
              {recipe.is_kid_friendly && (
                <Badge variant="secondary" className="bg-warning/20 text-warning-foreground">
                  👶 Kid Friendly
                </Badge>
              )}
              {recipe.is_meal_prep_friendly && (
                <Badge variant="secondary" className="bg-primary/20 text-primary">
                  📦 Meal Prep
                </Badge>
              )}
              {recipe.is_budget_friendly && (
                <Badge variant="secondary" className="bg-success/20 text-success">
                  💰 Budget
                </Badge>
              )}
            </div>
          </div>

          {/* Quick info */}
          <div className="flex items-center gap-4 mb-6 text-sm text-muted-foreground">
            {recipe.total_time && (
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{recipe.total_time} min</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span>{recipe.servings} servings</span>
            </div>
            {recipe.difficulty && (
              <div className="flex items-center gap-1">
                <ChefHat className="w-4 h-4" />
                <span className="capitalize">{recipe.difficulty}</span>
              </div>
            )}
          </div>

          {/* Nutrition */}
          {nutrition && (
            <div className="bg-muted rounded-xl p-4 mb-6">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Flame className="w-4 h-4 text-primary" />
                {t('recipes.nutrition')}
              </h3>
              <div className="grid grid-cols-4 gap-3">
                <div className="text-center">
                  <p className="text-xl font-bold text-primary">{nutrition.calories}</p>
                  <p className="text-xs text-muted-foreground">kcal</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-success">{nutrition.protein_g}g</p>
                  <p className="text-xs text-muted-foreground">protein</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-warning">{nutrition.carbs_g}g</p>
                  <p className="text-xs text-muted-foreground">carbs</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-destructive">{nutrition.fat_g}g</p>
                  <p className="text-xs text-muted-foreground">fat</p>
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          {recipe.description && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-2">{t('recipes.description')}</h3>
              <p className="text-muted-foreground">{recipe.description}</p>
            </div>
          )}

          {/* Ingredients */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-3">{t('recipes.ingredients')}</h3>
            <ul className="space-y-2">
              {recipe.ingredients.map((ing, index) => (
                <li key={index} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span className="flex-1 text-foreground">
                    {ing.quantity && `${ing.quantity} `}
                    {ing.unit && `${ing.unit} `}
                    {ing.name}
                  </span>
                  {ing.aisle && (
                    <span className="text-xs text-muted-foreground">{ing.aisle}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Steps */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-3">{t('recipes.instructions')}</h3>
            <ol className="space-y-4">
              {recipe.steps.map((step) => (
                <li key={step.step_number} className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                    {step.step_number}
                  </div>
                  <p className="text-foreground pt-1">{step.instruction}</p>
                </li>
              ))}
            </ol>
          </div>

          {/* Add to plan button */}
          <Button
            onClick={handleToggleSelect}
            className={`w-full h-12 ${isSelected ? 'bg-muted text-foreground hover:bg-muted/80' : 'gradient-primary'}`}
            size="lg"
          >
            {isSelected ? (
              <>
                <Check className="w-5 h-5 mr-2" />
                Added to Plan
              </>
            ) : (
              <>
                <Plus className="w-5 h-5 mr-2" />
                Add to Plan
              </>
            )}
          </Button>
        </motion.div>
      </div>

      <BottomNav />
    </div>
  );
}
