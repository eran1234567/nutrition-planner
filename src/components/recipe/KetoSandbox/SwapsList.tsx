/**
 * SwapsList - Smart swap suggestions for keto optimization
 */

import { motion } from 'framer-motion';
import { RefreshCw, ArrowRight, Check } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import type { SwapChange } from './types';

interface SwapsListProps {
  swapSuggestions: SwapChange[];
  enabledSwaps: SwapChange[];
  onToggle: (ingredientId: string) => void;
}

export function SwapsList({ swapSuggestions, enabledSwaps, onToggle }: SwapsListProps) {
  if (swapSuggestions.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        No swap suggestions available for this recipe.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {swapSuggestions.map((swap) => {
        const isEnabled = enabledSwaps.some(s => s.ingredientId === swap.ingredientId);
        
        return (
          <motion.div
            key={swap.ingredientId}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className={`p-3 rounded-lg border transition-all cursor-pointer ${
              isEnabled
                ? 'bg-primary/10 border-primary/50'
                : 'bg-background/50 border-border/50 hover:border-primary/30'
            }`}
            onClick={() => onToggle(swap.ingredientId)}
          >
            <div className="flex items-center gap-3">
              <Checkbox 
                checked={isEnabled}
                onCheckedChange={() => onToggle(swap.ingredientId)}
                className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground line-through truncate">
                    {swap.originalName}
                  </span>
                  <ArrowRight className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-sm font-medium text-foreground truncate">
                    {swap.newName}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-2xs">{swap.category}</Badge>
                  <span className="text-xs text-muted-foreground truncate">{swap.reason}</span>
                </div>
              </div>
              
              <div className="flex-shrink-0">
                <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">
                  −{swap.estimatedCarbReduction}g
                </span>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
