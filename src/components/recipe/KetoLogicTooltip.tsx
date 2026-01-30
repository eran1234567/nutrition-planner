import { Check, X, AlertTriangle, Flame, Droplets, Beef, Info, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  calculateNetCarbs,
  calculateNetEnergy,
  calculateMacroPercents,
  calculateKetoScore,
  getKetoOptimization,
  KETO_BADGE_MAX_NET_CARBS,
  KETO_BADGE_MIN_FAT_PERCENT,
  KETO_SCORE_CARB_THRESHOLD,
  KETO_SCORE_PROTEIN_THRESHOLD,
  type RawNutritionData,
  type KetoScore,
  type KetoOptimizationSuggestion,
} from '@/lib/neutron';

interface KetoLogicTooltipProps {
  nutrition: RawNutritionData | null | undefined;
  children: React.ReactNode;
  showScore?: boolean;
  showOptimizer?: boolean;
  className?: string;
}

interface KetoMetrics {
  netCarbs: number;
  carbLimit: number;
  carbsPassed: boolean;
  fatPercent: number;
  fatTarget: number;
  fatPassed: boolean;
  proteinPercent: number;
  proteinThreshold: number;
  ketoScore: KetoScore;
  netEnergy: number;
  optimizationTip: KetoOptimizationSuggestion | null;
}

function calculateKetoMetrics(nutrition: RawNutritionData | null | undefined): KetoMetrics | null {
  if (!nutrition) return null;

  const protein = nutrition.protein_g ?? 0;
  const fat = nutrition.fat_g ?? 0;
  const totalCarbs = nutrition.carbs_g ?? 0;
  const fiber = nutrition.fiber_g ?? 0;
  const sugarAlcohols = nutrition.sugar_alcohols_g ?? 0;

  const netCarbs = calculateNetCarbs(totalCarbs, fiber, sugarAlcohols);
  const netEnergy = calculateNetEnergy(fat, protein, netCarbs);
  const percents = calculateMacroPercents(fat, protein, netCarbs, netEnergy);
  const ketoScore = calculateKetoScore(netCarbs, fat, protein);
  
  // Get optimization suggestions
  const optimization = getKetoOptimization(nutrition);
  const optimizationTip = optimization.suggestions.find(
    s => s.priority !== 'low' || s.action?.ingredient
  ) ?? null;

  return {
    netCarbs,
    carbLimit: KETO_BADGE_MAX_NET_CARBS,
    carbsPassed: netCarbs <= KETO_BADGE_MAX_NET_CARBS,
    fatPercent: percents.fatPercent,
    fatTarget: KETO_BADGE_MIN_FAT_PERCENT,
    fatPassed: percents.fatPercent >= KETO_BADGE_MIN_FAT_PERCENT,
    proteinPercent: percents.proteinPercent,
    proteinThreshold: KETO_SCORE_PROTEIN_THRESHOLD,
    ketoScore,
    netEnergy,
    optimizationTip,
  };
}

function StatusIcon({ type, value }: { type: ProgressType; value: number }) {
  // Determine status based on type and value
  let status: 'success' | 'warning' | 'danger';
  
  switch (type) {
    case 'carbs':
      status = value <= 9 ? 'success' : value <= 10 ? 'warning' : 'danger';
      break;
    case 'fat':
      status = value >= 60 ? 'success' : 'danger';
      break;
    case 'protein':
      status = value <= 35 ? 'success' : 'warning';
      break;
    default:
      status = 'success';
  }

  if (status === 'success') {
    return (
      <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
        <Check className="w-3 h-3 text-emerald-600" />
      </div>
    );
  }
  if (status === 'warning') {
    return (
      <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center">
        <AlertTriangle className="w-3 h-3 text-amber-600" />
      </div>
    );
  }
  return (
    <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">
      <X className="w-3 h-3 text-red-600" />
    </div>
  );
}

// Dynamic color helpers for progress bars
type ProgressType = 'carbs' | 'fat' | 'protein';

function getProgressColor(type: ProgressType, value: number): string {
  switch (type) {
    case 'carbs':
      // Net Carbs: 0-5g Emerald, 5.1-9g Lime, 9.1-10g Amber
      if (value <= 5) return 'bg-emerald-500';
      if (value <= 9) return 'bg-lime-500';
      return 'bg-amber-500';
    case 'fat':
      // Fat: >75% Emerald, 60-74% Lime, <60% Crimson
      if (value >= 75) return 'bg-emerald-500';
      if (value >= 60) return 'bg-lime-500';
      return 'bg-red-600';
    case 'protein':
      // Protein: <25% Emerald, 25-35% Lime, >35% Amber
      if (value < 25) return 'bg-emerald-500';
      if (value <= 35) return 'bg-lime-500';
      return 'bg-amber-500';
    default:
      return 'bg-muted-foreground';
  }
}

function getTextColor(type: ProgressType, value: number): string {
  switch (type) {
    case 'carbs':
      if (value <= 5) return 'text-emerald-600';
      if (value <= 9) return 'text-lime-600';
      return 'text-amber-600';
    case 'fat':
      if (value >= 75) return 'text-emerald-600';
      if (value >= 60) return 'text-lime-600';
      return 'text-red-600';
    case 'protein':
      if (value < 25) return 'text-emerald-600';
      if (value <= 35) return 'text-lime-600';
      return 'text-amber-600';
    default:
      return 'text-muted-foreground';
  }
}

