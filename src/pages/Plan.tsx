import { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, ShoppingCart, RefreshCw, Settings, Sparkles, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/PageHeader';
import { BottomNav } from '@/components/layout/BottomNav';
import { StickyActions } from '@/components/ui/StickyActions';
import { NutritionGoalsModal } from '@/components/plan/NutritionGoalsModal';
import { DailyTargets } from '@/components/plan/DailyTargets';
import { PlanSlotCard } from '@/components/plan/PlanSlotCard';
import { DayTotalsSummary } from '@/components/plan/DayTotalsSummary';
import { useAppStore } from '@/stores/appStore';
import { useMealPlanStore } from '@/stores/mealPlanStore';
import { useUserData } from '@/hooks/useUserData';
import { useGlobalRecipes } from '@/hooks/useGlobalRecipes';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { format, addDays, startOfWeek } from 'date-fns';
import { generateMealPlan, validatePlanInputs } from '@/lib/mealPlanGenerator';
import { SERVING_MULTIPLIERS } from '@/types/mealPlan';
import { toast } from 'sonner';
import type { GlobalRecipe } from '@/hooks/useGlobalRecipes';

export default function Plan() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { preferences, loading: preferencesLoading, refetch: refetchPreferences } = useUserData();
  const { data: allRecipes = [] } = useGlobalRecipes();
  
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
  } = useMealPlanStore();
  
  const [selectedDay, setSelectedDay] = useState(0);
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [hasShownInitialModal, setHasShownInitialModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

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
  const handleGeneratePlan = useCallback(() => {
    if (!dailyTargets || !validation.isValid) return;

    setIsGenerating(true);
    
    // Small delay for UX
    setTimeout(() => {
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
        toast.success('Meal plan generated!');
      } catch (error) {
        console.error('Error generating plan:', error);
        toast.error('Failed to generate plan');
      } finally {
        setIsGenerating(false);
      }
    }, 300);
  }, [dailyTargets, validation.isValid, selectedMealSlots, recipePoolsBySlot, exactAssignments, allRecipes, numberOfDays, lockedSlots, generatedPlan, setGeneratedPlan, setIsPlanMode]);

  // Auto-generate when coming from Discover with valid recipes
  useEffect(() => {
    if (isPlanMode && validation.isValid && !generatedPlan) {
      handleGeneratePlan();
    }
  }, [isPlanMode, validation.isValid, generatedPlan, handleGeneratePlan]);

  // Handle multiplier adjustment
  const handleAdjustMultiplier = (dayIndex: number, slotId: string, delta: number) => {
    const currentSlot = generatedPlan?.days[dayIndex]?.slots.find(s => s.slotId === slotId);
    if (!currentSlot) return;

    const currentIndex = SERVING_MULTIPLIERS.indexOf(currentSlot.servingMultiplier as typeof SERVING_MULTIPLIERS[number]);
    const newIndex = Math.max(0, Math.min(SERVING_MULTIPLIERS.length - 1, currentIndex + delta));
    const newMultiplier = SERVING_MULTIPLIERS[newIndex];

    updateSlotMultiplier(dayIndex, slotId, newMultiplier);
  };

  // Handle swap - navigate to Discover with slot filter
  const handleSwapRecipe = (slotId: string) => {
    setCurrentSlotFilter(slotId as any);
    setIsPlanMode(true);
    navigate('/discover');
  };

  // Regenerate unlocked slots for current day
  const handleRegenerateDay = () => {
    if (!dailyTargets || !validation.isValid) return;
    handleGeneratePlan();
  };

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const days = Array.from({ length: numberOfDays }, (_, i) => addDays(weekStart, i));

  const currentDayPlan = generatedPlan?.days[selectedDay];
  const currentDayLocks = lockedSlots[selectedDay] || [];

  // Check if we have a plan to show
  const hasPlan = generatedPlan && generatedPlan.days.length > 0;
  const hasRecipesInPools = Object.values(recipePoolsBySlot).some(pool => pool.length > 0);

  return (
    <div className="min-h-screen bg-background pb-40">
      <div className="page-container">
        <PageHeader 
          title={t('plan.weeklyPlan')} 
          rightAction={
            <Button variant="ghost" size="icon" onClick={() => setShowGoalsModal(true)}>
              <Settings className="w-5 h-5" />
            </Button>
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

        {/* Daily Targets */}
        <DailyTargets
          calorieTarget={dailyTargets?.calories ?? preferences?.calorie_target ?? null}
          proteinTarget={dailyTargets?.protein ?? preferences?.protein_target ?? null}
          carbsTarget={dailyTargets?.carbs ?? preferences?.carbs_target ?? null}
          fatTarget={dailyTargets?.fat ?? preferences?.fat_target ?? null}
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

            {/* Day totals summary */}
            <DayTotalsSummary
              dayTotals={currentDayPlan.dayTotals}
              dailyTargets={dailyTargets}
            />

            {/* Meal slots */}
            <div className="space-y-3">
              {currentDayPlan.slots.map((slot) => {
                const slotDef = selectedMealSlots.find(s => s.id === slot.slotId);
                const recipe = recipeMap.get(slot.recipeId) || null;
                const isLocked = currentDayLocks.includes(slot.slotId);

                return (
                  <PlanSlotCard
                    key={slot.slotId}
                    slot={slot}
                    slotLabel={slotDef?.label || slot.slotId}
                    recipe={recipe}
                    isLocked={isLocked}
                    onToggleLock={() => toggleSlotLock(selectedDay, slot.slotId)}
                    onAdjustMultiplier={(delta) => handleAdjustMultiplier(selectedDay, slot.slotId, delta)}
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
