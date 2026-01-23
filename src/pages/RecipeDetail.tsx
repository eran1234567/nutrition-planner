import { useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowLeft, Clock, Users, Flame, ChefHat, Plus, Check, Loader2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BottomNav } from '@/components/layout/BottomNav';
import { RecipeEditor } from '@/components/recipe/RecipeEditor';
import { useRecipeById } from '@/hooks/useGlobalRecipes';
import { useAppStore } from '@/stores/appStore';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import type { Recipe } from '@/types';

export default function RecipeDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { selectedMeals, addSelectedMeal, removeSelectedMeal } = useAppStore();
  const [isEditing, setIsEditing] = useState(false);

  // Get serving multiplier from URL (for coming from Plan page)
  const servingMultiplier = useMemo(() => {
    const param = searchParams.get('servings');
    if (param) {
      const num = parseFloat(param);
      if (!isNaN(num) && num > 0) return num;
    }
    return 1;
  }, [searchParams]);

  // Fetch recipe from database (works for both global and user recipes)
  const { data: recipe, isLoading } = useRecipeById(id);

  // Determine if this is the user's own recipe (editable)
  const isUserRecipe = recipe?.owner_user_id === user?.id;
  const isSelected = recipe ? selectedMeals.some(r => r.id === recipe.id) : false;

  // Calculate adjusted nutrition based on serving multiplier
  const adjustedNutrition = useMemo(() => {
    if (!recipe?.nutrition) return null;
    const n = recipe.nutrition;
    return {
      calories: Math.round((n.calories || 0) * servingMultiplier),
      protein_g: Math.round((n.protein_g || 0) * servingMultiplier),
      carbs_g: Math.round((n.carbs_g || 0) * servingMultiplier),
      fat_g: Math.round((n.fat_g || 0) * servingMultiplier),
    };
  }, [recipe?.nutrition, servingMultiplier]);

  // Calculate adjusted ingredients based on serving multiplier
  const adjustedIngredients = useMemo(() => {
    if (!recipe?.ingredients) return [];
    return recipe.ingredients.map(ing => ({
      ...ing,
      quantity: ing.quantity ? parseFloat((ing.quantity * servingMultiplier).toFixed(2)) : null,
    }));
  }, [recipe?.ingredients, servingMultiplier]);

  // Format quantity for display (remove trailing zeros)
  const formatQuantity = (qty: number | null) => {
    if (qty === null) return '';
    const formatted = parseFloat(qty.toFixed(2));
    return formatted.toString();
  };

  const handleToggleSelect = () => {
    if (!recipe) return;
    if (isSelected) {
      removeSelectedMeal(recipe.id);
    } else {
      addSelectedMeal(recipe as any);
    }
  };

  const handleSaveEdit = (updatedRecipe: Recipe) => {
    queryClient.setQueryData(['recipe', id], updatedRecipe);
    setIsEditing(false);
  };

  if (isLoading) {
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

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Hero Image */}
      <div className="relative h-72 overflow-hidden">
        <img
          src={recipe.image_url || '/placeholder.svg'}
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

        {/* Edit and Add buttons */}
        <div className="absolute top-4 right-4 flex gap-2">
          {isUserRecipe && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="w-10 h-10 rounded-full bg-card/90 backdrop-blur flex items-center justify-center"
            >
              <Pencil className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={handleToggleSelect}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              isSelected
                ? 'bg-primary text-primary-foreground'
                : 'bg-card/90 backdrop-blur text-foreground'
            }`}
          >
            {isSelected ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          </button>
        </div>
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
              <span>
                {servingMultiplier !== 1 
                  ? `${parseFloat((recipe.servings * servingMultiplier).toFixed(1))} servings (${servingMultiplier}x)`
                  : `${recipe.servings} servings`
                }
              </span>
            </div>
            {recipe.difficulty && (
              <div className="flex items-center gap-1">
                <ChefHat className="w-4 h-4" />
                <span className="capitalize">{recipe.difficulty}</span>
              </div>
            )}
          </div>

          {/* Nutrition - adjusted by serving multiplier */}
          {adjustedNutrition && (
            <div className="bg-muted rounded-xl p-4 mb-6">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Flame className="w-4 h-4 text-primary" />
                {t('recipes.nutrition')}
                {servingMultiplier !== 1 && (
                  <span className="text-xs text-muted-foreground font-normal">
                    ({servingMultiplier}x serving)
                  </span>
                )}
              </h3>
              <div className="grid grid-cols-4 gap-3">
                <div className="text-center">
                  <p className="text-xl font-bold text-primary">{adjustedNutrition.calories}</p>
                  <p className="text-xs text-muted-foreground">kcal</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-success">{adjustedNutrition.protein_g}g</p>
                  <p className="text-xs text-muted-foreground">protein</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-warning">{adjustedNutrition.carbs_g}g</p>
                  <p className="text-xs text-muted-foreground">carbs</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-destructive">{adjustedNutrition.fat_g}g</p>
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

          {/* Editable content or read-only */}
          {isEditing && recipe ? (
            <RecipeEditor
              recipe={recipe as Recipe}
              onSave={handleSaveEdit}
              onCancel={() => setIsEditing(false)}
            />
          ) : (
            <>
              {/* Ingredients - adjusted by serving multiplier */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-3">
                  {t('recipes.ingredients')}
                  {servingMultiplier !== 1 && (
                    <span className="text-xs text-muted-foreground font-normal ml-2">
                      (adjusted for {servingMultiplier}x)
                    </span>
                  )}
                </h3>
                <ul className="space-y-2">
                  {adjustedIngredients.map((ing, index) => (
                    <li key={index} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <span className="flex-1 text-foreground">
                        {ing.quantity && `${formatQuantity(ing.quantity)} `}
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
                  {recipe.steps?.map((step) => (
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
            </>
          )}
        </motion.div>
      </div>

      <BottomNav />
    </div>
  );
}