function ProgressBar({ value, max, type }: { value: number; max: number; type: ProgressType }) {
  const percentage = Math.min((value / max) * 100, 100);
  const colorClass = getProgressColor(type, value);
  
  return (
    <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden border border-slate-300 dark:border-slate-600">
      <div
        className={cn('h-full rounded-full transition-all', colorClass)}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

export function KetoLogicTooltip({ 
  nutrition, 
  children, 
  showScore = false,
  showOptimizer = true,
  className 
}: KetoLogicTooltipProps) {
  const metrics = calculateKetoMetrics(nutrition);

  if (!metrics) {
    return <>{children}</>;
  }

  const { 
    netCarbs, 
    carbLimit, 
    carbsPassed, 
    fatPercent, 
    fatTarget, 
    fatPassed, 
    proteinPercent,
    proteinThreshold,
    ketoScore,
    optimizationTip,
  } = metrics;

  // Build score breakdown message
  const scoreBreakdownParts: string[] = [];
  if (ketoScore.penalties.carbPenalty > 0) {
    scoreBreakdownParts.push(`-${ketoScore.penalties.carbPenalty} for carbs over ${KETO_SCORE_CARB_THRESHOLD}g`);
  }
  if (ketoScore.penalties.proteinPenalty > 0) {
    scoreBreakdownParts.push(`-${ketoScore.penalties.proteinPenalty} for high protein`);
  }
  const scoreBreakdown = scoreBreakdownParts.length > 0 
    ? scoreBreakdownParts.join(', ') 
    : 'No penalties applied';

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn('cursor-help', className)}>
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          align="center"
          className="w-72 p-0 bg-card border border-border shadow-xl"
          sideOffset={8}
        >
          <div className="p-3 space-y-3">
            {/* Header */}
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <Flame className="w-4 h-4 text-success" />
              <span className="font-semibold text-sm">Keto Analysis</span>
              {showScore && (
                <span className={cn(
                  'ml-auto px-2 py-0.5 rounded-full text-xs font-bold',
                  ketoScore.isKeto 
                    ? 'bg-success/20 text-success' 
                    : 'bg-warning/20 text-warning'
                )}>
                  Score: {ketoScore.score}
                </span>
              )}
            </div>

            {/* Carb Status */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusIcon type="carbs" value={netCarbs} />
                  <div className="flex items-center gap-1.5">
                    <Droplets className="w-3.5 h-3.5 text-[hsl(var(--carbs))]" />
                    <span className="text-xs font-medium">Net Carbs</span>
                  </div>
                </div>
                <span className={cn('text-xs font-semibold', getTextColor('carbs', netCarbs))}>
                  {netCarbs.toFixed(1)}g / {carbLimit}g
                </span>
              </div>
              <ProgressBar value={netCarbs} max={carbLimit} type="carbs" />
            </div>

            {/* Fat Fuel */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusIcon type="fat" value={fatPercent} />
                  <div className="flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-[hsl(var(--fat))]" />
                    <span className="text-xs font-medium">Fat Fuel</span>
                  </div>
                </div>
                <span className={cn('text-xs font-semibold', getTextColor('fat', fatPercent))}>
                  {fatPercent}% (≥{fatTarget}%)
                </span>
              </div>
              <ProgressBar value={fatPercent} max={100} type="fat" />
            </div>

            {/* Protein Status (optional warning) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusIcon type="protein" value={proteinPercent} />
                  <div className="flex items-center gap-1.5">
                    <Beef className="w-3.5 h-3.5 text-[hsl(var(--protein))]" />
                    <span className="text-xs font-medium">Protein</span>
                  </div>
                </div>
                <span className={cn('text-xs font-semibold', getTextColor('protein', proteinPercent))}>
                  {proteinPercent}% (≤{proteinThreshold}%)
                </span>
              </div>
              <ProgressBar value={proteinPercent} max={proteinThreshold + 20} type="protein" />
            </div>

            {/* Score Breakdown */}
            <div className="pt-2 border-t border-border">
              <div className="flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-slate-500 mt-0.5 flex-shrink-0" />
                <p className="text-2xs text-muted-foreground leading-relaxed">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Score {ketoScore.score}:</span>{' '}
                  {scoreBreakdown}
                </p>
              </div>
            </div>

            {/* Optimization Tip - Ice Blue/Indigo tint */}
            {showOptimizer && optimizationTip && optimizationTip.priority !== 'low' && (
              <div className="pt-2 border-t border-border">
                <div className="flex items-start gap-2 p-2 rounded-md bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50">
                  <Lightbulb className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-2xs font-semibold text-indigo-700 dark:text-indigo-300 mb-0.5">Optimizer Tip</p>
                    <p className="text-2xs text-muted-foreground leading-relaxed">
                      {optimizationTip.message}
                    </p>
                    {optimizationTip.action?.impact && (
                      <span className="inline-block mt-1 text-2xs font-bold text-indigo-600 dark:text-indigo-400">
                        {optimizationTip.action.impact}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Badge Status */}
            <div className={cn(
              'flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium',
              ketoScore.isKeto 
                ? 'bg-success/10 text-success' 
                : 'bg-warning/10 text-warning'
            )}>
              {ketoScore.isKeto ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Keto Certified</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Not Keto Compliant</span>
                </>
              )}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}