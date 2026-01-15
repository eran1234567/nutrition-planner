import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Chip } from '@/components/ui/Chip';
import { Target, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMealPlanStore } from '@/stores/mealPlanStore';
import type { MealSlotId } from '@/types/mealPlan';

interface PlanModeHeaderProps {
  onExit: () => void;
}

export function PlanModeHeader({ onExit }: PlanModeHeaderProps) {
  const { t } = useTranslation();
  const { 
    selectedMealSlots, 
    currentSlotFilter, 
    setCurrentSlotFilter,
    recipePoolsBySlot,
    dailyTargets,
    numberOfDays,
  } = useMealPlanStore();

  const totalRecipesSelected = useMemo(() => {
    return Object.values(recipePoolsBySlot).reduce((sum, pool) => sum + pool.length, 0);
  }, [recipePoolsBySlot]);

  const slotStatus = useMemo(() => {
    return selectedMealSlots.map(slot => ({
      slot,
      count: (recipePoolsBySlot[slot.id] || []).length,
      hasRecipes: (recipePoolsBySlot[slot.id] || []).length > 0,
    }));
  }, [selectedMealSlots, recipePoolsBySlot]);

  return (
    <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 mb-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Target className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {t('plan.buildingPlan', 'Building Meal Plan')}
            </p>
            <p className="text-xs text-muted-foreground">
              {numberOfDays} days • {dailyTargets?.calories || 0} cal/day
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onExit} className="h-8 w-8 p-0">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Slot filters */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">
          Select recipes for each meal:
        </p>
        <div className="flex flex-wrap gap-2">
          <Chip
            selected={currentSlotFilter === null}
            onClick={() => setCurrentSlotFilter(null)}
            variant="outline"
          >
            All ({totalRecipesSelected})
          </Chip>
          {slotStatus.map(({ slot, count, hasRecipes }) => (
            <Chip
              key={slot.id}
              selected={currentSlotFilter === slot.id}
              onClick={() => setCurrentSlotFilter(slot.id)}
              variant="outline"
              className={!hasRecipes ? 'border-amber-500/50' : ''}
            >
              {slot.label} ({count})
              {!hasRecipes && <span className="text-amber-500 ml-1">!</span>}
            </Chip>
          ))}
        </div>
      </div>

      {/* Missing slots warning */}
      {slotStatus.some(s => !s.hasRecipes) && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Add at least one recipe to each meal slot
        </p>
      )}
    </div>
  );
}
