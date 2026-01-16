import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Target, X, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useMealPlanStore } from '@/stores/mealPlanStore';
import { useGlobalRecipes } from '@/hooks/useGlobalRecipes';
import { cn } from '@/lib/utils';
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
    exactAssignments,
    dailyTargets,
    numberOfDays,
    removeFromPool,
    removeExactAssignment,
  } = useMealPlanStore();

  const { data: globalRecipes = [] } = useGlobalRecipes();

  // Create a map of recipe id to recipe for quick lookup
  const recipeMap = useMemo(() => {
    const map: Record<string, { id: string; title: string; image_url: string | null }> = {};
    globalRecipes.forEach(r => {
      map[r.id] = { id: r.id, title: r.title, image_url: r.image_url };
    });
    return map;
  }, [globalRecipes]);

  // Generate day labels
  const days = useMemo(() => {
    return Array.from({ length: numberOfDays }, (_, i) => ({
      index: i,
      label: `Day ${i + 1}`,
    }));
  }, [numberOfDays]);

  // For each slot, get pool recipes and exact assignments per day
  const slotData = useMemo(() => {
    return selectedMealSlots.map(slot => {
      const poolRecipes = recipePoolsBySlot[slot.id] || [];
      
      // Get exact assignments per day for this slot
      const dayAssignments: Record<number, { recipeId: string; servingMultiplier: number } | null> = {};
      for (let i = 0; i < numberOfDays; i++) {
        const dayData = exactAssignments[i];
        dayAssignments[i] = dayData?.[slot.id] || null;
      }
      
      return {
        slot,
        poolRecipes,
        dayAssignments,
        totalCount: poolRecipes.length + Object.values(dayAssignments).filter(Boolean).length,
      };
    });
  }, [selectedMealSlots, recipePoolsBySlot, exactAssignments, numberOfDays]);

  const handleRemoveFromPool = (slotId: MealSlotId, recipeId: string) => {
    removeFromPool(slotId, recipeId);
  };

  const handleRemoveExactAssignment = (dayIndex: number, slotId: string) => {
    removeExactAssignment(dayIndex, slotId);
  };

  const handleSlotClick = (slotId: MealSlotId) => {
    setCurrentSlotFilter(currentSlotFilter === slotId ? null : slotId);
  };

  return (
    <div className="rounded-xl bg-primary/5 border border-primary/20 mb-4 overflow-hidden">
      {/* Header */}
      <div className="p-3 flex items-start justify-between border-b border-primary/10">
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

      {/* Table */}
      <ScrollArea className="w-full">
        <div className="min-w-max">
          {/* Table Header - Days */}
          <div className="flex border-b border-primary/10">
            <div className="w-28 shrink-0 p-2 bg-muted/30 border-r border-primary/10">
              <span className="text-xs font-medium text-muted-foreground">Meal</span>
            </div>
            <div className="w-24 shrink-0 p-2 bg-muted/30 border-r border-primary/10 text-center">
              <span className="text-xs font-medium text-muted-foreground">Pool</span>
            </div>
            {days.map(day => (
              <div key={day.index} className="w-20 shrink-0 p-2 bg-muted/30 border-r border-primary/10 last:border-r-0 text-center">
                <span className="text-xs font-medium text-muted-foreground">{day.label}</span>
              </div>
            ))}
          </div>

          {/* Table Rows - Meal Slots */}
          {slotData.map(({ slot, poolRecipes, dayAssignments }) => {
            const isActiveFilter = currentSlotFilter === slot.id;
            const hasRecipes = poolRecipes.length > 0 || Object.values(dayAssignments).some(Boolean);
            
            return (
              <div 
                key={slot.id} 
                className={cn(
                  "flex border-b border-primary/10 last:border-b-0 transition-colors",
                  isActiveFilter && "bg-primary/5"
                )}
              >
                {/* Slot Name */}
                <button
                  onClick={() => handleSlotClick(slot.id)}
                  className={cn(
                    "w-28 shrink-0 p-2 text-left border-r border-primary/10 hover:bg-muted/50 transition-colors",
                    isActiveFilter && "bg-primary/10"
                  )}
                >
                  <span className={cn(
                    "text-xs font-medium",
                    !hasRecipes && "text-amber-600"
                  )}>
                    {slot.label}
                    {!hasRecipes && <span className="ml-1">!</span>}
                  </span>
                </button>

                {/* Pool Cell */}
                <div className="w-24 shrink-0 p-1.5 border-r border-primary/10">
                  {poolRecipes.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {poolRecipes.slice(0, 3).map(recipeId => {
                        const recipe = recipeMap[recipeId];
                        return (
                          <div
                            key={recipeId}
                            className="relative group"
                            title={recipe?.title || 'Recipe'}
                          >
                            {recipe?.image_url ? (
                              <img
                                src={recipe.image_url}
                                alt={recipe.title}
                                className="w-6 h-6 rounded object-cover border border-border"
                              />
                            ) : (
                              <div className="w-6 h-6 rounded bg-muted flex items-center justify-center text-xs">
                                🍽️
                              </div>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveFromPool(slot.id, recipeId);
                              }}
                              className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Minus className="w-2 h-2" />
                            </button>
                          </div>
                        );
                      })}
                      {poolRecipes.length > 3 && (
                        <div className="w-6 h-6 rounded bg-muted flex items-center justify-center text-2xs font-medium text-muted-foreground">
                          +{poolRecipes.length - 3}
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => handleSlotClick(slot.id)}
                      className="w-full h-6 rounded border border-dashed border-muted-foreground/30 flex items-center justify-center text-muted-foreground/50 hover:border-primary/50 hover:text-primary/50 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Day Cells */}
                {days.map(day => {
                  const assignment = dayAssignments[day.index];
                  const recipe = assignment ? recipeMap[assignment.recipeId] : null;
                  
                  return (
                    <div key={day.index} className="w-20 shrink-0 p-1.5 border-r border-primary/10 last:border-r-0">
                      {assignment && recipe ? (
                        <div className="relative group" title={recipe.title}>
                          {recipe.image_url ? (
                            <img
                              src={recipe.image_url}
                              alt={recipe.title}
                              className="w-full aspect-square rounded object-cover border border-border"
                            />
                          ) : (
                            <div className="w-full aspect-square rounded bg-muted flex items-center justify-center">
                              <span className="text-lg">🍽️</span>
                            </div>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveExactAssignment(day.index, slot.id);
                            }}
                            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Minus className="w-2.5 h-2.5" />
                          </button>
                          <p className="text-2xs text-muted-foreground truncate mt-0.5">{recipe.title}</p>
                        </div>
                      ) : (
                        <div className="w-full aspect-square rounded border border-dashed border-muted-foreground/20 flex items-center justify-center">
                          <span className="text-2xs text-muted-foreground/40">—</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Missing slots warning */}
      {slotData.some(s => s.poolRecipes.length === 0 && !Object.values(s.dayAssignments).some(Boolean)) && (
        <div className="px-3 py-2 bg-amber-500/10 border-t border-amber-500/20">
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Click a meal row to add recipes to it
          </p>
        </div>
      )}
    </div>
  );
}