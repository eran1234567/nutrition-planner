import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useMealPlanStore } from '@/stores/mealPlanStore';
import { useAuth } from './useAuth';
import { useUserData } from './useUserData';
import { startOfWeek, format } from 'date-fns';
import type { MealSlot, MealSlotId, GeneratedPlan, DailyTargets } from '@/types/mealPlan';
import { MEAL_SLOT_DEFINITIONS } from '@/types/mealPlan';
import { toast } from 'sonner';

// Map slot IDs to meal_type enum values
const slotToMealType = (slotId: MealSlotId): 'breakfast' | 'lunch' | 'dinner' | 'snack' => {
  if (slotId === 'breakfast') return 'breakfast';
  if (slotId === 'lunch') return 'lunch';
  if (slotId === 'dinner') return 'dinner';
  return 'snack';
};

// Map meal_type back to slot ID (for loading)
const mealTypeToSlotId = (mealType: string, index: number): MealSlotId => {
  if (mealType === 'breakfast') return 'breakfast';
  if (mealType === 'lunch') return 'lunch';
  if (mealType === 'dinner') return 'dinner';
  // For snacks, try to map based on index pattern
  return `snack-${index}` as MealSlotId;
};

export function useMealPlanSync() {
  const { user, isAuthenticated } = useAuth();
  const { profile } = useUserData();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);

  const {
    generatedPlan,
    dailyTargets,
    selectedMealSlots,
    numberOfDays,
    setGeneratedPlan,
    setDailyTargets,
    setSelectedMealSlots,
    setNumberOfDays,
  } = useMealPlanStore();

  // Load active meal plan from database
  const loadActivePlan = useCallback(async () => {
    if (!isAuthenticated || !profile?.id) return;

    // If we already have a generated plan in the store, don't overwrite it.
    // This prevents losing in-memory state when navigating between tabs.
    // The plan is already persisted to localStorage and synced to the database.
    if (generatedPlan) {
      // Just verify/set the activePlanId from the database for sync purposes
      try {
        const { data: mealPlan } = await supabase
          .from('meal_plans')
          .select('id')
          .eq('profile_id', profile.id)
          .eq('is_active', true)
          .maybeSingle();
        
        if (mealPlan) {
          setActivePlanId(mealPlan.id);
        }
      } catch (e) {
        console.error('Error checking active plan:', e);
      }
      return;
    }

    setIsLoading(true);
    try {
      // Get active meal plan
      const { data: mealPlan, error: planError } = await supabase
        .from('meal_plans')
        .select('*')
        .eq('profile_id', profile.id)
        .eq('is_active', true)
        .maybeSingle();

      if (planError) {
        console.error('Error loading meal plan:', planError);
        return;
      }

      if (!mealPlan) {
        // No active plan found
        setActivePlanId(null);
        return;
      }

      setActivePlanId(mealPlan.id);

      // Get meal plan days
      const { data: days, error: daysError } = await supabase
        .from('meal_plan_days')
        .select('*')
        .eq('meal_plan_id', mealPlan.id)
        .order('day_index', { ascending: true });

      if (daysError) {
        console.error('Error loading meal plan days:', daysError);
        return;
      }

      if (!days || days.length === 0) return;

      // Get all meals for all days
      const dayIds = days.map(d => d.id);
      const { data: meals, error: mealsError } = await supabase
        .from('meal_plan_meals')
        .select('*')
        .in('meal_plan_day_id', dayIds);

      if (mealsError) {
        console.error('Error loading meals:', mealsError);
        return;
      }

      // Reconstruct the generated plan
      const mealsByDay = new Map<string, typeof meals>();
      days.forEach(day => {
        mealsByDay.set(day.id, (meals || []).filter(m => m.meal_plan_day_id === day.id));
      });

      // Determine selected meal slots from the data
      const slotIdsSet = new Set<MealSlotId>();
      const snackCounts: Record<number, number> = {};
      
      (meals || []).forEach(meal => {
        const day = days.find(d => d.id === meal.meal_plan_day_id);
        if (!day) return;
        
        const dayIndex = day.day_index;
        snackCounts[dayIndex] = snackCounts[dayIndex] || 0;
        
        if (meal.meal_type === 'snack') {
          snackCounts[dayIndex]++;
          const snackSlotId = `snack-${snackCounts[dayIndex]}` as MealSlotId;
          slotIdsSet.add(snackSlotId);
        } else {
          slotIdsSet.add(meal.meal_type as MealSlotId);
        }
      });

      // Build selected meal slots
      const loadedSlots: MealSlot[] = Array.from(slotIdsSet).map(slotId => ({
        id: slotId,
        label: MEAL_SLOT_DEFINITIONS[slotId]?.label || slotId,
        percentOfDay: 0, // Will be calculated
        type: MEAL_SLOT_DEFINITIONS[slotId]?.type || 'dinner',
      }));

      // Build generated plan structure
      const generatedDays = days.map((day) => {
        const dayMeals = mealsByDay.get(day.id) || [];
        let snackIndex = 0;
        
        const slots = dayMeals.map(meal => {
          let slotId: MealSlotId;
          if (meal.meal_type === 'snack') {
            snackIndex++;
            slotId = `snack-${snackIndex}` as MealSlotId;
          } else {
            slotId = meal.meal_type as MealSlotId;
          }

          return {
            slotId,
            recipeId: meal.recipe_id,
            servingMultiplier: Number(meal.servings) || 1,
            isLocked: false,
            slotTotals: { calories: 0, protein: 0, carbs: 0, fat: 0 }, // Will be recalculated
          };
        });

        return {
          dayIndex: day.day_index,
          slots,
          dayTotals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
          deltaVsTarget: { calories: 0, protein: 0, carbs: 0, fat: 0 },
        };
      });

      const loadedPlan: GeneratedPlan = {
        days: generatedDays,
        createdAt: mealPlan.created_at || new Date().toISOString(),
      };

      // Update store
      setNumberOfDays(days.length);
      if (loadedSlots.length > 0) {
        setSelectedMealSlots(loadedSlots);
      }
      setGeneratedPlan(loadedPlan);

    } catch (error) {
      console.error('Error in loadActivePlan:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, profile?.id, generatedPlan, setGeneratedPlan, setSelectedMealSlots, setNumberOfDays]);

  // Save meal plan to database
  const savePlan = useCallback(async (plan: GeneratedPlan) => {
    if (!isAuthenticated || !profile?.id) {
      toast.error('Please sign in to save your meal plan');
      return null;
    }

    setIsSaving(true);
    try {
      const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

      // Deactivate any existing active plans
      await supabase
        .from('meal_plans')
        .update({ is_active: false })
        .eq('profile_id', profile.id)
        .eq('is_active', true);

      // Create new meal plan
      const { data: newPlan, error: planError } = await supabase
        .from('meal_plans')
        .insert({
          profile_id: profile.id,
          week_start: weekStart,
          is_active: true,
          name: `Week of ${format(new Date(weekStart), 'MMM d, yyyy')}`,
        })
        .select()
        .single();

      if (planError || !newPlan) {
        console.error('Error creating meal plan:', planError);
        toast.error('Failed to save meal plan');
        return null;
      }

      setActivePlanId(newPlan.id);

      // Create meal plan days
      const daysToInsert = plan.days.map((day, index) => ({
        meal_plan_id: newPlan.id,
        day_index: index,
        day_date: format(
          startOfWeek(new Date(), { weekStartsOn: 1 }),
          'yyyy-MM-dd'
        ).replace(/-\d\d$/, `-${String(new Date().getDate() + index).padStart(2, '0')}`),
      }));

      // Calculate actual dates properly
      const weekStartDate = startOfWeek(new Date(), { weekStartsOn: 1 });
      const daysWithDates = plan.days.map((day, index) => {
        const dayDate = new Date(weekStartDate);
        dayDate.setDate(dayDate.getDate() + index);
        return {
          meal_plan_id: newPlan.id,
          day_index: index,
          day_date: format(dayDate, 'yyyy-MM-dd'),
        };
      });

      const { data: insertedDays, error: daysError } = await supabase
        .from('meal_plan_days')
        .insert(daysWithDates)
        .select();

      if (daysError || !insertedDays) {
        console.error('Error creating meal plan days:', daysError);
        toast.error('Failed to save meal plan days');
        return null;
      }

      // Create meals for each day
      const mealsToInsert: Array<{
        meal_plan_day_id: string;
        recipe_id: string;
        meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
        servings: number;
      }> = [];

      plan.days.forEach((day, dayIndex) => {
        const dayRecord = insertedDays.find(d => d.day_index === dayIndex);
        if (!dayRecord) return;

        day.slots.forEach(slot => {
          mealsToInsert.push({
            meal_plan_day_id: dayRecord.id,
            recipe_id: slot.recipeId,
            meal_type: slotToMealType(slot.slotId),
            servings: slot.servingMultiplier,
          });
        });
      });

      if (mealsToInsert.length > 0) {
        const { error: mealsError } = await supabase
          .from('meal_plan_meals')
          .insert(mealsToInsert);

        if (mealsError) {
          console.error('Error creating meals:', mealsError);
          toast.error('Failed to save meals');
          return null;
        }
      }

      toast.success('Meal plan saved!');
      return newPlan.id;
    } catch (error) {
      console.error('Error saving meal plan:', error);
      toast.error('Failed to save meal plan');
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [isAuthenticated, profile?.id]);

  // Update existing plan (for multiplier changes, swaps, etc.)
  const updatePlan = useCallback(async (plan: GeneratedPlan) => {
    if (!activePlanId || !isAuthenticated) return false;

    try {
      // Get existing days
      const { data: existingDays } = await supabase
        .from('meal_plan_days')
        .select('id, day_index')
        .eq('meal_plan_id', activePlanId);

      if (!existingDays) return false;

      // Delete existing meals
      const dayIds = existingDays.map(d => d.id);
      await supabase
        .from('meal_plan_meals')
        .delete()
        .in('meal_plan_day_id', dayIds);

      // Re-insert meals with updated data
      const mealsToInsert: Array<{
        meal_plan_day_id: string;
        recipe_id: string;
        meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
        servings: number;
      }> = [];

      plan.days.forEach((day, dayIndex) => {
        const dayRecord = existingDays.find(d => d.day_index === dayIndex);
        if (!dayRecord) return;

        day.slots.forEach(slot => {
          mealsToInsert.push({
            meal_plan_day_id: dayRecord.id,
            recipe_id: slot.recipeId,
            meal_type: slotToMealType(slot.slotId),
            servings: slot.servingMultiplier,
          });
        });
      });

      if (mealsToInsert.length > 0) {
        const { error } = await supabase
          .from('meal_plan_meals')
          .insert(mealsToInsert);

        if (error) {
          console.error('Error updating meals:', error);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Error updating plan:', error);
      return false;
    }
  }, [activePlanId, isAuthenticated]);

  // Load plan on mount if authenticated
  useEffect(() => {
    if (isAuthenticated && profile?.id) {
      loadActivePlan();
    }
  }, [isAuthenticated, profile?.id, loadActivePlan]);

  return {
    isSaving,
    isLoading,
    activePlanId,
    savePlan,
    updatePlan,
    loadActivePlan,
  };
}
