import { useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowLeft, Clock, Users, Flame, ChefHat, Plus, Loader2, Pencil, Leaf, Fish, Drumstick, Sun, CalendarPlus, Trash2, Heart, Droplets, Activity, Globe, Pizza, UtensilsCrossed, Soup, Cherry } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { BottomNav } from '@/components/layout/BottomNav';
import { RecipeEditor } from '@/components/recipe/RecipeEditor';
import { AddToPlanModal } from '@/components/plan/AddToPlanModal';
import { useRecipeById } from '@/hooks/useGlobalRecipes';
import { useMealPlanStore } from '@/stores/mealPlanStore';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import type { Recipe } from '@/types';
import { getHealthBadges } from '@/lib/nutrition/healthDetection';

// Diet badge config with colors and icons
const DIET_BADGES: Record<string, { label: string; icon: React.ReactNode; bgClass: string; textClass: string }> = {
  keto: { label: 'Keto', icon: <Flame className="w-3 h-3" />, bgClass: 'bg-emerald-500/90', textClass: 'text-white' },
  vegan: { label: 'Vegan', icon: <Leaf className="w-3 h-3" />, bgClass: 'bg-green-600/90', textClass: 'text-white' },
  vegetarian: { label: 'Vegetarian', icon: <Leaf className="w-3 h-3" />, bgClass: 'bg-lime-500/90', textClass: 'text-white' },
  pescatarian: { label: 'Pescatarian', icon: <Fish className="w-3 h-3" />, bgClass: 'bg-sky-500/90', textClass: 'text-white' },
  paleo: { label: 'Paleo', icon: <Drumstick className="w-3 h-3" />, bgClass: 'bg-amber-600/90', textClass: 'text-white' },
  mediterranean: { label: 'Mediterranean', icon: <Sun className="w-3 h-3" />, bgClass: 'bg-orange-500/90', textClass: 'text-white' },
  // Health consideration badges
  'diabetes-friendly': { label: 'Diabetes Friendly', icon: <Activity className="w-3 h-3" />, bgClass: 'bg-blue-500/90', textClass: 'text-white' },
  'heart-healthy': { label: 'Heart Healthy', icon: <Heart className="w-3 h-3" />, bgClass: 'bg-rose-500/90', textClass: 'text-white' },
  'low-sodium': { label: 'Low Sodium', icon: <Droplets className="w-3 h-3" />, bgClass: 'bg-cyan-500/90', textClass: 'text-white' },
  'kidney-friendly': { label: 'Kidney Friendly', icon: <Droplets className="w-3 h-3" />, bgClass: 'bg-purple-500/90', textClass: 'text-white' },
};

// Health badge tooltip definitions
const HEALTH_BADGE_TOOLTIPS: Record<string, string> = {
  'low-sodium': '< 300mg sodium per serving',
  'kidney-friendly': '< 400mg sodium + < 30g protein',
  'diabetes-friendly': '≥ 5g fiber + < 40g carbs',
  'heart-healthy': '≥ 5g fiber + < 300mg sodium',
};

// Diet badge tooltip definitions
const DIET_BADGE_TOOLTIPS: Record<string, string> = {
  keto: '≤ 8g carbs, ≥ 60% fat, ≤ 35% protein',
  paleo: 'No grains, legumes, dairy, or refined oils',
  mediterranean: 'No red meat, processed foods, or refined grains',
  vegan: 'No animal products',
  vegetarian: 'No meat or fish',
  pescatarian: 'Fish allowed, no meat',
};

