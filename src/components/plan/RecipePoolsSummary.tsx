import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useGlobalRecipes } from '@/hooks/useGlobalRecipes';
import { useMealPlanStore } from '@/stores/mealPlanStore';
import { MEAL_SLOT_DEFINITIONS, getDefaultPercentsForSlots, type MealSlotId, type MealSlot } from '@/types/mealPlan';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function RecipePoolsSummary() {
  const { t } = useTranslation();
  const { recipePoolsBySlot, selectedMealSlots, removeFromPool } = useMealPlanStore();
  const { data: allRecipes = [] } = useGlobalRecipes();

  // Fallback slots if user hasn't configured any yet
  const fallbackSlots: MealSlot[] = useMemo(() => {
    const slotIds: MealSlotId[] = ['breakfast', 'lunch', 'dinner'];
    const percents = getDefaultPercentsForSlots(slotIds);
    return slotIds.map((id) => ({
      id,
      label: MEAL_SLOT_DEFINITIONS[id].label,
      percentOfDay: percents[id] || 0,
      type: MEAL_SLOT_DEFINITIONS[id].type,
    }));
  }, []);

  const effectiveSlots = selectedMealSlots.length > 0 ? selectedMealSlots : fallbackSlots;

  // Map recipe IDs to names
  const recipeMap = useMemo(() => {
    const map = new Map<string, string>();
    allRecipes.forEach(r => map.set(r.id, r.title));
    return map;
  }, [allRecipes]);

  // Check if there are any recipes in any pool
  const hasAnyRecipes = Object.values(recipePoolsBySlot).some(pool => pool.length > 0);

  if (!hasAnyRecipes) {
    return null;
  }

  return (
    <div className="space-y-3 mb-4">
      <h3 className="text-sm font-medium text-muted-foreground">
        {t('plan.yourRecipes', 'Your recipes')}
      </h3>
      {effectiveSlots.map((slot) => {
        const recipeIds = recipePoolsBySlot[slot.id] || [];
        if (recipeIds.length === 0) return null;

        return (
          <div key={slot.id} className="p-3 rounded-xl bg-card border border-border">
            <p className="text-xs font-medium text-muted-foreground mb-2">{slot.label}</p>
            <div className="flex flex-wrap gap-2">
              {recipeIds.map((recipeId) => (
                <div
                  key={recipeId}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm',
                    'bg-primary/10 text-primary border border-primary/20'
                  )}
                >
                  <span className="line-clamp-1">{recipeMap.get(recipeId) || 'Recipe'}</span>
                  <button
                    type="button"
                    onClick={() => removeFromPool(slot.id, recipeId)}
                    className="ml-0.5 hover:text-destructive transition-colors"
                    aria-label={t('plan.removeRecipe', 'Remove recipe')}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
