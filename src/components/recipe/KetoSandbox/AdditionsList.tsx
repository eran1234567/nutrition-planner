/**
 * AdditionsList - Fat source additions for keto optimization
 */

import { motion } from 'framer-motion';
import { Plus, Minus, Droplets } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { AdditionChange } from './types';
import { FAT_ADDITIONS } from './types';

interface AdditionsListProps {
  additions: AdditionChange[];
  onToggle: (additionId: string) => void;
  onUpdateQuantity: (additionId: string, quantity: number) => void;
}

export function AdditionsList({ additions, onToggle, onUpdateQuantity }: AdditionsListProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-2">
        Add healthy fat sources to reach the 60% fat threshold:
      </p>
      
      {additions.map((addition) => {
        const fatAddition = FAT_ADDITIONS.find(f => f.id === addition.id);
        if (!fatAddition) return null;
        
        return (
          <motion.div
            key={addition.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className={`p-3 rounded-lg border transition-all cursor-pointer ${
              addition.enabled
                ? 'bg-primary/10 border-primary/50'
                : 'bg-background/50 border-border/50 hover:border-primary/30'
            }`}
            onClick={() => onToggle(addition.id)}
          >
            <div className="flex items-center gap-3">
              <Checkbox 
                checked={addition.enabled}
                onCheckedChange={() => onToggle(addition.id)}
                className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-fat" />
                  <span className="text-sm font-medium text-foreground">
                    {addition.name}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">
                    {fatAddition.fatPerUnit}g fat per {addition.unit}
                  </span>
                </div>
              </div>
              
              {/* Quantity stepper */}
              {addition.enabled && (
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
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
              
              {/* Fat addition badge */}
              <div className="flex-shrink-0">
                <Badge className="text-xs bg-fat/20 text-fat border-fat/30">
                  +{Math.round(addition.estimatedFatAddition)}g fat
                </Badge>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
