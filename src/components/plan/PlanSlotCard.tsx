import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Unlock, RefreshCw, Minus, Plus, ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { GeneratedSlot, MealSlotId } from '@/types/mealPlan';
import type { GlobalRecipe } from '@/hooks/useGlobalRecipes';
import { SERVING_MULTIPLIERS } from '@/types/mealPlan';

interface PlanSlotCardProps {
  slot: GeneratedSlot;
  slotLabel: string;
  recipe: GlobalRecipe | null;
  isLocked: boolean;
  onToggleLock: () => void;
  onAdjustMultiplier: (delta: number) => void;
  onSwap: () => void;
}

export function PlanSlotCard({
  slot,
  slotLabel,
  recipe,
  isLocked,
  onToggleLock,
  onAdjustMultiplier,
  onSwap,
}: PlanSlotCardProps) {
  const { t } = useTranslation();

  const multiplierIndex = SERVING_MULTIPLIERS.indexOf(slot.servingMultiplier as typeof SERVING_MULTIPLIERS[number]);
  const canDecrease = multiplierIndex > 0;
  const canIncrease = multiplierIndex < SERVING_MULTIPLIERS.length - 1;

  if (!recipe) {
    return (
      <div className="p-3 rounded-xl border border-dashed border-border bg-muted/30">
        <div className="flex items-center justify-between">
          <span className="font-medium text-muted-foreground">{slotLabel}</span>
          <span className="text-xs text-muted-foreground">No recipe assigned</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      'rounded-xl border bg-card overflow-hidden',
      isLocked ? 'border-primary/50' : 'border-border'
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border">
        <span className="font-medium text-sm">{slotLabel}</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={onToggleLock}
            title={isLocked ? 'Unlock slot' : 'Lock slot'}
          >
            {isLocked ? (
              <Lock className="w-3.5 h-3.5 text-primary" />
            ) : (
              <Unlock className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={onSwap}
            title="Swap recipe"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-3">
        <div className="flex gap-3">
          {/* Image */}
          <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
            {recipe.image_url ? (
              <img
                src={recipe.image_url}
                alt={recipe.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl">🍽️</div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm line-clamp-2">{recipe.title}</p>
            {/* Macro badges with colors */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
              <span className="text-xs text-[hsl(var(--calories))] font-medium">
                {slot.slotTotals.calories} cal
              </span>
              <span className="text-xs text-[hsl(var(--protein))] font-medium">
                {slot.slotTotals.protein}g P
              </span>
              <span className="text-xs text-[hsl(var(--carbs))] font-medium">
                {slot.slotTotals.carbs}g C
              </span>
              <span className="text-xs text-[hsl(var(--fat))] font-medium">
                {slot.slotTotals.fat}g F
              </span>
            </div>
          </div>
        </div>

        {/* Serving multiplier */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
          <span className="text-xs text-muted-foreground">Servings</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => onAdjustMultiplier(-1)}
              disabled={!canDecrease}
            >
              <Minus className="w-3 h-3" />
            </Button>
            <span className="text-sm font-medium w-12 text-center">
              {slot.servingMultiplier}x
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => onAdjustMultiplier(1)}
              disabled={!canIncrease}
            >
              <Plus className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
