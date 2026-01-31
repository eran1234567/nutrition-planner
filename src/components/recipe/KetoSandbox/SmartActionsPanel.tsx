/**
 * SmartActionsPanel - Vertical stack layout for keto optimization actions
 * Row 1: Icon + Description (full width)
 * Row 2: Score Badge + Apply Button
 */

import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowRightLeft, 
  ArrowDown, 
  Droplets, 
  Trash2,
  Check,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { SmartAction } from './SmartActionTypes';

interface SmartActionsPanelProps {
  actions: SmartAction[];
  onApplyAction: (action: SmartAction) => void;
  appliedActionIds: Set<string>;
  isApplying: string | null;
}

const ACTION_ICONS = {
  swap: ArrowRightLeft,
  reduce: ArrowDown,
  remove: Trash2,
  add_fat: Droplets,
};

const ACTION_COLORS = {
  swap: 'text-violet-500',
  reduce: 'text-amber-500',
  remove: 'text-rose-500',
  add_fat: 'text-sky-500',
};

export function SmartActionsPanel({
  actions,
  onApplyAction,
  appliedActionIds,
  isApplying,
}: SmartActionsPanelProps) {
  if (actions.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground text-sm">
        No optimization actions available
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header - simplified, no projected badge */}
      <h4 className="text-sm font-bold text-foreground">
        Path to 100: Recommended Actions
      </h4>

      {/* Action Cards - Vertical Stack Layout */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {actions.map((action, idx) => {
            const Icon = ACTION_ICONS[action.type];
            const iconColor = ACTION_COLORS[action.type];
            const isApplied = appliedActionIds.has(action.id);
            const isCurrentlyApplying = isApplying === action.id;

            return (
              <motion.div
                key={action.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20, height: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`
                  relative p-3 rounded-lg border transition-all
                  ${action.isPerfectFix && !isApplied
                    ? 'bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/30'
                    : isApplied
                      ? 'bg-muted/50 border-border/50 opacity-60'
                      : 'bg-card border-border hover:border-indigo-400/50 hover:bg-indigo-500/5'
                  }
                `}
              >
                {/* Perfect Fix Label */}
                {action.isPerfectFix && !isApplied && (
                  <div className="absolute -top-2 left-3 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-2xs font-bold">
                    Perfect Fix
                  </div>
                )}

                {/* Row 1: Icon + Full-width Description */}
                <div className="flex items-start gap-3 mb-3">
                  <div className={`
                    w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0
                    ${action.isPerfectFix && !isApplied
                      ? 'bg-emerald-500/20'
                      : 'bg-muted'
                    }
                  `}>
                    <Icon className={`w-4 h-4 ${isApplied ? 'text-muted-foreground' : iconColor}`} />
                  </div>
                  
                  <div className="flex-1">
                    <p className={`text-sm font-medium leading-relaxed ${isApplied ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                      {action.title}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                      {action.description}
                    </p>
                  </div>
                </div>

                {/* Row 2: Score Badge + Apply Button */}
                <div className="flex items-center justify-between pl-12">
                  <Badge 
                    variant="outline" 
                    className={`
                      text-xs font-bold
                      ${isApplied 
                        ? 'text-muted-foreground border-border'
                        : action.isPerfectFix
                          ? 'text-emerald-600 border-emerald-400/50 bg-emerald-500/10'
                          : 'text-indigo-600 dark:text-indigo-400 border-indigo-400/50'
                      }
                    `}
                  >
                    +{action.scoreImpact} pts
                  </Badge>

                  <Button
                    size="sm"
                    variant={isApplied ? 'ghost' : action.isPerfectFix ? 'default' : 'secondary'}
                    disabled={isApplied || isCurrentlyApplying}
                    onClick={() => onApplyAction(action)}
                    className={`
                      min-w-[80px]
                      ${action.isPerfectFix && !isApplied
                        ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                        : ''
                      }
                    `}
                  >
                    {isCurrentlyApplying ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isApplied ? (
                      <>
                        <Check className="w-4 h-4 mr-1" />
                        Done
                      </>
                    ) : (
                      'Apply'
                    )}
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
