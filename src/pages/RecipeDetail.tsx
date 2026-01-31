import { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Clock, Users, Flame, ChefHat, Plus, Loader2, Pencil, Leaf, Fish, Drumstick, Sun, CalendarPlus, Trash2, Heart, Droplets, Activity, Globe, Pizza, UtensilsCrossed, Soup, Cherry, PlayCircle, Zap, Sparkles, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { BottomNav } from '@/components/layout/BottomNav';
import { RecipeEditor } from '@/components/recipe/RecipeEditor';
import { AddToPlanModal } from '@/components/plan/AddToPlanModal';
import { VideoHero } from '@/components/recipe/VideoHero';
import { CookingMode } from '@/components/recipe/CookingMode';
import { KetoLogicTooltip } from '@/components/recipe/KetoLogicTooltip';
import { KetoSandbox } from '@/components/recipe/KetoSandbox';
import { KetoDiscoveryBanner } from '@/components/recipe/KetoDiscoveryBanner';
import { useRecipeById } from '@/hooks/useGlobalRecipes';
import { useMealPlanStore } from '@/stores/mealPlanStore';
import { useNeutronStore } from '@/stores/neutronStore';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import type { Recipe } from '@/types';
import { MEAL_SLOT_DEFINITIONS } from '@/types/mealPlan';
import { 
  processNutrition, 
  getNeutronBadges, 
  KETO_BADGE_MAX_NET_CARBS,
  KETO_BADGE_MIN_FAT_PERCENT,
  groupAndOrderIngredients,
  type RawNutritionData 
} from '@/lib/neutron';
import { generateServingLabel, isGenericServingSize } from '@/lib/servingLabel';

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

// Diet badge tooltip definitions (Neutron-aware)
const DIET_BADGE_TOOLTIPS: Record<string, string> = {
  keto: `≤ ${KETO_BADGE_MAX_NET_CARBS}g net carbs, ≥ ${KETO_BADGE_MIN_FAT_PERCENT}% fat`,
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

// Diet exclusions for auto-detection (fallback for non-Neutron diets)
const dietExclusions: Record<string, string[]> = {
  paleo: ['bread', 'pasta', 'rice', 'noodle', 'grain', 'wheat', 'oat', 'corn', 'quinoa', 'barley', 'cereal', 'granola', 'tortilla', 'bean', 'lentil', 'chickpea', 'hummus', 'peanut', 'soy', 'tofu', 'tempeh', 'edamame', 'dairy', 'milk', 'cheese', 'yogurt', 'butter', 'cream', 'sugar', 'candy', 'cake', 'cookie', 'donut', 'pastry'],
  mediterranean: ['beef', 'steak', 'pork', 'bacon', 'ham', 'sausage', 'hot dog', 'salami', 'processed meat', 'butter', 'margarine', 'sugar', 'candy', 'cake', 'cookie', 'donut', 'soda', 'fried', 'deep fried'],
};

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
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [showCookingMode, setShowCookingMode] = useState(false);
  const [isSavingToMyRecipes, setIsSavingToMyRecipes] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');

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
  // Also compute where it appears for the confirmation dialog
  const planPresence = useMemo(() => {
    if (!id) return { isInPlan: false, inPools: [] as string[], inExact: [] as string[], inGenerated: [] as string[] };
    
    const inPools: string[] = [];
    const inExact: string[] = [];
    const inGenerated: string[] = [];
    
    // Check generated plan
    if (generatedPlan?.days) {
      for (const day of generatedPlan.days) {
        for (const slot of day.slots) {
          if (slot.recipeId === id) {
            const slotDef = MEAL_SLOT_DEFINITIONS[slot.slotId as keyof typeof MEAL_SLOT_DEFINITIONS];
            inGenerated.push(`Day ${day.dayIndex + 1} ${slotDef?.label || slot.slotId}`);
          }
        }
      }
    }
    
    // Check recipe pools
    for (const slotId in recipePoolsBySlot) {
      if (recipePoolsBySlot[slotId]?.includes(id)) {
        const slotDef = MEAL_SLOT_DEFINITIONS[slotId as keyof typeof MEAL_SLOT_DEFINITIONS];
        inPools.push(slotDef?.label || slotId);
      }
    }
    
    // Check exact assignments
    for (const dayIndex in exactAssignments) {
      const dayAssignments = exactAssignments[Number(dayIndex)];
      for (const slotId in dayAssignments) {
        if (dayAssignments[slotId]?.recipeId === id) {
          const slotDef = MEAL_SLOT_DEFINITIONS[slotId as keyof typeof MEAL_SLOT_DEFINITIONS];
          inExact.push(`Day ${Number(dayIndex) + 1} ${slotDef?.label || slotId}`);
        }
      }
    }
    
    const isInPlan = inGenerated.length > 0 || inPools.length > 0 || inExact.length > 0;
    return { isInPlan, inPools, inExact, inGenerated };
  }, [generatedPlan, recipePoolsBySlot, exactAssignments, id]);

  const isAlreadyInPlan = planPresence.isInPlan;

  // Get Neutron mode for display
  const neutronMode = useNeutronStore((s) => s.mode);
  const isKetoMode = neutronMode === 'keto';

  // Process nutrition through Neutron Engine
  const neutronNutrition = useMemo(() => {
    if (!recipe?.nutrition) return null;
    return processNutrition(recipe.nutrition as RawNutritionData, neutronMode);
  }, [recipe?.nutrition, neutronMode]);

  // Get Neutron badges for this recipe
  const neutronBadges = useMemo(() => {
    if (!recipe) return null;
    return getNeutronBadges(
      recipe.nutrition as RawNutritionData,
      recipe.ingredients,
      recipe.tags
    );
  }, [recipe]);

  // Nutrition is ALWAYS per serving - never scaled
  // The nutrition values in the database represent what you get from one serving
  const perServingNutrition = useMemo(() => {
    if (!neutronNutrition) return null;
    return {
      calories: Math.round(neutronNutrition.calories),
      protein_g: Math.round(neutronNutrition.protein),
      carbs_g: Math.round(neutronNutrition.totalCarbs),
      displayCarbs_g: Math.round(neutronNutrition.displayCarbs),
      fat_g: Math.round(neutronNutrition.fat),
      fiber_g: Math.round(neutronNutrition.fiber),
      sodium_mg: Math.round(neutronNutrition.sodium),
      sugar_g: Math.round(neutronNutrition.sugar),
      saturated_fat_g: Math.round(neutronNutrition.saturatedFat),
      cholesterol_mg: Math.round(neutronNutrition.cholesterol),
      net_carbs_g: Math.round(neutronNutrition.netCarbs),
      // Macro percentages
      fatPercent: neutronNutrition.fatPercent,
      proteinPercent: neutronNutrition.proteinPercent,
      carbPercent: neutronNutrition.carbPercent,
      carbLabel: neutronNutrition.carbLabel,
    };
  }, [neutronNutrition]);

  // Calculate adjusted ingredients based on serving multiplier
  const adjustedIngredients = useMemo(() => {
    if (!recipe?.ingredients) return [];
    return recipe.ingredients.map(ing => ({
      ...ing,
      quantity: ing.quantity ? parseFloat((ing.quantity * servingMultiplier).toFixed(2)) : null,
      section: (ing as any).section || 'Main', // Default to 'Main' if no section provided
    }));
  }, [recipe?.ingredients, servingMultiplier]);

  // Group ingredients by section using shared Neutron utility
  const { sections: ingredientsBySection, sectionOrder } = useMemo(
    () => groupAndOrderIngredients(adjustedIngredients),
    [adjustedIngredients]
  );

  // Build diet badges array using Neutron Engine for keto + fallbacks for other diets
  const dietBadges = useMemo(() => {
    if (!recipe) return [];
    
    const badges: string[] = [];
    const recipeDietTags = (recipe.tags || [])
      .filter((t: { tag_type: string; tag_value: string }) => t.tag_type === 'diet')
      .map((t: { tag_type: string; tag_value: string }) => t.tag_value.toLowerCase());
    
    // Keto: use Neutron Engine detection (single source of truth)
    if (neutronBadges?.isKeto) {
      badges.push('keto');
    }
    
    // Paleo: auto-detect from ingredients or use tag
    const isPaleoFriendly = recipe.ingredients?.length > 0 && !recipe.ingredients.some(ing => {
      const ingName = (ing.normalized_name || ing.name || '').toLowerCase();
      return dietExclusions.paleo.some(excluded => ingName.includes(excluded));
    });
    if (recipeDietTags.includes('paleo') || isPaleoFriendly) badges.push('paleo');
    
    // Mediterranean: auto-detect from ingredients or use tag
    // BUT skip if cuisine is already Mediterranean (to avoid duplicate badge)
    const cuisineIsMediterranean = recipe.cuisine?.toLowerCase() === 'mediterranean';
    const isMediterraneanFriendly = recipe.ingredients?.length > 0 && !recipe.ingredients.some(ing => {
      const ingName = (ing.normalized_name || ing.name || '').toLowerCase();
      return dietExclusions.mediterranean.some(excluded => ingName.includes(excluded));
    });
    if (!cuisineIsMediterranean && (recipeDietTags.includes('mediterranean') || isMediterraneanFriendly)) {
      badges.push('mediterranean');
    }
    
    // Vegan, vegetarian, pescatarian: rely on tags
    ['vegan', 'vegetarian', 'pescatarian'].forEach(diet => {
      if (recipeDietTags.includes(diet) && !badges.includes(diet)) {
        badges.push(diet);
      }
    });
    
    return badges;
  }, [recipe, neutronBadges]);

  // Build health badges array using Neutron Engine
  const healthBadges = useMemo(() => {
    return neutronBadges?.healthBadges ?? [];
  }, [neutronBadges]);

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

  // Format ingredient display with quantity and unit
  // Handles compound units like "6 oz fillets" -> "4 fillets (6 oz each)"
  const formatIngredient = (qty: number | null, unit: string | null, name: string) => {
    if (qty === null && !unit) return name;
    
    const formattedQty = formatQuantity(qty);
    const unitStr = unit || '';
    
    // Check for compound units like "6 oz fillets" or "12 oz can"
    const compoundUnitMatch = unitStr.match(/^(\d+\s*(?:oz|g|lb|ml|fl oz))\s+(.+)$/i);
    
    if (compoundUnitMatch && qty !== null) {
      const [, size, baseUnit] = compoundUnitMatch;
      return `${formattedQty} ${baseUnit} (${size} each)`;
    }
    
    // Standard format: "2 cups milk"
    const parts: string[] = [];
    if (formattedQty) parts.push(formattedQty);
    if (unitStr) parts.push(unitStr);
    
    return parts.length > 0 ? `${parts.join(' ')} ${name}` : name;
  };

  const handleAddToPlan = () => {
    setShowAddToPlanModal(true);
  };

  const handleRemoveClick = () => {
    setShowRemoveConfirm(true);
  };

  // Save global recipe to user's collection
  const handleSaveToMyRecipes = async () => {
    if (!recipe || !user) {
      toast.error('Please sign in to save recipes');
      return;
    }

    setIsSavingToMyRecipes(true);
    try {
      // 1. Insert the recipe copy with user as owner
      const { data: newRecipe, error: recipeError } = await supabase
        .from('recipes')
        .insert({
          title: recipe.title,
          description: recipe.description,
          image_url: recipe.image_url,
          prep_time: recipe.prep_time,
          cook_time: recipe.cook_time,
          total_time: recipe.total_time,
          servings: recipe.servings,
          serving_size: recipe.serving_size,
          difficulty: recipe.difficulty,
          cuisine: recipe.cuisine,
          source_url: recipe.source_url,
          notes: recipe.notes,
          is_kid_friendly: recipe.is_kid_friendly,
          is_meal_prep_friendly: recipe.is_meal_prep_friendly,
          is_budget_friendly: recipe.is_budget_friendly,
          owner_user_id: user.id,
          scope: 'private',
        })
        .select('id')
        .single();

      if (recipeError || !newRecipe) {
        throw recipeError || new Error('Failed to create recipe');
      }

      // 2. Copy ingredients
      if (recipe.ingredients && recipe.ingredients.length > 0) {
        const ingredientsCopy = recipe.ingredients.map((ing, idx) => ({
          recipe_id: newRecipe.id,
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit,
          normalized_name: ing.normalized_name,
          aisle: ing.aisle,
          section: (ing as any).section,
          order_index: ing.order_index ?? idx,
        }));
        
        const { error: ingredientsError } = await supabase
          .from('recipe_ingredients')
          .insert(ingredientsCopy);
        
        if (ingredientsError) {
          console.error('Error copying ingredients:', ingredientsError);
        }
      }

      // 3. Copy steps
      if (recipe.steps && recipe.steps.length > 0) {
        const stepsCopy = recipe.steps.map((step) => ({
          recipe_id: newRecipe.id,
          step_number: step.step_number,
          instruction: step.instruction,
          introduces_section: step.introduces_section,
        }));
        
        const { error: stepsError } = await supabase
          .from('recipe_steps')
          .insert(stepsCopy);
        
        if (stepsError) {
          console.error('Error copying steps:', stepsError);
        }
      }

      // 4. Copy nutrition
      if (recipe.nutrition) {
        const { error: nutritionError } = await supabase
          .from('recipe_nutrition')
          .insert({
            recipe_id: newRecipe.id,
            calories: recipe.nutrition.calories,
            protein_g: recipe.nutrition.protein_g,
            carbs_g: recipe.nutrition.carbs_g,
            fat_g: recipe.nutrition.fat_g,
            fiber_g: recipe.nutrition.fiber_g,
            sugar_g: recipe.nutrition.sugar_g,
            sodium_mg: recipe.nutrition.sodium_mg,
            saturated_fat_g: recipe.nutrition.saturated_fat_g,
            cholesterol_mg: recipe.nutrition.cholesterol_mg,
          });
        
        if (nutritionError) {
          console.error('Error copying nutrition:', nutritionError);
        }
      }

      // 5. Copy tags
      if (recipe.tags && recipe.tags.length > 0) {
        const tagsCopy = recipe.tags.map((tag) => ({
          recipe_id: newRecipe.id,
          tag_type: tag.tag_type,
          tag_value: tag.tag_value,
        }));
        
        const { error: tagsError } = await supabase
          .from('recipe_tags')
          .insert(tagsCopy);
        
        if (tagsError) {
          console.error('Error copying tags:', tagsError);
        }
      }

      toast.success('Recipe saved to My Recipes!', {
        description: 'Opening with Keto Sandbox...',
        icon: <Sparkles className="w-4 h-4 text-success" />,
      });

      // Navigate to the new recipe
      navigate(`/recipe/${newRecipe.id}`);

    } catch (error) {
      console.error('Error saving recipe:', error);
      toast.error('Failed to save recipe');
    } finally {
      setIsSavingToMyRecipes(false);
    }
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

    // Close the confirmation dialog
    setShowRemoveConfirm(false);
  };

  const confirmRemove = () => {
    handleRemoveFromPlan();
  };

  const handleSaveEdit = (updatedRecipe: Recipe) => {
    // Update local cache immediately for fast UI feedback
    queryClient.setQueryData(['recipe', id], updatedRecipe);
    // Also invalidate to ensure fresh data on next fetch
    queryClient.invalidateQueries({ queryKey: ['recipe', id] });
    queryClient.invalidateQueries({ queryKey: ['global-recipes'] });
    queryClient.invalidateQueries({ queryKey: ['user-recipes'] });
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
      {/* Cooking Mode Overlay */}
      <AnimatePresence>
        {showCookingMode && recipe && (
          <CookingMode
            title={recipe.title}
            sourceUrl={recipe.source_url || null}
            ingredients={adjustedIngredients}
            steps={recipe.steps || []}
            servingMultiplier={servingMultiplier}
            onClose={() => setShowCookingMode(false)}
          />
        )}
      </AnimatePresence>

      {/* Video/Image Hero */}
      <div className="relative">
        <VideoHero
          sourceUrl={recipe.source_url || null}
          imageUrl={recipe.image_url || null}
          title={recipe.title}
          isUserRecipe={isUserRecipe}
        />
        
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 w-10 h-10 rounded-full bg-card/90 backdrop-blur flex items-center justify-center z-10"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Edit and Add buttons */}
        <div className="absolute top-4 right-4 flex gap-2 z-10">
          {isUserRecipe && !isEditing && (
            <button
              onClick={() => {
                setEditTitle(recipe.title || '');
                setEditDescription(recipe.description || '');
                setIsEditing(true);
              }}
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
            {isEditing ? (
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="text-2xl font-bold text-foreground mb-2 w-full bg-transparent border-b-2 border-primary focus:outline-none"
                placeholder={t('recipes.titlePlaceholder', 'Enter recipe name...')}
              />
            ) : (
              <h1 className="text-2xl font-bold text-foreground mb-2">{recipe.title}</h1>
            )}
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
                  
                  // Keto badge: ALWAYS show KetoLogicTooltip for detailed analysis
                  // (The NeutronSuggestionCard optimizer tips are still gated by isKetoMode)
                  if (diet === 'keto') {
                    return (
                      <KetoLogicTooltip 
                        key={diet} 
                        nutrition={recipe.nutrition as RawNutritionData}
                        showScore
                        showOptimizer={isKetoMode} // Only show optimizer tips in Keto Mode
                      >
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 cursor-help ${badge.bgClass} ${badge.textClass}`}
                        >
                          {badge.icon}
                          {badge.label}
                          {/* Keto Score inline */}
                          {neutronBadges?.ketoScore && (
                            <span className="ml-1 bg-white/20 px-1.5 py-0.5 rounded text-2xs font-bold">
                              {neutronBadges.ketoScore.score}
                            </span>
                          )}
                        </span>
                      </KetoLogicTooltip>
                    );
                  }
                  
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
                {(() => {
                  // Use dynamic label if serving_size is generic or missing
                  const displayLabel = isGenericServingSize(recipe.serving_size)
                    ? generateServingLabel(recipe)
                    : `1 serving = ${recipe.serving_size}`;
                  return (
                    <span className="text-xs text-muted-foreground bg-background px-2 py-1 rounded-md">
                      {displayLabel}
                    </span>
                  );
                })()}
              </div>
              
              {/* Primary macros - always visible */}
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="text-center bg-background rounded-lg p-2">
                  <p className="text-xl font-bold text-primary">{perServingNutrition.calories}</p>
                  <p className="text-xs text-muted-foreground">Kcal</p>
                </div>
                <div className="text-center bg-background rounded-lg p-2">
                  <p className="text-xl font-bold text-protein">{perServingNutrition.protein_g}g</p>
                  <p className="text-xs text-muted-foreground">Protein</p>
                </div>
                <div className="text-center bg-background rounded-lg p-2">
                  <p className="text-xl font-bold text-fat">{perServingNutrition.fat_g}g</p>
                  <p className="text-xs text-muted-foreground">Fat</p>
                </div>
                <div className="text-center bg-background rounded-lg p-2">
                  <p className="text-xl font-bold text-carbs">{perServingNutrition.displayCarbs_g}g</p>
                  <p className="text-xs text-muted-foreground">{isKetoMode ? 'Net Carbs' : 'Carbs'}</p>
                </div>
              </div>
              
              {/* Detailed nutrition breakdown */}
              <div className="border-t border-border pt-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">Detailed Breakdown</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex justify-between text-sm px-2 py-1 bg-background rounded">
                    <span className="text-muted-foreground">Net Carbs</span>
                    <span className="font-medium text-carbs">{perServingNutrition.net_carbs_g}g</span>
                  </div>
                  <div className="flex justify-between text-sm px-2 py-1 bg-background rounded">
                    <span className="text-muted-foreground">Fiber</span>
                    <span className="font-medium">{perServingNutrition.fiber_g}g</span>
                  </div>
                  <div className="flex justify-between text-sm px-2 py-1 bg-background rounded">
                    <span className="text-muted-foreground">Sugar</span>
                    <span className="font-medium">{perServingNutrition.sugar_g}g</span>
                  </div>
                  <div className="flex justify-between text-sm px-2 py-1 bg-background rounded">
                    <span className="text-muted-foreground">Sat. Fat</span>
                    <span className="font-medium">{perServingNutrition.saturated_fat_g}g</span>
                  </div>
                  <div className="flex justify-between text-sm px-2 py-1 bg-background rounded">
                    <span className="text-muted-foreground">Cholesterol</span>
                    <span className="font-medium">{perServingNutrition.cholesterol_mg}mg</span>
                  </div>
                  <div className="flex justify-between text-sm px-2 py-1 bg-background rounded">
                    <span className="text-muted-foreground">Sodium</span>
                    <span className="font-medium">{perServingNutrition.sodium_mg}mg</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Keto Sandbox - show in Keto Mode for user-owned recipes (includes success state at 100) */}
          {isKetoMode && recipe?.ingredients && neutronBadges?.ketoScore && isUserRecipe && (
            <KetoSandbox
              recipeId={recipe.id}
              nutrition={recipe.nutrition as any}
              ingredients={recipe.ingredients.map(ing => ({
                id: ing.id,
                name: ing.name,
                quantity: ing.quantity,
                unit: ing.unit,
                normalized_name: ing.normalized_name,
                order_index: ing.order_index,
              }))}
              steps={recipe.steps?.map(step => ({
                id: step.id,
                instruction: step.instruction,
                step_number: step.step_number,
              })) || []}
              servings={recipe.servings || 1}
              onCommit={() => {
                // Refresh the recipe data
                queryClient.invalidateQueries({ queryKey: ['recipe', recipe.id] });
              }}
            />
          )}

          {/* Keto Mode Info for global recipes - show when Keto Mode is active but recipe is not owned */}
          {isKetoMode && neutronBadges?.isKeto && !isUserRecipe && (
            <div className="mb-6 p-4 rounded-xl bg-success/10 border border-success/30">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-success">
                      Keto Mode Active
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Save this recipe to unlock the Keto Sandbox optimizer.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleSaveToMyRecipes}
                  disabled={isSavingToMyRecipes || !user}
                  className="bg-success hover:bg-success/90 text-white font-semibold shadow-md"
                  size="sm"
                >
                  {isSavingToMyRecipes ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Save to My Recipes
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Keto Discovery Tip - Actionable Context Switcher */}
          {/* Show for any keto-badged recipe when Keto Mode is not active */}
          {!isKetoMode && neutronBadges?.isKeto && neutronBadges.ketoScore && neutronBadges.ketoScore.score < 100 && (
            <KetoDiscoveryBanner 
              ketoScore={neutronBadges.ketoScore.score}
            />
          )}

          {/* Start Cooking Button */}
          {recipe.steps && recipe.steps.length > 0 && (
            <Button
              onClick={() => setShowCookingMode(true)}
              className="w-full h-14 mb-6 text-lg font-semibold gradient-primary"
              size="lg"
            >
              <PlayCircle className="w-6 h-6 mr-2" />
              Start Cooking
            </Button>
          )}


          {/* Description */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-2">{t('recipes.description')}</h3>
            {isEditing ? (
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full text-muted-foreground bg-transparent border border-border rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-ring min-h-[80px] resize-y"
                placeholder={t('recipes.descriptionPlaceholder', 'Add a description...')}
              />
            ) : recipe.description ? (
              <p className="text-muted-foreground">{recipe.description}</p>
            ) : (
              <p className="text-muted-foreground/50 italic">{t('recipes.noDescription', 'No description')}</p>
            )}
          </div>

          {/* Editable content or read-only */}
          {isEditing && recipe ? (
            <RecipeEditor
              recipe={recipe as Recipe}
              title={editTitle}
              description={editDescription}
              onTitleChange={setEditTitle}
              onDescriptionChange={setEditDescription}
              onSave={handleSaveEdit}
              onCancel={() => setIsEditing(false)}
            />
          ) : (
            <>
              {/* Ingredients - adjusted for requested servings, grouped by section */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-3">
                  {t('recipes.ingredients')}
                  {requestedServings !== null && (
                    <span className="text-xs text-muted-foreground font-normal ml-2">
                      (for {parseFloat(requestedServings.toFixed(1))} servings)
                    </span>
                  )}
                </h3>
                
                {sectionOrder.map((section) => {
                  const sectionIngredients = ingredientsBySection[section];
                  const showSectionHeader = sectionOrder.length > 1 || section !== 'Main';
                  
                  return (
                    <div key={section} className="mb-4 last:mb-0">
                      {showSectionHeader && (
                        <h4 className="text-xs font-medium text-primary uppercase tracking-wide mb-2 mt-3 first:mt-0">
                          {section}
                        </h4>
                      )}
                      <ul className="space-y-2">
                        {sectionIngredients.map((ing, index) => (
                          <li key={index} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                            <div className="w-2 h-2 rounded-full bg-primary" />
                            <span className="flex-1 text-foreground">
                              {formatIngredient(ing.quantity, ing.unit, ing.name)}
                            </span>
                            {ing.aisle && (
                              <span className="text-xs text-muted-foreground">{ing.aisle}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>

              {/* Steps with contextual ingredient sections */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-3">{t('recipes.instructions')}</h3>

                <ol className="space-y-4">
                  {(() => {
                    const mainSectionKey =
                      ingredientsBySection['Main']?.length
                        ? 'Main'
                        : ingredientsBySection['Base']?.length
                          ? 'Base'
                          : null;

                    const renderedSections = new Set<string>();

                    // If the recipe explicitly says when Main/Base is introduced, respect that.
                    // Otherwise (legacy imports), fall back to showing Main/Base at Step 1.
                    const mainIntroStepNum = mainSectionKey
                      ? (recipe.steps ?? []).find(
                          (s) => ((s as any).introduces_section as string | null | undefined) === mainSectionKey
                        )?.step_number ?? null
                      : null;
                    const shouldRenderMainAtTopFallback = !!mainSectionKey && mainIntroStepNum === null;

                    return recipe.steps?.map((step) => {
                      const introducesSection = (step as any).introduces_section as string | null | undefined;
                      const stepNum = step.step_number;

                      const sectionsToRender: string[] = [];

                      // Show the section exactly where it is introduced.
                      if (introducesSection) sectionsToRender.push(introducesSection);

                      // Legacy fallback: if Main/Base was never explicitly introduced,
                      // show it at the top (but after any Step-1 prep section like Marinade).
                      if (
                        shouldRenderMainAtTopFallback &&
                        stepNum === 1 &&
                        mainSectionKey &&
                        introducesSection !== mainSectionKey
                      ) {
                        sectionsToRender.push(mainSectionKey);
                      }

                      return (
                        <li key={step.step_number}>
                          {sectionsToRender
                            .filter((section) => !!section && !renderedSections.has(section))
                            .map((section) => {
                              renderedSections.add(section);
                              const sectionIngredients = ingredientsBySection[section];
                              if (!sectionIngredients || sectionIngredients.length === 0) return null;

                              const isMain = section === mainSectionKey;

                              return (
                                <div key={section} className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                                  <h4 className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">
                                    {isMain ? 'Gather These Ingredients' : `For the ${section}`}
                                  </h4>
                                  <div className="flex flex-wrap gap-2">
                                    {sectionIngredients.map((ing, i) => (
                                      <span key={i} className="text-xs px-2 py-1 bg-background rounded-full border">
                                        {ing.quantity && `${formatQuantity(ing.quantity)} `}
                                        {ing.unit && `${ing.unit} `}
                                        {ing.name}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}

                          {/* Step instruction */}
                          <div className="flex gap-4">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                              {step.step_number}
                            </div>
                            <p className="text-foreground pt-1" dangerouslySetInnerHTML={{ __html: step.instruction }} />
                          </div>
                        </li>
                      );
                    });
                  })()}
                </ol>
              </div>

              {/* Add to plan button */}
              <Button
                onClick={isAlreadyInPlan ? handleRemoveClick : handleAddToPlan}
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

      {/* Remove Confirmation Dialog */}
      <AlertDialog open={showRemoveConfirm} onOpenChange={setShowRemoveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from Meal Plan?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  This will remove <span className="font-semibold">{recipe?.title}</span> from your meal plan.
                </p>
                <div className="space-y-2 text-sm">
                  {planPresence.inGenerated.length > 0 && (
                    <div className="flex items-start gap-2">
                      <span className="font-medium text-foreground">Generated Plan:</span>
                      <span>{planPresence.inGenerated.join(', ')}</span>
                    </div>
                  )}
                  {planPresence.inPools.length > 0 && (
                    <div className="flex items-start gap-2">
                      <span className="font-medium text-foreground">Recipe Pools:</span>
                      <span>{planPresence.inPools.join(', ')}</span>
                    </div>
                  )}
                  {planPresence.inExact.length > 0 && (
                    <div className="flex items-start gap-2">
                      <span className="font-medium text-foreground">Exact Assignments:</span>
                      <span>{planPresence.inExact.join(', ')}</span>
                    </div>
                  )}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BottomNav />
    </div>
  );
}
