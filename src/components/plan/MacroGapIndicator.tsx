import { useMemo } from 'react';
import { Droplets, Flame, Wheat, Zap, CheckCircle } from 'lucide-react';
import type { DailyTargets } from '@/types/mealPlan';

interface MacroGapIndicatorProps {
  dailyTargets: DailyTargets;
  dayTotals: { calories: number; protein: number; carbs: number; fat: number };
}

interface MacroDeviation {
  macro: 'calories' | 'protein' | 'carbs' | 'fat';
  deviation: number;
  percent: number;
  label: string;
  icon: React.ReactNode;
  color: string;
}

export function MacroGapIndicator({
  dailyTargets,
  dayTotals,
}: MacroGapIndicatorProps) {
  const deviations = useMemo(() => {
    const result: MacroDeviation[] = [];
    
    const calorieDev = dayTotals.calories - dailyTargets.calories;
    const proteinDev = dayTotals.protein - dailyTargets.protein;
    const carbsDev = dayTotals.carbs - dailyTargets.carbs;
    const fatDev = dayTotals.fat - dailyTargets.fat;
    
    // Calculate percentage deviations
    const caloriePercent = dailyTargets.calories > 0 ? (calorieDev / dailyTargets.calories) * 100 : 0;
    const proteinPercent = dailyTargets.protein > 0 ? (proteinDev / dailyTargets.protein) * 100 : 0;
    const carbsPercent = dailyTargets.carbs > 0 ? (carbsDev / dailyTargets.carbs) * 100 : 0;
    const fatPercent = dailyTargets.fat > 0 ? (fatDev / dailyTargets.fat) * 100 : 0;
    
    // Only show significant deviations (>5%)
    if (Math.abs(caloriePercent) > 5) {
      result.push({
        macro: 'calories',
        deviation: calorieDev,
        percent: caloriePercent,
        label: `${calorieDev > 0 ? '+' : ''}${Math.round(calorieDev)} cal`,
        icon: <Zap className="w-3.5 h-3.5" />,
        color: calorieDev > 0 ? 'hsl(var(--destructive))' : 'hsl(var(--primary))',
      });
    }
    
    if (Math.abs(proteinPercent) > 5) {
      result.push({
        macro: 'protein',
        deviation: proteinDev,
        percent: proteinPercent,
        label: `${proteinDev > 0 ? '+' : ''}${Math.round(proteinDev)}g P`,
        icon: <Flame className="w-3.5 h-3.5" />,
        color: 'hsl(var(--protein))',
      });
    }
    
    if (Math.abs(carbsPercent) > 5) {
      result.push({
        macro: 'carbs',
        deviation: carbsDev,
        percent: carbsPercent,
        label: `${carbsDev > 0 ? '+' : ''}${Math.round(carbsDev)}g C`,
        icon: <Wheat className="w-3.5 h-3.5" />,
        color: 'hsl(var(--carbs))',
      });
    }
    
    if (Math.abs(fatPercent) > 5) {
      result.push({
        macro: 'fat',
        deviation: fatDev,
        percent: fatPercent,
        label: `${fatDev > 0 ? '+' : ''}${Math.round(fatDev)}g F`,
        icon: <Droplets className="w-3.5 h-3.5" />,
        color: 'hsl(var(--fat))',
      });
    }
    
    return result;
  }, [dailyTargets, dayTotals]);

  // All macros within target
  if (deviations.length === 0) {
    return (
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 mb-4 flex items-center gap-2">
        <CheckCircle className="w-5 h-5 text-primary" />
        <span className="text-sm font-medium text-primary">
          All macros on target! Great balance.
        </span>
      </div>
    );
  }

  // Group by over/under
  const over = deviations.filter(d => d.deviation > 0);
  const under = deviations.filter(d => d.deviation < 0);

  return (
    <div className="rounded-xl border border-muted-foreground/20 bg-muted/30 p-3 mb-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          Macro Balance
        </span>
        <span className="text-xs text-muted-foreground">
          Use "Regenerate" to rebalance
        </span>
      </div>
      
      <div className="flex flex-wrap gap-1.5">
        {deviations.map(dev => (
          <span
            key={dev.macro}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ 
              backgroundColor: `${dev.color}15`,
              color: dev.color,
            }}
          >
            {dev.icon}
            {dev.label}
          </span>
        ))}
      </div>
    </div>
  );
}