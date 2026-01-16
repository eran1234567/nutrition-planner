import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Flame, Settings, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { DailyTargets } from '@/types/mealPlan';

interface NutritionSummaryCardProps {
  dailyTargets: DailyTargets | null;
  dayTotals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  onSetGoals?: () => void;
}

export function NutritionSummaryCard({
  dailyTargets,
  dayTotals,
  onSetGoals,
}: NutritionSummaryCardProps) {
  const { t } = useTranslation();

  const hasTargets = dailyTargets && dailyTargets.calories > 0;

  if (!hasTargets) {
    return (
      <div className="bg-card rounded-2xl border border-border p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">
              {t('plan.dailyTargets', 'Your Daily Targets')}
            </span>
          </div>
          {onSetGoals && (
            <Button variant="ghost" size="sm" onClick={onSetGoals} className="h-7 px-2">
              <Settings className="w-4 h-4" />
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {t('plan.noTargetsSet', 'Tap the gear to set your nutrition goals')}
        </p>
      </div>
    );
  }

  const caloriePercent = Math.round((dayTotals.calories / dailyTargets.calories) * 100);
  const calorieDelta = dayTotals.calories - dailyTargets.calories;

  return (
    <div className="bg-card rounded-2xl border border-border p-4 mb-4 space-y-4">
      {/* Header with calorie summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Flame className="w-5 h-5 text-primary" />
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-foreground">{dayTotals.calories.toLocaleString()}</span>
              <span className="text-sm text-muted-foreground">/ {dailyTargets.calories.toLocaleString()} cal</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CalorieBadge delta={calorieDelta} />
          {onSetGoals && (
            <Button variant="ghost" size="sm" onClick={onSetGoals} className="h-8 w-8 p-0">
              <Settings className="w-4 h-4 text-muted-foreground" />
            </Button>
          )}
        </div>
      </div>

      {/* Calorie progress bar */}
      <Progress 
        value={Math.min(caloriePercent, 100)} 
        className="h-2"
      />

      {/* Macros grid */}
      <div className="grid grid-cols-3 gap-3">
        <MacroItem
          label="Protein"
          actual={dayTotals.protein}
          target={dailyTargets.protein}
          colorClass="text-[hsl(var(--protein))]"
          bgClass="bg-[hsl(var(--protein))]"
        />
        <MacroItem
          label="Carbs"
          actual={dayTotals.carbs}
          target={dailyTargets.carbs}
          colorClass="text-[hsl(var(--carbs))]"
          bgClass="bg-[hsl(var(--carbs))]"
        />
        <MacroItem
          label="Fat"
          actual={dayTotals.fat}
          target={dailyTargets.fat}
          colorClass="text-[hsl(var(--fat))]"
          bgClass="bg-[hsl(var(--fat))]"
        />
      </div>
    </div>
  );
}

function CalorieBadge({ delta }: { delta: number }) {
  const isOver = delta > 50;
  const isUnder = delta < -50;
  const isOnTarget = !isOver && !isUnder;

  const Icon = isOver ? TrendingUp : isUnder ? TrendingDown : Minus;

  return (
    <div
      className={cn(
        'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
        isOver && 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
        isUnder && 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
        isOnTarget && 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'
      )}
    >
      <Icon className="w-3 h-3" />
      <span>
        {delta > 0 ? '+' : ''}{delta} cal
      </span>
    </div>
  );
}

function MacroItem({
  label,
  actual,
  target,
  colorClass,
  bgClass,
}: {
  label: string;
  actual: number;
  target: number;
  colorClass: string;
  bgClass: string;
}) {
  const percent = target > 0 ? Math.round((actual / target) * 100) : 0;
  const isOver = percent > 105;
  const isUnder = percent < 95;
  const isOnTarget = !isOver && !isUnder;

  return (
    <div className="bg-muted/50 rounded-xl p-3 text-center">
      {/* Colored dot and label */}
      <div className="flex items-center justify-center gap-1.5 mb-1">
        <div className={cn('w-2 h-2 rounded-full', bgClass)} />
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
      </div>
      
      {/* Actual / Target */}
      <div className="flex items-baseline justify-center gap-1">
        <span className={cn('text-lg font-bold', colorClass)}>{actual}g</span>
        <span className="text-xs text-muted-foreground">/ {target}g</span>
      </div>
      
      {/* Percentage */}
      <div
        className={cn(
          'text-xs font-medium mt-0.5',
          isOver && 'text-amber-600 dark:text-amber-400',
          isUnder && 'text-blue-600 dark:text-blue-400',
          isOnTarget && 'text-green-600 dark:text-green-400'
        )}
      >
        {percent}%
      </div>
    </div>
  );
}
