import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, ShoppingCart, RefreshCw, Settings, Sparkles, AlertTriangle, Cloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/PageHeader';
import { BottomNav } from '@/components/layout/BottomNav';
import { StickyActions } from '@/components/ui/StickyActions';
import { NutritionGoalsModal } from '@/components/plan/NutritionGoalsModal';
import { NutritionSummaryCard } from '@/components/plan/NutritionSummaryCard';
import { PlanSlotCard } from '@/components/plan/PlanSlotCard';
import { MacroGapIndicator } from '@/components/plan/MacroGapIndicator';
import { Skeleton } from '@/components/ui/skeleton';
import { useMealPlanStore, type MacroGapContext } from '@/stores/mealPlanStore';
import { useUserData } from '@/hooks/useUserData';
import { useGlobalRecipes } from '@/hooks/useGlobalRecipes';
import { useMealPlanSync } from '@/hooks/useMealPlanSync';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { format, addDays, startOfWeek } from 'date-fns';
import { generateMealPlan, validatePlanInputs } from '@/lib/mealPlanGenerator/index';
import type { GeneratedSlot, GeneratedDay, MealSlotId, MealSlot } from '@/types/mealPlan';
import { MEAL_SLOT_DEFINITIONS, getDefaultPercentsForSlots } from '@/types/mealPlan';
import { toast } from 'sonner';
import type { GlobalRecipe } from '@/hooks/useGlobalRecipes';

