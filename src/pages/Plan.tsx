import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, ShoppingCart, RefreshCw, Settings, Sparkles, AlertTriangle, Cloud, CloudOff, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/PageHeader';
import { BottomNav } from '@/components/layout/BottomNav';
import { StickyActions } from '@/components/ui/StickyActions';
import { NutritionGoalsModal } from '@/components/plan/NutritionGoalsModal';
import { NutritionSummaryCard } from '@/components/plan/NutritionSummaryCard';
import { PlanSlotCard } from '@/components/plan/PlanSlotCard';
import { MacroGapSuggestions, type TopUpItem } from '@/components/plan/MacroGapSuggestions';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/stores/appStore';
import { useMealPlanStore, type MacroGapContext } from '@/stores/mealPlanStore';
import { useUserData } from '@/hooks/useUserData';
import { useGlobalRecipes } from '@/hooks/useGlobalRecipes';
import { useMealPlanSync } from '@/hooks/useMealPlanSync';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { format, addDays, startOfWeek } from 'date-fns';
import { generateMealPlan, validatePlanInputs, optimizeDayServings } from '@/lib/mealPlanGenerator';
import type { GeneratedSlot } from '@/types/mealPlan';
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
    setGeneratedPlan,
    updateSlotMultiplier,
    toggleSlotLock,
    swapRecipe,
    setIsPlanMode,
    setCurrentSlotFilter,
    setMacroGapContext,
  } = useMealPlanStore();
  
  const [selectedDay, setSelectedDay] = useState(0);
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [hasShownInitialModal, setHasShownInitialModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const hasSavedPlanRef = useRef(false);

  // Show nutrition goals modal on first visit if no goals are set
  useEffect(() => {
    if (preferencesLoading || hasShownInitialModal) return;
    
    const hasNutritionGoals = preferences?.calorie_target || selectedMealSlots.length > 0;
    if (!hasNutritionGoals) {
      setShowGoalsModal(true);
      setHasShownInitialModal(true);
    }
  }, [preferences, preferencesLoading, hasShownInitialModal, selectedMealSlots.length]);

  // Build recipe map for quick lookup
  const recipeMap = useMemo(() => {
    const map = new Map<string, GlobalRecipe>();
    allRecipes.forEach(r => map.set(r.id, r));
    return map;
  }, [allRecipes]);

  // Validate plan inputs
  const validation = useMemo(() => {
    if (!dailyTargets || selectedMealSlots.length === 0) {
      return { isValid: false, errors: ['Set up your nutrition goals first'], missingSlots: [] };
    }
    return validatePlanInputs({
      dailyTargets,
      selectedMealSlots,
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
        console.error('Error generating plan:', error);
        toast.error('Failed to generate plan');
      } finally {
        setIsGenerating(false);
      }
    }, 300);
  }, [dailyTargets, validation.isValid, selectedMealSlots, recipePoolsBySlot, exactAssignments, allRecipes, numberOfDays, lockedSlots, generatedPlan, setGeneratedPlan, setIsPlanMode, isAuthenticated, savePlan]);

  // Auto-generate when coming from Discover with valid recipes
  useEffect(() => {
    if (isPlanMode && validation.isValid && !generatedPlan) {
      handleGeneratePlan();
    }
  }, [isPlanMode, validation.isValid, generatedPlan, handleGeneratePlan]);

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
    
    setMacroGapContext(gapContext);
    setCurrentSlotFilter(slotId as any);
    setIsPlanMode(true);
    navigate('/discover');
  };

  // Handle adding a top-up item to fill macro gaps
  const handleAddTopUp = (item: TopUpItem) => {
    // For now, just show a toast - in future could add to a "extras" list
    toast.success(`Added ${item.name}`, {
      description: `+${item.macros.calories} cal, +${item.macros.protein}g P, +${item.macros.carbs}g C, +${item.macros.fat}g F`,
    });
    // TODO: Could persist these as "extras" for the day
  };

  // Regenerate unlocked slots for current day
  const handleRegenerateDay = () => {
    if (!dailyTargets || !validation.isValid) return;
    handleGeneratePlan();
  };

  // Auto-optimize current day's servings to hit targets exactly
  const handleOptimizeDay = () => {
    if (!generatedPlan || !dailyTargets) return;
    
    const dayPlan = generatedPlan.days[selectedDay];
    if (!dayPlan) return;
    
    const dayLocks = lockedSlots[selectedDay] || [];
    
    const optimizedDay = optimizeDayServings(
      dayPlan,
      allRecipes,
      dailyTargets,
      dayLocks
    );
    
    // Update the plan with optimized day
    const updatedDays = generatedPlan.days.map((day, idx) => 
      idx === selectedDay ? optimizedDay : day
    );
    
    setGeneratedPlan({
      ...generatedPlan,
      days: updatedDays,
    });
    
    toast.success('Servings optimized to match targets');
  };

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const days = Array.from({ length: numberOfDays }, (_, i) => addDays(weekStart, i));

  const currentDayPlan = generatedPlan?.days[selectedDay];
  const currentDayLocks = lockedSlots[selectedDay] || [];

  // Recalculate day totals using actual recipe data (since stored totals may be stale)
  const calculatedDayTotals = useMemo(() => {
    if (!currentDayPlan || allRecipes.length === 0) {
      return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    }

    return currentDayPlan.slots.reduce((acc, slot) => {
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
  }, [currentDayPlan, recipeMap, allRecipes.length]);

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
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    setIsPlanMode(true);
                    navigate('/discover');
                  }}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Select Recipes
                </Button>
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
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleOptimizeDay}
                  title="Auto-adjust servings to hit targets exactly"
                >
                  <Wand2 className="w-4 h-4 mr-1" />
                  Optimize
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRegenerateDay}
                  disabled={isGenerating}
                >
                  <RefreshCw className={cn('w-4 h-4 mr-1', isGenerating && 'animate-spin')} />
                  Regenerate
                </Button>
              </div>
            </div>

            {/* Macro gap suggestions */}
            <MacroGapSuggestions
              dailyTargets={dailyTargets}
              dayTotals={calculatedDayTotals}
              onAddTopUp={handleAddTopUp}
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
              <>
                <p className="text-muted-foreground mb-4">Select recipes for your meal plan</p>
                <Button onClick={() => {
                  setIsPlanMode(true);
                  navigate('/discover');
                }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Select Recipes
                </Button>
              </>
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
            variant="outline" 
            className="flex-1" 
            onClick={() => navigate('/grocery')}
            disabled={!hasPlan}
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            {t('grocery.title')}
          </Button>
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
