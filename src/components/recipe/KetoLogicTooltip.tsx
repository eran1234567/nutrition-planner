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

function StatusIcon({ passed, warning }: { passed: boolean; warning?: boolean }) {
  if (passed) {
    return (
      <div className="w-5 h-5 rounded-full bg-success/20 flex items-center justify-center">
        <Check className="w-3 h-3 text-success" />
      </div>
    );
  }
  if (warning) {
    return (
      <div className="w-5 h-5 rounded-full bg-warning/20 flex items-center justify-center">
        <AlertTriangle className="w-3 h-3 text-warning" />
      </div>
    );
  }
  return (
    <div className="w-5 h-5 rounded-full bg-destructive/20 flex items-center justify-center">
      <X className="w-3 h-3 text-destructive" />
    </div>
  );
}

function ProgressBar({ value, max, passed }: { value: number; max: number; passed: boolean }) {
  const percentage = Math.min((value / max) * 100, 100);
  
  return (
    <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
      <div
        className={cn(
          'h-full rounded-full transition-all',
          passed ? 'bg-success' : 'bg-warning'
        )}
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
                  <StatusIcon passed={carbsPassed} />
                  <div className="flex items-center gap-1.5">
                    <Droplets className="w-3.5 h-3.5 text-[hsl(var(--carbs))]" />
                    <span className="text-xs font-medium">Net Carbs</span>
                  </div>
                </div>
                <span className={cn(
                  'text-xs font-semibold',
                  carbsPassed ? 'text-success' : 'text-warning'
                )}>
                  {netCarbs.toFixed(1)}g / {carbLimit}g
                </span>
              </div>
              <ProgressBar value={netCarbs} max={carbLimit} passed={carbsPassed} />
            </div>

            {/* Fat Fuel */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusIcon passed={fatPassed} />
                  <div className="flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-[hsl(var(--fat))]" />
                    <span className="text-xs font-medium">Fat Fuel</span>
                  </div>
                </div>
                <span className={cn(
                  'text-xs font-semibold',
                  fatPassed ? 'text-success' : 'text-warning'
                )}>
                  {fatPercent}% (≥{fatTarget}%)
                </span>
              </div>
              <ProgressBar value={fatPercent} max={100} passed={fatPassed} />
            </div>

            {/* Protein Status (optional warning) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusIcon 
                    passed={proteinPercent <= proteinThreshold} 
                    warning={proteinPercent > proteinThreshold}
                  />
                  <div className="flex items-center gap-1.5">
                    <Beef className="w-3.5 h-3.5 text-[hsl(var(--protein))]" />
                    <span className="text-xs font-medium">Protein</span>
                  </div>
                </div>
                <span className={cn(
                  'text-xs font-semibold',
                  proteinPercent <= proteinThreshold ? 'text-success' : 'text-warning'
                )}>
                  {proteinPercent}% (≤{proteinThreshold}%)
                </span>
              </div>
              <ProgressBar 
                value={proteinPercent} 
                max={proteinThreshold + 20} 
                passed={proteinPercent <= proteinThreshold} 
              />
            </div>

            {/* Score Breakdown */}
            <div className="pt-2 border-t border-border">
              <div className="flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <p className="text-2xs text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground">Score {ketoScore.score}:</span>{' '}
                  {scoreBreakdown}
                </p>
              </div>
            </div>

            {/* Optimization Tip */}
            {showOptimizer && optimizationTip && optimizationTip.priority !== 'low' && (
              <div className="pt-2 border-t border-border">
                <div className="flex items-start gap-2 p-2 rounded-md bg-primary/5">
                  <Lightbulb className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-2xs font-semibold text-primary mb-0.5">Optimizer Tip</p>
                    <p className="text-2xs text-muted-foreground leading-relaxed">
                      {optimizationTip.message}
                    </p>
                    {optimizationTip.action?.impact && (
                      <span className="inline-block mt-1 text-2xs font-medium text-success">
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