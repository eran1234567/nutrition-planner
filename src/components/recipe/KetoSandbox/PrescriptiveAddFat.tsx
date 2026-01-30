/**
 * PrescriptiveAddFat - Calculated fat additions for perfect keto ratio
 * Shows exactly how much fat is needed, not a general list
 */

import { motion } from 'framer-motion';
import { Plus, Minus, Check, Droplets } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { AdditionChange } from './types';
import { FAT_ADDITIONS } from './types';
import { CALORIES_PER_GRAM } from '@/lib/neutron';

interface PrescriptiveAddFatProps {
  fatNeeded: number; // grams of fat needed to reach target
  currentFatPercent: number;
  targetFatPercent: number;
  additions: AdditionChange[];
  onToggle: (additionId: string) => void;
  onUpdateQuantity: (additionId: string, quantity: number) => void;
}

// Top 3 recommended fat sources
const RECOMMENDED_FATS = ['olive-oil', 'butter', 'coconut-oil'];

export function PrescriptiveAddFat({
  fatNeeded,
  currentFatPercent,
  targetFatPercent,
  additions,
  onToggle,
  onUpdateQuantity,
}: PrescriptiveAddFatProps) {
  // If no fat needed, show success state
  if (fatNeeded <= 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="py-6 text-center"
      >
        <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
          <Check className="w-6 h-6 text-emerald-500" />
        </div>
        <h4 className="text-sm font-semibold text-foreground mb-1">
          Fat Ratio Achieved!
        </h4>
        <p className="text-xs text-muted-foreground">
          Currently at {currentFatPercent}% fat fuel (target: {targetFatPercent}%)
        </p>
      </motion.div>
    );
  }

  // Calculate fat added from enabled additions
  const enabledAdditions = additions.filter(a => a.enabled);
  const totalFatAdded = enabledAdditions.reduce((sum, a) => sum + a.estimatedFatAddition, 0);
  const remainingFatNeeded = Math.max(0, fatNeeded - totalFatAdded);

  // Filter to recommended fats and sort by efficiency
  const recommendedAdditions = additions
    .filter(a => RECOMMENDED_FATS.includes(a.id))
    .sort((a, b) => {
      const fatA = FAT_ADDITIONS.find(f => f.id === a.id)?.fatPerUnit || 0;
      const fatB = FAT_ADDITIONS.find(f => f.id === b.id)?.fatPerUnit || 0;
      return fatB - fatA; // Higher fat per unit first
    });

  return (
    <div className="space-y-4">
      {/* Header with calculation */}
      <div className="p-3 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/5 border border-amber-500/30">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Droplets className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              Fat Calculator
            </span>
          </div>
          <Badge
            variant="outline"
            className={`text-xs ${
              remainingFatNeeded <= 0
                ? 'border-emerald-400 text-emerald-600'
                : 'border-amber-400 text-amber-600'
            }`}
          >
            {remainingFatNeeded <= 0 ? '✓ Target Met' : `${Math.round(remainingFatNeeded)}g needed`}
          </Badge>
        </div>
        <p className="text-xs text-amber-700/80 dark:text-amber-300/80">
          Add <span className="font-semibold">{Math.round(fatNeeded)}g fat</span> to reach{' '}
          {targetFatPercent}% fat fuel. Pick one:
        </p>
      </div>

      {/* Recommended additions */}
      <div className="space-y-2">
        {recommendedAdditions.map((addition) => {
          const fatAddition = FAT_ADDITIONS.find(f => f.id === addition.id);
          if (!fatAddition) return null;

          // Calculate how much of this fat is needed to meet the goal
          const unitsNeeded = Math.ceil(fatNeeded / fatAddition.fatPerUnit);
          const suggestedQuantity = Math.max(1, unitsNeeded);

          return (
            <motion.div
              key={addition.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={`p-3 rounded-lg border transition-all cursor-pointer ${
                addition.enabled
                  ? 'bg-fat/10 border-fat/50 ring-1 ring-fat/30'
                  : 'bg-background/50 border-border/50 hover:border-fat/30'
              }`}
              onClick={() => {
                if (!addition.enabled) {
                  // When enabling, set to suggested quantity
                  onToggle(addition.id);
                  onUpdateQuantity(addition.id, suggestedQuantity);
                } else {
                  onToggle(addition.id);
                }
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      addition.enabled ? 'bg-fat/20' : 'bg-muted'
                    }`}
                  >
                    {addition.enabled ? (
                      <Check className="w-4 h-4 text-fat" />
                    ) : (
                      <Droplets className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <span className="text-sm font-medium text-foreground">
                      {addition.name}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {suggestedQuantity} {addition.unit} = +{Math.round(suggestedQuantity * fatAddition.fatPerUnit)}g fat
                    </p>
                  </div>
                </div>

                {/* Quantity stepper when enabled */}
                {addition.enabled && (
                  <div
                    className="flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onUpdateQuantity(addition.id, addition.quantity - 0.5)}
                      disabled={addition.quantity <= 0.5}
                    >
                      <Minus className="w-3 h-3" />
                    </Button>

                    <div className="w-14 text-center">
                      <span className="text-sm font-medium">
                        {addition.quantity} {addition.unit}
                      </span>
                    </div>

                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onUpdateQuantity(addition.id, addition.quantity + 0.5)}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                )}

                {!addition.enabled && (
                  <Badge className="text-xs bg-fat/20 text-fat border-fat/30">
                    +{Math.round(suggestedQuantity * fatAddition.fatPerUnit)}g
                  </Badge>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Progress indicator */}
      {totalFatAdded > 0 && (
        <div className="pt-2 border-t border-border/50">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Fat added:</span>
            <span className="font-medium text-fat">+{Math.round(totalFatAdded)}g</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full mt-1.5 overflow-hidden">
            <div
              className="h-full bg-fat rounded-full transition-all"
              style={{ width: `${Math.min(100, (totalFatAdded / fatNeeded) * 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
