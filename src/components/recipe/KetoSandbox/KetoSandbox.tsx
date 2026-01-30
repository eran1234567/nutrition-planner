/**
 * KetoSandbox - Multi-action keto optimization component
 * 
 * Provides a unified interface for:
 * - Smart Swaps: Replace high-carb ingredients with keto alternatives
 * - Quantity Tweaks: Adjust ingredient amounts in 10% increments
 * - Fat Additions: Add healthy fat sources to meet keto thresholds
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, 
  ChevronDown, 
  ChevronUp, 
  RefreshCw, 
  SlidersHorizontal, 
  Droplets,
  Check,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

import { useKetoSandbox } from './useKetoSandbox';
import { KetoAnalysisPreview } from './KetoAnalysisPreview';
import { SwapsList } from './SwapsList';
import { QuantityTweaksList } from './QuantityTweaksList';
import { AdditionsList } from './AdditionsList';
import type { KetoSandboxProps } from './types';

export function KetoSandbox({ 
  recipeId, 
  nutrition, 
  ingredients, 
  steps,
  servings,
  onCommit 
}: KetoSandboxProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [activeTab, setActiveTab] = useState('swaps');
  const queryClient = useQueryClient();

  const {
    swapSuggestions,
    quantityTweaks,
    availableAdditions,
    previewState,
    previewNutrition,
    originalNutrition,
    hasChanges,
    toggleSwap,
    updateQuantity,
    resetQuantity,
    toggleAddition,
    updateAdditionQuantity,
    getActiveChanges,
    resetAll,
  } = useKetoSandbox({ nutrition, ingredients, servings });

  // Count active changes per section
  const swapCount = previewState.swaps.filter(s => s.enabled).length;
  const quantityCount = previewState.quantities.filter(q => q.newQuantity !== q.originalQuantity).length;
  const additionCount = previewState.additions.filter(a => a.enabled).length;
  const totalChanges = swapCount + quantityCount + additionCount;

  // Commit all changes to database
  const handleCommit = async () => {
    if (!hasChanges) return;
    
    setIsCommitting(true);
    
    try {
      const changes = getActiveChanges();
      
      // 1. Apply swaps - update ingredient names
      for (const swap of changes.swaps) {
        await supabase
          .from('recipe_ingredients')
          .update({ name: swap.newName })
          .eq('id', swap.ingredientId);
      }
      
      // 2. Apply quantity changes
      for (const qty of changes.quantities) {
        await supabase
          .from('recipe_ingredients')
          .update({ quantity: qty.newQuantity })
          .eq('id', qty.ingredientId);
      }
      
      // 3. Add new ingredients for fat additions
      for (const addition of changes.additions) {
        const maxOrderIndex = Math.max(...ingredients.map(i => i.order_index ?? 0), 0);
        await supabase
          .from('recipe_ingredients')
          .insert({
            recipe_id: recipeId,
            name: addition.name,
            quantity: addition.quantity,
            unit: addition.unit,
            order_index: maxOrderIndex + 1,
          });
      }
      
      // 4. Auto-sync instructions for quantity changes
      if (changes.quantities.length > 0) {
        for (const qty of changes.quantities) {
          // Find steps that mention this ingredient quantity
          const ingredient = ingredients.find(i => i.id === qty.ingredientId);
          if (!ingredient) continue;
          
          const originalQtyStr = qty.originalQuantity.toString();
          const newQtyStr = qty.newQuantity.toFixed(1).replace(/\.0$/, '');
          
          for (const step of steps) {
            // Simple regex to find quantity mentions (e.g., "Add 4 slices" -> "Add 2 slices")
            const patterns = [
              new RegExp(`\\b${originalQtyStr}\\s*(${ingredient.unit || ''})\\s+${ingredient.name.split(' ')[0]}`, 'gi'),
              new RegExp(`\\b${originalQtyStr}\\s+${ingredient.name.split(' ')[0]}`, 'gi'),
            ];
            
            let updatedInstruction = step.instruction;
            let wasUpdated = false;
            
            for (const pattern of patterns) {
              if (pattern.test(updatedInstruction)) {
                updatedInstruction = updatedInstruction.replace(pattern, (match) => {
                  return match.replace(originalQtyStr, newQtyStr);
                });
                wasUpdated = true;
              }
            }
            
            if (wasUpdated) {
              await supabase
                .from('recipe_steps')
                .update({ instruction: updatedInstruction })
                .eq('id', step.id);
            }
          }
        }
      }
      
      // 5. Recalculate nutrition
      await recalculateNutrition();
      
      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({ queryKey: ['recipe', recipeId] });
      
      toast.success('Recipe optimized!', {
        description: `Applied ${totalChanges} change${totalChanges !== 1 ? 's' : ''} for keto compliance.`,
      });
      
      resetAll();
      onCommit();
      
    } catch (error) {
      console.error('Failed to commit changes:', error);
      toast.error('Failed to apply changes', {
        description: 'Please try again.',
      });
    } finally {
      setIsCommitting(false);
    }
  };

  // Recalculate nutrition via edge function
  const recalculateNutrition = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) return;
      
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recalculate-nutrition`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.session.access_token}`,
          },
          body: JSON.stringify({ recipeId }),
        }
      );
    } catch (error) {
      console.error('Nutrition recalculation failed:', error);
    }
  };

  // Don't render if no suggestions at all
  if (swapSuggestions.length === 0 && quantityTweaks.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/30 rounded-xl overflow-hidden mb-6"
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              Keto Sandbox
              {totalChanges > 0 && (
                <Badge className="bg-primary text-primary-foreground text-2xs">
                  {totalChanges} active
                </Badge>
              )}
            </h4>
            <p className="text-xs text-muted-foreground">
              Optimize ingredients to reach keto compliance
            </p>
          </div>
        </div>
        <button className="text-muted-foreground hover:text-foreground transition-colors">
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4">
              {/* Keto Analysis Preview */}
              <KetoAnalysisPreview
                original={originalNutrition}
                preview={previewNutrition}
                hasChanges={hasChanges}
              />

              {/* Optimization Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="swaps" className="text-xs gap-1">
                    <RefreshCw className="w-3.5 h-3.5" />
                    Swaps
                    {swapCount > 0 && (
                      <Badge variant="secondary" className="text-2xs h-4 px-1">{swapCount}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="quantities" className="text-xs gap-1">
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    Quantities
                    {quantityCount > 0 && (
                      <Badge variant="secondary" className="text-2xs h-4 px-1">{quantityCount}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="additions" className="text-xs gap-1">
                    <Droplets className="w-3.5 h-3.5" />
                    Add Fat
                    {additionCount > 0 && (
                      <Badge variant="secondary" className="text-2xs h-4 px-1">{additionCount}</Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="swaps" className="mt-3">
                  <SwapsList
                    swapSuggestions={swapSuggestions}
                    enabledSwaps={previewState.swaps.filter(s => s.enabled)}
                    onToggle={toggleSwap}
                  />
                </TabsContent>

                <TabsContent value="quantities" className="mt-3">
                  <QuantityTweaksList
                    tweaks={quantityTweaks}
                    onUpdate={updateQuantity}
                    onReset={resetQuantity}
                  />
                </TabsContent>

                <TabsContent value="additions" className="mt-3">
                  <AdditionsList
                    additions={availableAdditions}
                    onToggle={toggleAddition}
                    onUpdateQuantity={updateAdditionQuantity}
                  />
                </TabsContent>
              </Tabs>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-3 border-t border-border/50">
                {hasChanges && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetAll}
                    className="text-muted-foreground"
                  >
                    <RotateCcw className="w-4 h-4 mr-1.5" />
                    Reset All
                  </Button>
                )}
                
                <Button
                  className="flex-1 gradient-primary"
                  size="sm"
                  onClick={handleCommit}
                  disabled={!hasChanges || isCommitting}
                >
                  {isCommitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                      Applying...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-1.5" />
                      Apply & Commit Changes
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
