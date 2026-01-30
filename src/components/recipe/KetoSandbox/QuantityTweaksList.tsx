/**
 * QuantityTweaksList - Neutron Steppers for adjusting ingredient quantities
 */

import { motion } from 'framer-motion';
import { Minus, Plus, RotateCcw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { QuantityChange } from './types';

interface QuantityTweaksListProps {
  tweaks: QuantityChange[];
  onUpdate: (ingredientId: string, delta: number) => void;
  onReset: (ingredientId: string) => void;
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
        const hasChanged = tweak.percentChange !== 0;
        const displayQty = tweak.newQuantity.toFixed(1).replace(/\.0$/, '');
        const originalQty = tweak.originalQuantity.toFixed(1).replace(/\.0$/, '');
        
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
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground truncate">
                    {tweak.ingredientName}
                  </span>
                  {tweak.isHighCarb && (
                    <Badge variant="outline" className="text-2xs text-destructive border-destructive/50 flex items-center gap-1">
                      <AlertTriangle className="w-2.5 h-2.5" />
                      High Carb
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs ${hasChanged ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                    {originalQty} {tweak.unit || ''}
                  </span>
                  {hasChanged && (
                    <>
                      <span className="text-xs text-muted-foreground">→</span>
                      <span className="text-xs font-medium text-primary">
                        {displayQty} {tweak.unit || ''}
                      </span>
                      <Badge 
                        variant="outline" 
                        className={`text-2xs ${tweak.percentChange < 0 ? 'text-primary border-primary/50' : 'text-destructive border-destructive/50'}`}
                      >
                        {tweak.percentChange > 0 ? '+' : ''}{tweak.percentChange}%
                      </Badge>
                    </>
                  )}
                </div>
              </div>
              
              {/* Neutron Stepper */}
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onUpdate(tweak.ingredientId, -10)}
                  disabled={tweak.percentChange <= -90}
                >
                  <Minus className="w-3.5 h-3.5" />
                </Button>
                
                <div className="w-12 text-center">
                  <span className="text-sm font-medium">
                    {tweak.percentChange >= 0 ? '+' : ''}{tweak.percentChange}%
                  </span>
                </div>
                
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onUpdate(tweak.ingredientId, 10)}
                  disabled={tweak.percentChange >= 100}
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