// Cuisine badge config with colors and icons
const CUISINE_BADGES: Record<string, { label: string; icon: React.ReactNode; bgClass: string; textClass: string }> = {
  american: { label: 'American', icon: <UtensilsCrossed className="w-3 h-3" />, bgClass: 'bg-red-500/90', textClass: 'text-white' },
  italian: { label: 'Italian', icon: <Pizza className="w-3 h-3" />, bgClass: 'bg-green-700/90', textClass: 'text-white' },
  mexican: { label: 'Mexican', icon: <Cherry className="w-3 h-3" />, bgClass: 'bg-red-600/90', textClass: 'text-white' },
  asian: { label: 'Asian', icon: <Soup className="w-3 h-3" />, bgClass: 'bg-amber-500/90', textClass: 'text-white' },
  mediterranean: { label: 'Mediterranean', icon: <Sun className="w-3 h-3" />, bgClass: 'bg-orange-500/90', textClass: 'text-white' },
  indian: { label: 'Indian', icon: <Flame className="w-3 h-3" />, bgClass: 'bg-orange-600/90', textClass: 'text-white' },
  japanese: { label: 'Japanese', icon: <Fish className="w-3 h-3" />, bgClass: 'bg-pink-500/90', textClass: 'text-white' },
  thai: { label: 'Thai', icon: <Leaf className="w-3 h-3" />, bgClass: 'bg-teal-500/90', textClass: 'text-white' },
  french: { label: 'French', icon: <UtensilsCrossed className="w-3 h-3" />, bgClass: 'bg-blue-600/90', textClass: 'text-white' },
  greek: { label: 'Greek', icon: <Sun className="w-3 h-3" />, bgClass: 'bg-sky-600/90', textClass: 'text-white' },
  brazilian: { label: 'Brazilian', icon: <Leaf className="w-3 h-3" />, bgClass: 'bg-yellow-500/90', textClass: 'text-white' },
};

// Diet exclusions for auto-detection
const dietExclusions: Record<string, string[]> = {
  paleo: ['bread', 'pasta', 'rice', 'noodle', 'grain', 'wheat', 'oat', 'corn', 'quinoa', 'barley', 'cereal', 'granola', 'tortilla', 'bean', 'lentil', 'chickpea', 'hummus', 'peanut', 'soy', 'tofu', 'tempeh', 'edamame', 'dairy', 'milk', 'cheese', 'yogurt', 'butter', 'cream', 'sugar', 'candy', 'cake', 'cookie', 'donut', 'pastry'],
  mediterranean: ['beef', 'steak', 'pork', 'bacon', 'ham', 'sausage', 'hot dog', 'salami', 'processed meat', 'butter', 'margarine', 'sugar', 'candy', 'cake', 'cookie', 'donut', 'soda', 'fried', 'deep fried'],
};

// Strict keto thresholds
const KETO_MAX_CARBS = 8;
const KETO_MAX_CARB_PERCENT = 10;
const KETO_MAX_PROTEIN_PERCENT = 35;
const KETO_MIN_FAT_PERCENT = 60;

