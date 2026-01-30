/**
 * KetoSandbox - Keto Architect: Prescriptive optimization tool
 * 
 * Provides a direct "Path to 100" with:
 * - Auto-Apply recommendations for instant optimization
 * - Smart filtering (no noise from salt/pepper/spices)
 * - Carb-weight sorted ingredients
 * - Prescriptive fat additions with exact calculations
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Target, 
  ChevronDown, 
  ChevronUp, 
  RefreshCw, 
  SlidersHorizontal, 
  Droplets,
  Check,
  Loader2,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { KETO_BADGE_MIN_FAT_PERCENT } from '@/lib/neutron';

import { useKetoSandbox } from './useKetoSandbox';
import { PathToHundred } from './PathToHundred';
import { SwapsList } from './SwapsList';
import { QuantityTweaksList } from './QuantityTweaksList';
import { PrescriptiveAddFat } from './PrescriptiveAddFat';
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
  const [isAutoApplying, setIsAutoApplying] = useState(false);
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
    recommendations,
    fatNeeded,
    toggleSwap,
    updateQuantity,
    resetQuantity,
    toggleAddition,
    updateAdditionQuantity,
    getActiveChanges,
    resetAll,
    autoApplyRecommendations,
  } = useKetoSandbox({ nutrition, ingredients, servings });

  // Count active changes per section
  const swapCount = previewState.swaps.filter(s => s.enabled).length;
  const quantityCount = previewState.quantities.filter(q => q.newQuantity !== q.originalQuantity).length;
  const additionCount = previewState.additions.filter(a => a.enabled).length;
  const totalChanges = swapCount + quantityCount + additionCount;

  // Handle auto-apply with visual feedback
  const handleAutoApply = async () => {
    setIsAutoApplying(true);
    await new Promise(resolve => setTimeout(resolve, 300)); // Brief animation delay
    autoApplyRecommendations();
    setIsAutoApplying(false);
    toast.success('Recommendations applied!', {
      description: 'Review the changes below and commit when ready.',
    });
  };

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
          const ingredient = ingredients.find(i => i.id === qty.ingredientId);
          if (!ingredient) continue;
          
          const originalQtyStr = qty.originalQuantity.toString();
          const newQtyStr = qty.newQuantity.toFixed(1).replace(/\.0$/, '');
          
          for (const step of steps) {
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
      
      const scoreGain = previewNutrition.ketoScore - originalNutrition.ketoScore;
      toast.success('Recipe optimized!', {
        description: scoreGain > 0 
          ? `Score improved by ${scoreGain} points to ${previewNutrition.ketoScore}!`
          : `Applied ${totalChanges} change${totalChanges !== 1 ? 's' : ''}.`,
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

  const isPerfectScore = originalNutrition.ketoScore >= 100;
  const projectedScore = hasChanges ? previewNutrition.ketoScore : originalNutrition.ketoScore;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-indigo-500/10 to-violet-500/5 border border-indigo-500/30 rounded-xl overflow-hidden mb-6"
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500/30 to-violet-500/20 flex items-center justify-center">
            <Target className="w-5 h-5 text-indigo-500" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              Keto Architect
              {totalChanges > 0 && (
                <Badge className="bg-indigo-500 text-white text-2xs">
                  {totalChanges} staged
                </Badge>
              )}
            </h4>
            <p className="text-xs text-muted-foreground">
              {isPerfectScore 
                ? '✨ Perfect 100 score achieved!' 
                : `${100 - originalNutrition.ketoScore} points to perfect score`}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Projected Score Badge */}
          <div className={`px-3 py-1.5 rounded-full text-sm font-bold transition-all ${
            projectedScore >= 100
              ? 'bg-emerald-500 text-white'
              : hasChanges
                ? 'bg-indigo-500 text-white'
                : 'bg-muted text-muted-foreground'
          }`}>
            {projectedScore >= 100 ? '100 ✓' : projectedScore}
          </div>
          <button className="text-muted-foreground hover:text-foreground transition-colors">
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
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
              {/* Path to 100 - Prescriptive Header */}
              <PathToHundred
                currentScore={originalNutrition.ketoScore}
                projectedScore={projectedScore}
                nutrition={originalNutrition}
                recommendations={recommendations}
                onAutoApply={handleAutoApply}
                isApplying={isAutoApplying}
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
                    Adjust
                    {quantityCount > 0 && (
                      <Badge variant="secondary" className="text-2xs h-4 px-1">{quantityCount}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="additions" className="text-xs gap-1">
                    <Droplets className="w-3.5 h-3.5" />
                    Fat
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
                  <PrescriptiveAddFat
                    fatNeeded={fatNeeded}
                    currentFatPercent={originalNutrition.fatPercent}
                    targetFatPercent={KETO_BADGE_MIN_FAT_PERCENT}
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
                    Reset
                  </Button>
                )}
                
                <Button
                  className="flex-1 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white"
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
                      <Sparkles className="w-4 h-4 mr-1.5" />
                      Commit Changes
                      {hasChanges && projectedScore >= 100 && ' → 100'}
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
