import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, ArrowRight, Plus, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PlanFlagDetail, SwapSuggestion, AddOnSuggestion } from '@/lib/mealPlanGenerator/types';

interface PlanSuggestionsPanelProps {
  status: 'success' | 'needs_changes';
  flags: PlanFlagDetail[];
  swapSuggestions: SwapSuggestion[];
  addOnSuggestions: AddOnSuggestion[];
  onApplySwap?: (suggestion: SwapSuggestion) => void;
  onApplyAddOn?: (suggestion: AddOnSuggestion) => void;
}

export function PlanSuggestionsPanel({
  status,
  flags,
  swapSuggestions,
  addOnSuggestions,
  onApplySwap,
  onApplyAddOn,
}: PlanSuggestionsPanelProps) {
  if (status === 'success') {
    return null;
  }

  const errorFlags = flags.filter(f => f.severity === 'error');
  const warningFlags = flags.filter(f => f.severity === 'warning');

  return (
    <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <span className="text-amber-700 dark:text-amber-400">Plan Needs Adjustments</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Flags */}
        <div className="flex flex-wrap gap-1.5">
          {errorFlags.map((flag, i) => (
            <Badge
              key={`error-${i}`}
              variant="destructive"
              className="text-xs"
            >
              {flag.message}
            </Badge>
          ))}
          {warningFlags.map((flag, i) => (
            <Badge
              key={`warning-${i}`}
              variant="outline"
              className="text-xs border-amber-300 text-amber-700 dark:text-amber-400"
            >
              {flag.message}
            </Badge>
          ))}
        </div>

        {/* Swap Suggestions */}
        {swapSuggestions.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-primary" />
              Recipe Swap Suggestions
            </h4>
            <div className="space-y-2">
              {swapSuggestions.slice(0, 3).map((suggestion, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 p-2 rounded-lg bg-background border text-sm"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="truncate">{suggestion.removeRecipeName}</span>
                      <ArrowRight className="w-3 h-3 flex-shrink-0" />
                      <span className="font-medium text-foreground truncate">
                        {suggestion.suggestedRecipeName}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {suggestion.reason}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onApplySwap?.(suggestion)}
                    className="flex-shrink-0"
                  >
                    Swap
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add-On Suggestions */}
        {addOnSuggestions.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-primary" />
              Add-On Suggestions
            </h4>
            <div className="flex flex-wrap gap-2">
              {addOnSuggestions.slice(0, 4).map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => onApplyAddOn?.(suggestion)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg",
                    "bg-background border hover:border-primary/50 transition-colors",
                    "text-sm"
                  )}
                >
                  <span>{suggestion.emoji}</span>
                  <div className="text-left">
                    <div className="font-medium">
                      {suggestion.suggestedQuantity} {suggestion.unit} {suggestion.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {suggestion.reason}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
