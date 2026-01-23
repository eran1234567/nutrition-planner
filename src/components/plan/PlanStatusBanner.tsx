import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PlanStatus, PlanFlagDetail } from '@/lib/mealPlanGenerator/types';

interface PlanStatusBannerProps {
  status: PlanStatus;
  flags: PlanFlagDetail[];
  className?: string;
}

export function PlanStatusBanner({ status, flags, className }: PlanStatusBannerProps) {
  const errorCount = flags.filter(f => f.severity === 'error').length;
  const warningCount = flags.filter(f => f.severity === 'warning').length;

  if (status === 'success' && errorCount === 0 && warningCount === 0) {
    return (
      <div className={cn(
        "flex items-center gap-2 p-3 rounded-xl",
        "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800",
        className
      )}>
        <CheckCircle className="w-5 h-5 text-emerald-600" />
        <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
          Plan meets your nutrition targets
        </span>
      </div>
    );
  }

  if (status === 'needs_changes' || errorCount > 0) {
    return (
      <div className={cn(
        "flex items-center gap-2 p-3 rounded-xl",
        "bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800",
        className
      )}>
        <AlertTriangle className="w-5 h-5 text-amber-600" />
        <div className="flex-1">
          <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
            Plan needs adjustments
          </span>
          <div className="flex gap-1.5 mt-1">
            {errorCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {errorCount} issue{errorCount > 1 ? 's' : ''}
              </Badge>
            )}
            {warningCount > 0 && (
              <Badge variant="outline" className="text-xs border-amber-300 text-amber-700">
                {warningCount} warning{warningCount > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Warnings only
  if (warningCount > 0) {
    return (
      <div className={cn(
        "flex items-center gap-2 p-3 rounded-xl",
        "bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800",
        className
      )}>
        <AlertTriangle className="w-5 h-5 text-yellow-600" />
        <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
          {warningCount} warning{warningCount > 1 ? 's' : ''} - plan may not perfectly match targets
        </span>
      </div>
    );
  }

  return null;
}