export default function RecipeDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const {
    selectedMealSlots,
    generatedPlan,
    recipePoolsBySlot,
    exactAssignments,
    lockedSlots,
    removeFromPool,
    removeExactAssignment,
    setGeneratedPlan,
    toggleSlotLock,
  } = useMealPlanStore();
  const [isEditing, setIsEditing] = useState(false);
  const [showAddToPlanModal, setShowAddToPlanModal] = useState(false);

  // Get requested servings from URL (for coming from Plan page)
  // This is the actual number of servings needed, not a multiplier
  const requestedServings = useMemo(() => {
    const param = searchParams.get('servings');
    if (param) {
      const num = parseFloat(param);
      if (!isNaN(num) && num > 0) return num;
    }
    return null; // null means no override, show recipe as-is
  }, [searchParams]);

  // Fetch recipe from database (works for both global and user recipes)
  const { data: recipe, isLoading } = useRecipeById(id);

  // Calculate actual multiplier: requested servings / recipe base servings
  const servingMultiplier = useMemo(() => {
    if (requestedServings === null || !recipe?.servings) return 1;
    return requestedServings / recipe.servings;
  }, [requestedServings, recipe?.servings]);


  // Determine if this is the user's own recipe (editable)
  const isUserRecipe = recipe?.owner_user_id === user?.id;
  
  // Check if user has a meal plan configured
  const hasMealPlanSetup = selectedMealSlots.length > 0;

  // Check if this recipe is already in the active meal plan (generated plan, pools, or exact assignments)
  const isAlreadyInPlan = useMemo(() => {
    if (!id) return false;
    
    // Check generated plan
    if (generatedPlan?.days.some(day => 
      day.slots.some(slot => slot.recipeId === id)
    )) {
      return true;
    }
    
    // Check recipe pools
    for (const slotId in recipePoolsBySlot) {
      if (recipePoolsBySlot[slotId]?.includes(id)) {
        return true;
      }
    }
    
    // Check exact assignments
    for (const dayIndex in exactAssignments) {
      const dayAssignments = exactAssignments[Number(dayIndex)];
      for (const slotId in dayAssignments) {
        if (dayAssignments[slotId]?.recipeId === id) {
          return true;
        }
      }
    }
    
    return false;
  }, [generatedPlan, recipePoolsBySlot, exactAssignments, id]);

  // Nutrition is ALWAYS per serving - never scaled
  // The nutrition values in the database represent what you get from one serving
  const perServingNutrition = useMemo(() => {
    if (!recipe?.nutrition) return null;
    const n = recipe.nutrition;
    return {
      calories: Math.round(n.calories || 0),
      protein_g: Math.round(n.protein_g || 0),
      carbs_g: Math.round(n.carbs_g || 0),
      fat_g: Math.round(n.fat_g || 0),
      fiber_g: Math.round(n.fiber_g || 0),
      sodium_mg: Math.round(n.sodium_mg || 0),
    };
  }, [recipe?.nutrition]);

  // Calculate adjusted ingredients based on serving multiplier
  const adjustedIngredients = useMemo(() => {
    if (!recipe?.ingredients) return [];
    return recipe.ingredients.map(ing => ({
      ...ing,
      quantity: ing.quantity ? parseFloat((ing.quantity * servingMultiplier).toFixed(2)) : null,
    }));
  }, [recipe?.ingredients, servingMultiplier]);

  // Helper to check if recipe meets strict keto macro criteria
  const isKetoFriendly = useMemo(() => {
    const nutrition = recipe?.nutrition;
    if (!nutrition) return false;
    
    const carbs = nutrition.carbs_g ?? 0;
    const protein = nutrition.protein_g ?? 0;
    const fat = nutrition.fat_g ?? 0;
    
    if (carbs > KETO_MAX_CARBS) return false;
    
    const proteinCals = protein * 4;
    const fatCals = fat * 9;
    const carbCals = carbs * 4;
    const totalMacroCals = proteinCals + fatCals + carbCals;
    
    if (totalMacroCals <= 0) return false;
    
    const carbPercent = (carbCals / totalMacroCals) * 100;
    const proteinPercent = (proteinCals / totalMacroCals) * 100;
    const fatPercent = (fatCals / totalMacroCals) * 100;
    
    return carbPercent <= KETO_MAX_CARB_PERCENT && 
           proteinPercent <= KETO_MAX_PROTEIN_PERCENT && 
           fatPercent >= KETO_MIN_FAT_PERCENT;
  }, [recipe?.nutrition]);

  // Helper to check if recipe is paleo-friendly based on ingredients
  const isPaleoFriendly = useMemo(() => {
    const ingredients = recipe?.ingredients;
    if (!ingredients || ingredients.length === 0) return false;
    
    return !ingredients.some(ing => {
      const ingName = (ing.normalized_name || ing.name || '').toLowerCase();
      return dietExclusions.paleo.some(excluded => ingName.includes(excluded));
    });
  }, [recipe?.ingredients]);

  // Helper to check if recipe is mediterranean-friendly
  const isMediterraneanFriendly = useMemo(() => {
    const ingredients = recipe?.ingredients;
    if (!ingredients || ingredients.length === 0) return false;
    
    return !ingredients.some(ing => {
      const ingName = (ing.normalized_name || ing.name || '').toLowerCase();
      return dietExclusions.mediterranean.some(excluded => ingName.includes(excluded));
    });
  }, [recipe?.ingredients]);

  // Build diet badges array
  const dietBadges = useMemo(() => {
    if (!recipe) return [];
    
    const badges: string[] = [];
    const recipeDietTags = (recipe.tags || [])
      .filter((t: { tag_type: string; tag_value: string }) => t.tag_type === 'diet')
      .map((t: { tag_type: string; tag_value: string }) => t.tag_value.toLowerCase());
    
    // Keto: auto-detect from macros
    if (isKetoFriendly) badges.push('keto');
    
    // Paleo: auto-detect from ingredients or use tag
    if (recipeDietTags.includes('paleo') || isPaleoFriendly) badges.push('paleo');
    
    // Mediterranean: auto-detect from ingredients or use tag
    if (recipeDietTags.includes('mediterranean') || isMediterraneanFriendly) badges.push('mediterranean');
    
    // Vegan, vegetarian, pescatarian: rely on tags
    ['vegan', 'vegetarian', 'pescatarian'].forEach(diet => {
      if (recipeDietTags.includes(diet) && !badges.includes(diet)) {
        badges.push(diet);
      }
    });
    
    return badges;
  }, [recipe, isKetoFriendly, isPaleoFriendly, isMediterraneanFriendly]);

  // Build health badges array using auto-detection
  const healthBadges = useMemo(() => {
    if (!recipe?.nutrition) return [];
    return getHealthBadges(recipe.nutrition);
  }, [recipe?.nutrition]);

  // Get cuisine badge from recipe data
  const cuisineBadge = useMemo(() => {
    if (!recipe?.cuisine) return null;
    return CUISINE_BADGES[recipe.cuisine.toLowerCase()] || null;
  }, [recipe?.cuisine]);

  // Format quantity for display (remove trailing zeros)
  const formatQuantity = (qty: number | null) => {
    if (qty === null) return '';
    const formatted = parseFloat(qty.toFixed(2));
    return formatted.toString();
  };

  const handleAddToPlan = () => {
    setShowAddToPlanModal(true);
  };

  const handleRemoveFromPlan = () => {
    if (!id) return;

    // Remove from pools
    for (const [slotId, pool] of Object.entries(recipePoolsBySlot)) {
      if ((pool ?? []).includes(id)) {
        removeFromPool(slotId, id);
      }
    }

    // Remove from exact assignments
    for (const [dayIndexStr, dayAssignments] of Object.entries(exactAssignments)) {
      for (const [slotId, assignment] of Object.entries(dayAssignments ?? {})) {
        if (assignment?.recipeId === id) {
          removeExactAssignment(Number(dayIndexStr), slotId);
        }
      }
    }

    // Clear from generated plan (and unlock any affected slots)
    if (generatedPlan) {
      const locksToClear: Array<{ dayIndex: number; slotId: string }> = [];
      let didChange = false;

      const newDays = generatedPlan.days.map((day) => {
        const dayLocks = lockedSlots[day.dayIndex] || [];
        const newSlots = day.slots.map((slot) => {
          if (slot.recipeId !== id) return slot;
          didChange = true;

          if (dayLocks.includes(slot.slotId)) {
            locksToClear.push({ dayIndex: day.dayIndex, slotId: slot.slotId });
          }

          return {
            ...slot,
            recipeId: '',
            servingMultiplier: 1,
            isLocked: false,
            slotTotals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
          };
        });

        return { ...day, slots: newSlots };
      });

      if (didChange) {
        setGeneratedPlan({
          ...generatedPlan,
          days: newDays,
        });
      }

      // Unlock after updating the plan (toggle-based API)
      for (const l of locksToClear) {
        toggleSlotLock(l.dayIndex, l.slotId);
      }
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
              title="Edit recipe"
            >
              <Pencil className="w-5 h-5" />
            </button>
          )}
          {!isAlreadyInPlan && (
            <button
              onClick={handleAddToPlan}
              disabled={!hasMealPlanSetup}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                hasMealPlanSetup
                  ? 'bg-card/90 backdrop-blur text-foreground hover:bg-card'
                  : 'bg-muted/60 text-muted-foreground cursor-not-allowed'
              }`}
              title={hasMealPlanSetup ? "Add to meal plan" : "Set up meal plan first"}
            >
              <CalendarPlus className="w-5 h-5" />
            </button>
          )}
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
            <TooltipProvider delayDuration={300}>
              <div className="flex flex-wrap gap-2">
                {/* Cuisine badge */}
                {cuisineBadge && (
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${cuisineBadge.bgClass} ${cuisineBadge.textClass}`}
                  >
                    {cuisineBadge.icon}
                    {cuisineBadge.label}
                  </span>
                )}
                {/* Diet badges with tooltips */}
                {dietBadges.map((diet) => {
                  const badge = DIET_BADGES[diet];
                  if (!badge) return null;
                  const tooltip = DIET_BADGE_TOOLTIPS[diet];
                  
                  if (tooltip) {
                    return (
                      <Tooltip key={diet}>
                        <TooltipTrigger asChild>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 cursor-help ${badge.bgClass} ${badge.textClass}`}
                          >
                            {badge.icon}
                            {badge.label}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">
                          {tooltip}
                        </TooltipContent>
                      </Tooltip>
                    );
                  }
                  
                  return (
                    <span
                      key={diet}
                      className={`px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${badge.bgClass} ${badge.textClass}`}
                    >
                      {badge.icon}
                      {badge.label}
                    </span>
                  );
                })}
                {/* Health consideration badges with tooltips */}
                {healthBadges.map((health) => {
                  const badge = DIET_BADGES[health];
                  if (!badge) return null;
                  const tooltip = HEALTH_BADGE_TOOLTIPS[health];
                  return (
                    <Tooltip key={health}>
                      <TooltipTrigger asChild>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 cursor-help ${badge.bgClass} ${badge.textClass}`}
                        >
                          {badge.icon}
                          {badge.label}
                        </span>
                      </TooltipTrigger>
                      {tooltip && (
                        <TooltipContent side="bottom" className="text-xs">
                          {tooltip}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  );
                })}
              </div>
            </TooltipProvider>
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
                {requestedServings !== null 
                  ? `${parseFloat(requestedServings.toFixed(1))} servings`
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

          {/* Nutrition - always per serving (never scaled) */}
          {perServingNutrition && (
            <div className="bg-muted rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Flame className="w-4 h-4 text-primary" />
                  Nutrition per serving
                </h3>
                {recipe.serving_size && (
                  <span className="text-xs text-muted-foreground bg-background px-2 py-1 rounded-md">
                    1 serving = {recipe.serving_size}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-6 gap-2">
                <div className="text-center">
                  <p className="text-lg font-bold text-primary">{perServingNutrition.calories}</p>
                  <p className="text-xs text-muted-foreground">kcal</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-protein">{perServingNutrition.protein_g}g</p>
                  <p className="text-xs text-muted-foreground">protein</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-fat">{perServingNutrition.fat_g}g</p>
                  <p className="text-xs text-muted-foreground">fat</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-carbs">{perServingNutrition.carbs_g}g</p>
                  <p className="text-xs text-muted-foreground">carbs</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-fiber">{perServingNutrition.fiber_g}g</p>
                  <p className="text-xs text-muted-foreground">fiber</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-sodium">{perServingNutrition.sodium_mg}mg</p>
                  <p className="text-xs text-muted-foreground">sodium</p>
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
              {/* Ingredients - adjusted for requested servings */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-3">
                  {t('recipes.ingredients')}
                  {requestedServings !== null && (
                    <span className="text-xs text-muted-foreground font-normal ml-2">
                      (for {parseFloat(requestedServings.toFixed(1))} servings)
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
                onClick={isAlreadyInPlan ? handleRemoveFromPlan : handleAddToPlan}
                disabled={!hasMealPlanSetup}
                className={`w-full h-12 ${hasMealPlanSetup && !isAlreadyInPlan ? 'gradient-primary' : ''}`}
                variant={!hasMealPlanSetup ? 'secondary' : isAlreadyInPlan ? 'destructive' : 'default'}
                size="lg"
              >
                {isAlreadyInPlan ? (
                  <Trash2 className="w-5 h-5 mr-2" />
                ) : (
                  <CalendarPlus className="w-5 h-5 mr-2" />
                )}
                {!hasMealPlanSetup
                  ? 'Set Up Plan First'
                  : isAlreadyInPlan
                    ? 'Remove from Plan'
                    : 'Add to Plan'}
              </Button>
            </>
          )}
        </motion.div>
      </div>

      {/* Add to Plan Modal */}
      {recipe && (
        <AddToPlanModal
          open={showAddToPlanModal}
          onOpenChange={setShowAddToPlanModal}
          recipeId={recipe.id}
          recipeName={recipe.title}
        />
      )}

      <BottomNav />
    </div>
  );
}
