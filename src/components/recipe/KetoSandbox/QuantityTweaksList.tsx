/**
 * QuantityTweaksList - Context-Aware Steppers for adjusting ingredient quantities
 * Uses human-friendly units (slices, cups, etc.) instead of percentages
 */

import { motion } from 'framer-motion';
import { Minus, Plus, RotateCcw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { QuantityChange } from './types';
import { AVOCADO_OPTIONS } from './types';

interface QuantityTweaksListProps {
  tweaks: QuantityChange[];
  onUpdate: (ingredientId: string, direction: 'up' | 'down') => void;
  onReset: (ingredientId: string) => void;
}

// Format quantity for display based on increment type
function formatQuantity(qty: number, unit: string | null, incrementType: string): string {
  const unitStr = unit || '';
  
  // Handle fractions for avocado
  if (incrementType === 'avocado') {
    if (qty === 0) return '0';
    if (qty === 0.25) return '¼';
    if (qty === 0.5) return '½';
    if (qty === 0.75) return '¾';
    if (qty === 1) return '1';
    return qty.toString();
  }
  
  // Handle fractions for cups
  if (incrementType === 'liquid-cup') {
    const wholePart = Math.floor(qty);
    const fraction = qty - wholePart;
    let fractionStr = '';
    if (Math.abs(fraction - 0.25) < 0.01) fractionStr = '¼';
    else if (Math.abs(fraction - 0.5) < 0.01) fractionStr = '½';
    else if (Math.abs(fraction - 0.75) < 0.01) fractionStr = '¾';
    
    if (wholePart === 0) return `${fractionStr} ${unitStr}`.trim();
    if (fractionStr) return `${wholePart}${fractionStr} ${unitStr}`.trim();
    return `${wholePart} ${unitStr}`.trim();
  }
  
  // Handle countables - show whole numbers
  if (incrementType === 'countable') {
    return `${Math.round(qty)} ${unitStr}`.trim();
  }
  
  // Default: show decimal
  const displayQty = Number.isInteger(qty) ? qty.toString() : qty.toFixed(1).replace(/\.0$/, '');
  return `${displayQty} ${unitStr}`.trim();
}

export function QuantityTweaksList({ tweaks, onUpdate, onReset }: QuantityTweaksListProps) {
  if (tweaks.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        No ingredients with quantities to adjust.
      </div>
    );
  }

  // Sort: high-carb items first (suggested reductions)
  const sortedTweaks = [...tweaks].sort((a, b) => {
    if (a.isHighCarb && !b.isHighCarb) return -1;
    if (!a.isHighCarb && b.isHighCarb) return 1;
    return a.ingredientName.localeCompare(b.ingredientName);
  });

  return (
    <div className="space-y-2">
      {sortedTweaks.map((tweak) => {
        const hasChanged = tweak.newQuantity !== tweak.originalQuantity;
        const displayQty = formatQuantity(tweak.newQuantity, tweak.unit, tweak.incrementType);
        const originalDisplay = formatQuantity(tweak.originalQuantity, tweak.unit, tweak.incrementType);
        
        // Calculate carb change for high-carb items
        const unitDelta = tweak.newQuantity - tweak.originalQuantity;
        const carbChange = unitDelta * tweak.carbsPerUnit;
        
        // Check if we can decrease more (for avocado, check options)
        const canDecrease = tweak.incrementType === 'avocado'
          ? AVOCADO_OPTIONS.indexOf(tweak.newQuantity) > 0
          : tweak.newQuantity > (tweak.incrementType === 'countable' ? 1 : 0.1);
        
        // Check if we can increase (max 3x original)
        const canIncrease = tweak.newQuantity < tweak.originalQuantity * 3;
        
        return (
          <motion.div
            key={tweak.ingredientId}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className={`p-3 rounded-lg border transition-all ${
              hasChanged
                ? 'bg-primary/5 border-primary/30'
                : tweak.isHighCarb
                  ? 'bg-destructive/5 border-destructive/30'
                  : 'bg-background/50 border-border/50'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground truncate">
                    {tweak.ingredientName}
                  </span>
                  {tweak.isHighCarb && (
                    <Badge variant="outline" className="text-2xs text-destructive border-destructive/50 flex items-center gap-1 shrink-0">
                      <AlertTriangle className="w-2.5 h-2.5" />
                      High Carb
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`text-xs ${hasChanged ? 'text-muted-foreground line-through' : 'text-foreground font-medium'}`}>
                    {originalDisplay}
                  </span>
                  {hasChanged && (
                    <>
                      <span className="text-xs text-muted-foreground">→</span>
                      <span className="text-xs font-medium text-primary">
                        {displayQty}
                      </span>
                      {tweak.isHighCarb && carbChange !== 0 && (
                        <Badge 
                          variant="outline" 
                          className={`text-2xs ${carbChange < 0 ? 'text-primary border-primary/50' : 'text-destructive border-destructive/50'}`}
                        >
                          {carbChange > 0 ? '+' : ''}{carbChange.toFixed(1)}g carbs
                        </Badge>
                      )}
                    </>
                  )}
                </div>
                
                {/* Show per-unit carb info for high-carb items */}
                {tweak.isHighCarb && !hasChanged && (
                  <p className="text-2xs text-muted-foreground mt-1">
                    ~{tweak.carbsPerUnit}g net carbs per {tweak.unit || 'unit'}
                  </p>
                )}
              </div>
              
              {/* Context-Aware Stepper */}
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onUpdate(tweak.ingredientId, 'down')}
                  disabled={!canDecrease}
                >
                  <Minus className="w-3.5 h-3.5" />
                </Button>
                
                <div className="min-w-[3.5rem] text-center px-1">
                  <span className="text-sm font-medium">
                    {displayQty}
                  </span>
                </div>
                
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onUpdate(tweak.ingredientId, 'up')}
                  disabled={!canIncrease}
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
                
                {hasChanged && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => onReset(tweak.ingredientId)}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
