import { Flame, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

interface DailyTargetsProps {
  calorieTarget: number | null;
  proteinTarget: number | null;
  carbsTarget: number | null;
  fatTarget: number | null;
  onSetGoals?: () => void;
}

export function DailyTargets({
  calorieTarget,
  proteinTarget,
  carbsTarget,
  fatTarget,
  onSetGoals,
}: DailyTargetsProps) {
  const { t } = useTranslation();

  // Check if we have all required data
  const hasAllData = calorieTarget && proteinTarget && carbsTarget && fatTarget;

  if (!hasAllData) {
    return (
      <div className="bg-primary/5 rounded-2xl p-3 mb-4">
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

  return (
    <div className="bg-primary/5 rounded-2xl p-3 mb-4">
      <div className="flex items-center justify-between gap-2">
        {/* Calories */}
        <div className="flex items-center gap-1.5">
          <Flame className="w-4 h-4 text-primary" />
          <span className="text-lg font-bold text-primary">{calorieTarget.toLocaleString()}</span>
          <span className="text-xs text-muted-foreground">cal</span>
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-border" />

        {/* Protein */}
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-[#4A90D9]" />
          <span className="text-sm font-semibold">{proteinTarget}g</span>
          <span className="text-xs text-muted-foreground">P</span>
        </div>

        {/* Carbs */}
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-[#F5A623]" />
          <span className="text-sm font-semibold">{carbsTarget}g</span>
          <span className="text-xs text-muted-foreground">C</span>
        </div>

        {/* Fat */}
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-[#D770AD]" />
          <span className="text-sm font-semibold">{fatTarget}g</span>
          <span className="text-xs text-muted-foreground">F</span>
        </div>

        {/* Settings button */}
        {onSetGoals && (
          <Button variant="ghost" size="sm" onClick={onSetGoals} className="h-7 w-7 p-0 ml-auto">
            <Settings className="w-4 h-4 text-muted-foreground" />
          </Button>
        )}
      </div>
    </div>
  );
}
