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
      <div className="bg-primary/5 rounded-2xl p-4 mb-6">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Flame className="w-5 h-5 text-primary" />
          <span className="font-semibold text-foreground">
            {t('plan.dailyTargets', 'Your Daily Targets')}
          </span>
        </div>
        <p className="text-center text-muted-foreground text-sm mb-4">
          {t('plan.noTargetsSet', 'Set your nutrition goals to see daily calorie and macro targets.')}
        </p>
        {onSetGoals && (
          <div className="flex justify-center">
            <Button variant="outline" size="sm" onClick={onSetGoals}>
              <Settings className="w-4 h-4 mr-2" />
              {t('plan.setGoals', 'Set Goals')}
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Calculate calories from macros (protein: 4 cal/g, carbs: 4 cal/g, fat: 9 cal/g)
  const proteinCal = proteinTarget * 4;
  const carbsCal = carbsTarget * 4;
  const fatCal = fatTarget * 9;
  const totalMacroCal = proteinCal + carbsCal + fatCal;

  // Calculate percentages
  const proteinPercent = totalMacroCal > 0 ? Math.round((proteinCal / totalMacroCal) * 100) : 0;
  const carbsPercent = totalMacroCal > 0 ? Math.round((carbsCal / totalMacroCal) * 100) : 0;
  const fatPercent = totalMacroCal > 0 ? Math.round((fatCal / totalMacroCal) * 100) : 0;

  return (
    <div className="bg-primary/5 rounded-2xl p-4 mb-6">
      {/* Header */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <Flame className="w-5 h-5 text-primary" />
        <span className="font-semibold text-foreground">
          {t('plan.dailyTargets', 'Your Daily Targets')}
        </span>
      </div>

      {/* Main Calorie Display */}
      <div className="text-center mb-4">
        <div className="text-4xl font-bold text-primary">
          {calorieTarget.toLocaleString()}
        </div>
        <div className="text-sm text-muted-foreground">
          {t('plan.caloriesPerDay', 'calories per day')}
        </div>
      </div>

      {/* Macro Breakdown Header */}
      <div className="mb-3">
        <span className="text-sm font-medium text-foreground">
          {t('plan.macroBreakdown', 'Macro Breakdown')}
        </span>
      </div>

      {/* Macro Percentage Bar */}
      <div className="flex rounded-full overflow-hidden h-8 mb-4">
        {proteinPercent > 0 && (
          <div
            className="bg-[#4A90D9] flex items-center justify-center text-white text-xs font-medium"
            style={{ width: `${proteinPercent}%` }}
          >
            {proteinPercent}%
          </div>
        )}
        {carbsPercent > 0 && (
          <div
            className="bg-[#F5A623] flex items-center justify-center text-white text-xs font-medium"
            style={{ width: `${carbsPercent}%` }}
          >
            {carbsPercent}%
          </div>
        )}
        {fatPercent > 0 && (
          <div
            className="bg-[#D770AD] flex items-center justify-center text-white text-xs font-medium"
            style={{ width: `${fatPercent}%` }}
          >
            {fatPercent}%
          </div>
        )}
      </div>

      {/* Macro Cards */}
      <div className="grid grid-cols-3 gap-2">
        {/* Protein */}
        <div className="bg-card rounded-xl p-3 border-t-4 border-[#4A90D9]">
          <div className="text-xs text-muted-foreground uppercase tracking-wide text-center">
            {t('macros.protein', 'Protein')}
          </div>
          <div className="text-xl font-bold text-center">{proteinTarget}g</div>
          <div className="text-xs text-muted-foreground text-center">{proteinCal} cal</div>
          <div className="text-xs text-[#4A90D9] font-medium text-center">{proteinPercent}%</div>
        </div>

        {/* Carbs */}
        <div className="bg-card rounded-xl p-3 border-t-4 border-[#F5A623]">
          <div className="text-xs text-muted-foreground uppercase tracking-wide text-center">
            {t('macros.carbs', 'Carbs')}
          </div>
          <div className="text-xl font-bold text-center">{carbsTarget}g</div>
          <div className="text-xs text-muted-foreground text-center">{carbsCal} cal</div>
          <div className="text-xs text-[#F5A623] font-medium text-center">{carbsPercent}%</div>
        </div>

        {/* Fat */}
        <div className="bg-card rounded-xl p-3 border-t-4 border-[#D770AD]">
          <div className="text-xs text-muted-foreground uppercase tracking-wide text-center">
            {t('macros.fat', 'Fat')}
          </div>
          <div className="text-xl font-bold text-center">{fatTarget}g</div>
          <div className="text-xs text-muted-foreground text-center">{fatCal} cal</div>
          <div className="text-xs text-[#D770AD] font-medium text-center">{fatPercent}%</div>
        </div>
      </div>
    </div>
  );
}
