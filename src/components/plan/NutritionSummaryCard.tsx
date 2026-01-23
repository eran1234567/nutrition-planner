import { useTranslation } from 'react-i18next';
import { Flame, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

  // When no targets are set, don't render anything - Plan.tsx shows a lightweight banner instead
  if (!hasTargets) {
    return null;
  }

  const caloriePercent = Math.min(Math.round((dayTotals.calories / dailyTargets.calories) * 100), 100);

  return (
    <div className="bg-card rounded-2xl border border-border p-4 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-muted-foreground">Daily Nutrition</span>
        {onSetGoals && (
          <Button variant="ghost" size="sm" onClick={onSetGoals} className="h-7 w-7 p-0">
            <Settings className="w-4 h-4 text-muted-foreground" />
          </Button>
        )}
      </div>

      {/* Main content - Calories ring + Macros */}
      <div className="flex items-center gap-6">
        {/* Large Calories Ring */}
        <div className="flex-shrink-0">
          <CircularProgress
            percent={caloriePercent}
            size={100}
            strokeWidth={8}
            colorClass="stroke-[hsl(var(--calories))]"
            trackClass="stroke-muted"
          >
            <div className="text-center">
              <Flame className="w-4 h-4 text-[hsl(var(--calories))] mx-auto mb-0.5" />
              <span className="text-xl font-bold text-foreground">{dayTotals.calories}</span>
              <p className="text-[10px] text-muted-foreground">/ {dailyTargets.calories}</p>
            </div>
          </CircularProgress>
        </div>

        {/* Macro rings */}
        <div className="flex-1 grid grid-cols-3 gap-3">
          <MacroRing
            label="Protein"
            actual={dayTotals.protein}
            target={dailyTargets.protein}
            colorClass="stroke-[hsl(var(--protein))]"
            textColorClass="text-[hsl(var(--protein))]"
          />
          <MacroRing
            label="Carbs"
            actual={dayTotals.carbs}
            target={dailyTargets.carbs}
            colorClass="stroke-[hsl(var(--carbs))]"
            textColorClass="text-[hsl(var(--carbs))]"
          />
          <MacroRing
            label="Fat"
            actual={dayTotals.fat}
            target={dailyTargets.fat}
            colorClass="stroke-[hsl(var(--fat))]"
            textColorClass="text-[hsl(var(--fat))]"
          />
        </div>
      </div>
    </div>
  );
}

interface CircularProgressProps {
  percent: number;
  size: number;
  strokeWidth: number;
  colorClass: string;
  trackClass: string;
  children?: React.ReactNode;
}

function CircularProgress({
  percent,
  size,
  strokeWidth,
  colorClass,
  trackClass,
  children,
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        {/* Background track */}
        <circle
          className={cn('fill-none', trackClass)}
          strokeWidth={strokeWidth}
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        {/* Progress arc */}
        <circle
          className={cn('fill-none transition-all duration-500 ease-out', colorClass)}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: offset,
          }}
        />
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}

function MacroRing({
  label,
  actual,
  target,
  colorClass,
  textColorClass,
}: {
  label: string;
  actual: number;
  target: number;
  colorClass: string;
  textColorClass: string;
}) {
  const percent = target > 0 ? Math.min(Math.round((actual / target) * 100), 100) : 0;

  return (
    <div className="flex flex-col items-center">
      <CircularProgress
        percent={percent}
        size={56}
        strokeWidth={5}
        colorClass={colorClass}
        trackClass="stroke-muted"
      >
        <span className={cn('text-sm font-bold', textColorClass)}>{actual}g</span>
      </CircularProgress>
      <span className="text-[10px] text-muted-foreground mt-1.5">{label}</span>
      <span className="text-[10px] text-muted-foreground">/ {target}g</span>
    </div>
  );
}