export default function Plan() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { preferences, loading: preferencesLoading, refetch: refetchPreferences } = useUserData();
  const { data: allRecipes = [] } = useGlobalRecipes();
  const { isSaving, isLoading: isSyncLoading, activePlanId, savePlan, updatePlan } = useMealPlanSync();
  
  const {
    dailyTargets,
    selectedMealSlots,
    numberOfDays,
    recipePoolsBySlot,
    exactAssignments,
    generatedPlan,
    lockedSlots,
    isPlanMode,
    macroCalculatorInputs,
    setDailyTargets,
    setSelectedMealSlots,
    setNumberOfDays,
    setGeneratedPlan,
    updateSlotMultiplier,
    toggleSlotLock,
    setIsPlanMode,
    setCurrentSlotFilter,
    setMacroGapContext,
    setSwapContext,
  } = useMealPlanStore();
  
  const [selectedDay, setSelectedDay] = useState(0);
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [hasShownInitialModal, setHasShownInitialModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const hasSavedPlanRef = useRef(false);
  const hasHydratedFromPrefsRef = useRef(false);

  // Diet type is stored in the macro calculator inputs. The generator needs it to
  // enforce keto carb caps and prefer fat add-ons instead of scaling servings.
  const effectivePlanDietType = useMemo(() => {
    return macroCalculatorInputs?.dietType === 'keto' ? 'keto' : 'default';
  }, [macroCalculatorInputs?.dietType]);

  // Hydrate store from database preferences if store is empty but DB has data
  // This handles the case when user returns to the Plan tab after setting goals
  useEffect(() => {
    if (preferencesLoading || hasHydratedFromPrefsRef.current) return;
    
    // If store has no targets but preferences has them, hydrate the store
    if (!dailyTargets && preferences?.calorie_target) {
      hasHydratedFromPrefsRef.current = true;
      
      setDailyTargets({
        calories: preferences.calorie_target,
        protein: preferences.protein_target ?? 0,
        carbs: preferences.carbs_target ?? 0,
        fat: preferences.fat_target ?? 0,
      });
      
      // Also hydrate meal slots if we have meals_per_day info
      if (preferences.meals_per_day && selectedMealSlots.length === 0) {
        const mealsPerDay = preferences.meals_per_day;
        
        let slotIds: MealSlotId[];
        if (mealsPerDay <= 3) {
          slotIds = (['breakfast', 'lunch', 'dinner'] as MealSlotId[]).slice(0, mealsPerDay);
        } else {
          const base: MealSlotId[] = ['breakfast', 'lunch', 'dinner'];
          const snacks: MealSlotId[] = (['snack-1', 'snack-2', 'snack-3'] as MealSlotId[]).slice(0, mealsPerDay - 3);
          slotIds = [...base, ...snacks];
        }
        
        const percents = getDefaultPercentsForSlots(slotIds);
        const slots: MealSlot[] = slotIds.map(id => ({
          id,
          label: MEAL_SLOT_DEFINITIONS[id].label,
          percentOfDay: percents[id] || 0,
          type: MEAL_SLOT_DEFINITIONS[id].type,
        }));
        
        setSelectedMealSlots(slots);
      }
      
      // Hydrate plan duration
      if (preferences.plan_duration) {
        setNumberOfDays(preferences.plan_duration);
      }
    } else if (dailyTargets) {
      // Store already has data, mark as hydrated
      hasHydratedFromPrefsRef.current = true;
    }
  }, [preferencesLoading, preferences, dailyTargets, selectedMealSlots.length, setDailyTargets, setSelectedMealSlots, setNumberOfDays]);

  // Show nutrition goals modal on first visit if no goals are set
  useEffect(() => {
    if (preferencesLoading || hasShownInitialModal) return;
    
    const hasNutritionGoals = preferences?.calorie_target || dailyTargets?.calories || selectedMealSlots.length > 0;
    if (!hasNutritionGoals) {
      setShowGoalsModal(true);
      setHasShownInitialModal(true);
    }
  }, [preferences, preferencesLoading, hasShownInitialModal, selectedMealSlots.length, dailyTargets]);

  // Build recipe map for quick lookup
  const recipeMap = useMemo(() => {
    const map = new Map<string, GlobalRecipe>();
    allRecipes.forEach(r => map.set(r.id, r));
    return map;
  }, [allRecipes]);

  // Validate plan inputs
  // Validate plan inputs
  const validation = useMemo(() => {
    if (!dailyTargets || selectedMealSlots.length === 0) {
      return { isValid: false, errors: ['Set up your nutrition goals first'], missingSlots: [] as string[] };
    }
    return validatePlanInputs({
      dailyTargets,
      selectedMealSlots: selectedMealSlots.map(s => ({ id: s.id, label: s.label })),
      recipePoolsBySlot,
      exactAssignments,
      recipes: allRecipes,
      numberOfDays,
    });
  }, [dailyTargets, selectedMealSlots, recipePoolsBySlot, exactAssignments, allRecipes, numberOfDays]);

  // Generate plan
  const handleGeneratePlan = useCallback(async () => {
    if (!dailyTargets || !validation.isValid) return;

    setIsGenerating(true);
    hasSavedPlanRef.current = false;
    
    // Small delay for UX
    setTimeout(async () => {
      try {
        const plan = generateMealPlan({
          dailyTargets,
          selectedMealSlots,
          recipePoolsBySlot,
          exactAssignments,
          recipes: allRecipes,
          numberOfDays,
          lockedSlots,
          existingPlan: generatedPlan,
          dietType: effectivePlanDietType,
        });
        
        setGeneratedPlan(plan);
        setIsPlanMode(false);
        
        // Auto-save to database if authenticated
        if (isAuthenticated && !hasSavedPlanRef.current) {
          hasSavedPlanRef.current = true;
          await savePlan(plan);
        } else {
          toast.success('Meal plan generated!');
        }
      } catch (error) {
        if (import.meta.env.DEV) console.error('Error generating plan:', error);
        toast.error('Failed to generate plan');
      } finally {
        setIsGenerating(false);
      }
    }, 300);
  }, [dailyTargets, validation.isValid, selectedMealSlots, recipePoolsBySlot, exactAssignments, allRecipes, numberOfDays, lockedSlots, generatedPlan, effectivePlanDietType, setGeneratedPlan, setIsPlanMode, isAuthenticated, savePlan]);

  // Handle multiplier change (now supports custom values)
  const handleSetMultiplier = (dayIndex: number, slotId: string, newMultiplier: number) => {
    updateSlotMultiplier(dayIndex, slotId, newMultiplier);
  };

  // Sync plan changes to database (debounced)
  useEffect(() => {
    if (!generatedPlan || !activePlanId || !isAuthenticated) return;
    
    const timeout = setTimeout(() => {
      updatePlan(generatedPlan);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [generatedPlan, activePlanId, isAuthenticated, updatePlan]);

  // Handle swap - navigate to Discover with slot filter and macro gap context
  const handleSwapRecipe = (slotId: string) => {
    // Calculate macro gaps to help with recipe sorting
    const gapContext: MacroGapContext = {
      proteinGap: dailyTargets ? dailyTargets.protein - calculatedDayTotals.protein : 0,
      carbsGap: dailyTargets ? dailyTargets.carbs - calculatedDayTotals.carbs : 0,
      fatGap: dailyTargets ? dailyTargets.fat - calculatedDayTotals.fat : 0,
      caloriesGap: dailyTargets ? dailyTargets.calories - calculatedDayTotals.calories : 0,
      primaryGap: null,
    };
    
    // Determine primary gap (largest percentage shortfall)
    if (dailyTargets) {
      const proteinPct = gapContext.proteinGap / dailyTargets.protein;
      const carbsPct = gapContext.carbsGap / dailyTargets.carbs;
      const fatPct = gapContext.fatGap / dailyTargets.fat;
      
      if (proteinPct > 0.1 || carbsPct > 0.1 || fatPct > 0.1) {
        const maxPct = Math.max(proteinPct, carbsPct, fatPct);
        if (maxPct === proteinPct) gapContext.primaryGap = 'protein';
        else if (maxPct === carbsPct) gapContext.primaryGap = 'carbs';
        else gapContext.primaryGap = 'fat';
      }
    }
    
    // Find the current recipe name and slot label for the swap banner
    const slot = currentDayPlan?.slots.find(s => s.slotId === slotId);
    const originalRecipe = slot ? recipeMap.get(slot.recipeId) : null;
    const slotDef = selectedMealSlots.find(s => s.id === slotId);
    
    setMacroGapContext(gapContext);
    setCurrentSlotFilter(slotId as any);
    // Set swap context with recipe name for the banner
    setSwapContext({ 
      dayIndex: selectedDay, 
      slotId: slotId as any,
      originalRecipeName: originalRecipe?.title || 'this meal',
      slotLabel: slotDef?.label || slotId,
    });
    setIsPlanMode(true);
    navigate('/discover');
  };

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const days = Array.from({ length: numberOfDays }, (_, i) => addDays(weekStart, i));

  const currentDayPlan = generatedPlan?.days[selectedDay];
  const currentDayLocks = lockedSlots[selectedDay] || [];

  // Rebalance: Re-optimize multipliers for current day while keeping the same recipes
  const handleRebalanceDay = useCallback(() => {
    if (!dailyTargets || !generatedPlan || !currentDayPlan) return;
    
    setIsGenerating(true);
    
    setTimeout(() => {
      try {
        // Import solveDay to re-optimize multipliers
        import('@/lib/mealPlanGenerator/solver').then(({ solveDay }) => {
          // Build slots from current plan with existing recipe assignments
          const slotsToSolve = currentDayPlan.slots.map(slot => ({
            slotId: slot.slotId,
            recipeId: slot.recipeId,
            multiplier: 1, // Reset to 1 so solver can re-optimize
            isLocked: currentDayLocks.includes(slot.slotId),
          }));
          
          // Run solver on these exact recipes
          const dayResult = solveDay({
            dayIndex: selectedDay,
            slots: slotsToSolve,
            targets: dailyTargets,
            dietType: effectivePlanDietType,
            recipes: allRecipes,
            recipePool: allRecipes, // Full pool for swap suggestions
          });
          
          // Convert DayResult to GeneratedDay format
          const generatedDay: GeneratedDay = {
            dayIndex: dayResult.dayIndex,
            slots: dayResult.meals.map(meal => ({
              slotId: meal.slot,
              recipeId: meal.recipeId,
              servingMultiplier: meal.multiplier,
              isLocked: meal.isLocked,
              slotTotals: meal.totals,
            })),
            extras: dayResult.addOns.map(addon => ({
              id: addon.id,
              name: addon.name,
              emoji: addon.emoji,
              macros: addon.macros,
            })),
            dayTotals: dayResult.totals,
            deltaVsTarget: dayResult.deltas,
          };
          
          // Update the plan with new multipliers and extras
          const updatedDays = [...generatedPlan.days];
          updatedDays[selectedDay] = generatedDay;
          
          setGeneratedPlan({
            ...generatedPlan,
            days: updatedDays,
          });
          
          toast.success('Serving sizes rebalanced!');
          setIsGenerating(false);
        }).catch(error => {
          if (import.meta.env.DEV) console.error('Error rebalancing:', error);
          toast.error('Failed to rebalance');
          setIsGenerating(false);
        });
      } catch (error) {
        if (import.meta.env.DEV) console.error('Error rebalancing:', error);
        toast.error('Failed to rebalance');
        setIsGenerating(false);
      }
    }, 100);
  }, [dailyTargets, generatedPlan, currentDayPlan, selectedDay, currentDayLocks, effectivePlanDietType, allRecipes, setGeneratedPlan]);

  // Recalculate day totals using actual recipe data (since stored totals may be stale)
  const calculatedDayTotals = useMemo(() => {
    if (!currentDayPlan || allRecipes.length === 0) {
      return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    }

    // Sum from recipe slots + solver extras (add-ons)
    const slotTotals = currentDayPlan.slots.reduce((acc, slot) => {
      const recipe = recipeMap.get(slot.recipeId);
      if (!recipe?.nutrition) return acc;

      const multiplier = slot.servingMultiplier || 1;
      return {
        calories: acc.calories + Math.round((recipe.nutrition.calories ?? 0) * multiplier),
        protein: acc.protein + Math.round((recipe.nutrition.protein_g ?? 0) * multiplier),
        carbs: acc.carbs + Math.round((recipe.nutrition.carbs_g ?? 0) * multiplier),
        fat: acc.fat + Math.round((recipe.nutrition.fat_g ?? 0) * multiplier),
      };
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

    const extrasTotals = (currentDayPlan.extras ?? []).reduce((acc, extra) => {
      return {
        calories: acc.calories + Math.round(extra.macros.calories ?? 0),
        protein: acc.protein + Math.round(extra.macros.protein ?? 0),
        carbs: acc.carbs + Math.round(extra.macros.carbs ?? 0),
        fat: acc.fat + Math.round(extra.macros.fat ?? 0),
      };
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

    return {
      calories: slotTotals.calories + extrasTotals.calories,
      protein: slotTotals.protein + extrasTotals.protein,
      carbs: slotTotals.carbs + extrasTotals.carbs,
      fat: slotTotals.fat + extrasTotals.fat,
    };
  }, [currentDayPlan, recipeMap, allRecipes.length]);

  // Auto-generate when coming from Discover with valid recipes
  // Also auto-optimize if the existing plan has significant macro gaps
  useEffect(() => {
    if (!validation.isValid || isGenerating) return;
    
    // Case 1: Coming from Discover with no plan yet
    if (isPlanMode && !generatedPlan) {
      handleGeneratePlan();
      return;
    }
    
    // Case 2: Plan exists but has significant gaps - auto-optimize
    if (generatedPlan && dailyTargets && !isPlanMode) {
      const day = generatedPlan.days[selectedDay];
      if (!day) return;
      
      // Check if the plan needs optimization (gaps > 15%)
      const calorieGap = Math.abs(calculatedDayTotals.calories - dailyTargets.calories) / dailyTargets.calories;
      const proteinGap = Math.abs(calculatedDayTotals.protein - dailyTargets.protein) / dailyTargets.protein;
      
      // Only auto-optimize if there are significant gaps and the solver hasn't run recently
      // (check if all slots are still at 1.0x multiplier - indicates solver hasn't run)
      const allDefaultMultipliers = day.slots.every(slot => slot.servingMultiplier === 1);
      
      if (allDefaultMultipliers && (calorieGap > 0.15 || proteinGap > 0.15)) {
        handleGeneratePlan();
      }
    }
  }, [isPlanMode, validation.isValid, generatedPlan, handleGeneratePlan, isGenerating, dailyTargets, calculatedDayTotals, selectedDay]);

  // Calculate slot totals for display (recalculated from recipe data)
  const getSlotTotals = useCallback((slot: GeneratedSlot) => {
    const recipe = recipeMap.get(slot.recipeId);
    if (!recipe?.nutrition) {
      return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    }
    const multiplier = slot.servingMultiplier || 1;
    return {
      calories: Math.round((recipe.nutrition.calories ?? 0) * multiplier),
      protein: Math.round((recipe.nutrition.protein_g ?? 0) * multiplier),
      carbs: Math.round((recipe.nutrition.carbs_g ?? 0) * multiplier),
      fat: Math.round((recipe.nutrition.fat_g ?? 0) * multiplier),
    };
  }, [recipeMap]);

  // Check if we have a plan to show
  const hasPlan = generatedPlan && generatedPlan.days.length > 0;
  const hasRecipesInPools = Object.values(recipePoolsBySlot).some(pool => pool.length > 0);

  // Show loading skeleton while syncing from database
  if (isSyncLoading) {
    return (
      <div className="min-h-screen bg-background pb-40">
        <div className="page-container">
          <PageHeader title={t('plan.weeklyPlan')} />
          <div className="space-y-4">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-40">
      <div className="page-container">
        <PageHeader 
          title={t('plan.weeklyPlan')} 
          rightAction={
            <div className="flex items-center gap-1">
              {isAuthenticated && activePlanId && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mr-1">
                  {isSaving ? (
                    <>
                      <Cloud className="w-3.5 h-3.5 animate-pulse" />
                      <span className="hidden sm:inline">Saving...</span>
                    </>
                  ) : (
                    <>
                      <Cloud className="w-3.5 h-3.5 text-primary" />
                      <span className="hidden sm:inline">Saved</span>
                    </>
                  )}
                </div>
              )}
              <Button variant="ghost" size="icon" onClick={() => setShowGoalsModal(true)}>
                <Settings className="w-5 h-5" />
              </Button>
            </div>
          }
        />

        {/* Day Selector */}
        <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-4 -mx-1 px-1">
          {days.map((day, index) => (
            <button
              key={index}
              onClick={() => setSelectedDay(index)}
              className={cn(
                'flex flex-col items-center min-w-[48px] py-2 px-3 rounded-xl transition-all',
                selectedDay === index
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card border border-border hover:bg-muted'
              )}
            >
              <span className="text-xs font-medium opacity-80">{format(day, 'EEE')}</span>
              <span className="text-lg font-bold">{format(day, 'd')}</span>
            </button>
          ))}
        </div>

        {/* Nutrition Summary - combined targets and actuals */}
        <NutritionSummaryCard
          dailyTargets={dailyTargets ?? (preferences?.calorie_target ? {
            calories: preferences.calorie_target,
            protein: preferences.protein_target ?? 0,
            carbs: preferences.carbs_target ?? 0,
            fat: preferences.fat_target ?? 0,
          } : null)}
          dayTotals={calculatedDayTotals}
          onSetGoals={() => setShowGoalsModal(true)}
        />

        {/* Validation errors */}
        {!validation.isValid && selectedMealSlots.length > 0 && (
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 mb-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-700 dark:text-amber-400">
                  Missing recipes
                </p>
                <p className="text-sm text-amber-600 dark:text-amber-500 mt-1">
                  Add recipes for: {validation.missingSlots.join(', ')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Generated Plan View */}
        {hasPlan && currentDayPlan && dailyTargets ? (
          <div className="space-y-4">
            {/* Day header */}
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{format(days[selectedDay], 'EEEE, MMM d')}</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRebalanceDay}
                disabled={isGenerating}
              >
                <RefreshCw className={cn('w-4 h-4 mr-1', isGenerating && 'animate-spin')} />
                Rebalance
              </Button>
            </div>

            {/* Macro balance indicator */}
            <MacroGapIndicator
              dailyTargets={dailyTargets}
              dayTotals={calculatedDayTotals}
            />

            {/* Meal slots */}
            <div className="space-y-3">
              {currentDayPlan.slots.map((slot) => {
                const slotDef = selectedMealSlots.find(s => s.id === slot.slotId);
                const recipe = recipeMap.get(slot.recipeId) || null;
                const isLocked = currentDayLocks.includes(slot.slotId);
                const slotTotals = getSlotTotals(slot);

                return (
                  <PlanSlotCard
                    key={slot.slotId}
                    slot={{ ...slot, slotTotals }}
                    slotLabel={slotDef?.label || slot.slotId}
                    recipe={recipe}
                    isLocked={isLocked}
                    onToggleLock={() => toggleSlotLock(selectedDay, slot.slotId)}
                    onSetMultiplier={(mult) => handleSetMultiplier(selectedDay, slot.slotId, mult)}
                    onSwap={() => handleSwapRecipe(slot.slotId)}
                  />
                );
              })}
            </div>
          </div>
        ) : (
          /* Empty state - no plan yet */
          <div className="py-12 text-center">
            {selectedMealSlots.length === 0 ? (
              <>
                <p className="text-muted-foreground mb-4">Set up your nutrition goals to get started</p>
                <Button onClick={() => setShowGoalsModal(true)}>
                  <Settings className="w-4 h-4 mr-2" />
                  Set Goals
                </Button>
              </>
            ) : !hasRecipesInPools ? (
              <p className="text-muted-foreground">Use the button below to add recipes</p>
            ) : (
              <>
                <p className="text-muted-foreground mb-4">Generate your meal plan</p>
                <Button 
                  onClick={handleGeneratePlan}
                  disabled={!validation.isValid || isGenerating}
                >
                  <Sparkles className={cn('w-4 h-4 mr-2', isGenerating && 'animate-pulse')} />
                  {isGenerating ? 'Generating...' : 'Generate Plan'}
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Sticky Actions */}
      <StickyActions>
        <div className="flex gap-2">
          <Button 
            className="flex-1"
            onClick={() => {
              setIsPlanMode(true);
              navigate('/discover');
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Recipes
          </Button>
          <Button 
            variant="outline" 
            className="flex-1" 
            onClick={() => navigate('/grocery')}
            disabled={!hasPlan}
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            {t('grocery.title')}
          </Button>
        </div>
      </StickyActions>

      <BottomNav />
      
      <NutritionGoalsModal 
        open={showGoalsModal} 
        onOpenChange={setShowGoalsModal}
        onSave={refetchPreferences}
      />
    </div>
  );
}
