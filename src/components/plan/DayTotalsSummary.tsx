import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DailyTargets } from '@/types/mealPlan';

interface DayTotalsSummaryProps {
  dayTotals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  dailyTargets: DailyTargets;
}

export function DayTotalsSummary({ dayTotals, dailyTargets }: DayTotalsSummaryProps) {
  const { t } = useTranslation();

  const deltas = useMemo(() => ({
    calories: dayTotals.calories - dailyTargets.calories,
    protein: dayTotals.protein - dailyTargets.protein,
    carbs: dayTotals.carbs - dailyTargets.carbs,
    fat: dayTotals.fat - dailyTargets.fat,
  }), [dayTotals, dailyTargets]);

  const getDeltaIndicator = (delta: number, threshold: number = 50) => {
    if (Math.abs(delta) <= threshold) {
      return { icon: Minus, color: 'text-muted-foreground', bg: 'bg-muted' };
    }
    if (delta > 0) {
      return { icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30' };
    }
    return { icon: TrendingDown, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30' };
  };

  const calorieDelta = getDeltaIndicator(deltas.calories, 100);
  const CalorieIcon = calorieDelta.icon;

  return (
    <div className="p-4 rounded-xl bg-card border border-border">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">Day Totals</h3>
        <div className={cn(
          'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
          calorieDelta.bg,
          calorieDelta.color
        )}>
          <CalorieIcon className="w-3 h-3" />
          <span>
            {deltas.calories > 0 ? '+' : ''}{deltas.calories} cal
          </span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <MacroBox
          label="Calories"
          value={dayTotals.calories}
          target={dailyTargets.calories}
          unit="kcal"
          colorClass="text-[hsl(var(--calories))]"
        />
        <MacroBox
          label="Protein"
          value={dayTotals.protein}
          target={dailyTargets.protein}
          unit="g"
          colorClass="text-[hsl(var(--protein))]"
        />
        <MacroBox
          label="Fat"
          value={dayTotals.fat}
          target={dailyTargets.fat}
          unit="g"
          colorClass="text-[hsl(var(--fat))]"
        />
        <MacroBox
          label="Carbs"
          value={dayTotals.carbs}
          target={dailyTargets.carbs}
          unit="g"
          colorClass="text-[hsl(var(--carbs))]"
        />
      </div>
    </div>
  );
}

function MacroBox({ 
  label, 
  value, 
  target, 
  unit, 
  colorClass 
}: { 
  label: string; 
  value: number; 
  target: number; 
  unit: string;
  colorClass: string;
}) {
  const percent = target > 0 ? Math.round((value / target) * 100) : 0;
  const isOver = percent > 105;
  const isUnder = percent < 95;

  return (
    <div className="text-center">
      <p className={cn('text-lg font-bold', colorClass)}>{value}</p>
      <p className="text-2xs text-muted-foreground">{unit}</p>
      <p className={cn(
        'text-2xs mt-0.5',
        isOver ? 'text-amber-600' : isUnder ? 'text-blue-600' : 'text-green-600'
      )}>
        {percent}%
      </p>
    </div>
  );
}
