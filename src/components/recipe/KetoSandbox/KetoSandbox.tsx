/**
 * KetoArchitect - Prescriptive Keto Optimization Tool
 * 
 * Features:
 * - Smart Actions with gap calculations
 * - Zero-Quantity Flavor Guard with swap pivots
 * - Flat UI with action cards and Apply buttons
 * - Celebration state with confetti when reaching 100
 * - Undo support with snapshot restore
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Target, 
  ChevronDown, 
  ChevronUp, 
  Loader2,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

import { useKetoSandbox } from './useKetoSandbox';
import { SmartActionsPanel } from './SmartActionsPanel';
import { CelebrationState } from './CelebrationState';
import { generateSmartActions, type SmartAction } from './SmartActionTypes';
import type { KetoSandboxProps } from './types';

// Snapshot for undo functionality
interface UndoSnapshot {
  ingredients: Array<{ id: string; name: string; quantity: number | null; unit: string | null }>;
  nutrition: {
    calories: number | null;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
    fiber_g: number | null;
  } | null;
}

// Helper to detect countable units
function isCountableUnit(unit: string | null, name: string): boolean {
  const lowerUnit = (unit || '').toLowerCase();
  const lowerName = name.toLowerCase();
  return ['fillet', 'fillets', 'slice', 'slices', 'piece', 'pieces', 
    'egg', 'eggs', 'strip', 'strips', 'breast', 'breasts', 'thigh', 'thighs',
    'drumstick', 'drumsticks', 'wing', 'wings', 'patty', 'patties'].some(
    u => lowerUnit.includes(u) || lowerName.includes(u)
  );
}

// Helper to round quantities properly
function roundQuantity(quantity: number, isCountable: boolean): number {
  if (isCountable) {
    // Round to nearest 0.5 for countables, minimum 1
    return Math.max(1, Math.round(quantity * 2) / 2);
  }
  // Round to nearest 0.25 for other units
  return Math.max(0.25, Math.round(quantity * 4) / 4);
}

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
  const [applyingActionId, setApplyingActionId] = useState<string | null>(null);
  const [appliedActionIds, setAppliedActionIds] = useState<Set<string>>(new Set());
  const [showCelebration, setShowCelebration] = useState(false);
  const queryClient = useQueryClient();
  
  // Undo snapshot reference
  const undoSnapshotRef = useRef<UndoSnapshot | null>(null);

  const {
    previewState,
    previewNutrition,
    originalNutrition,
    hasChanges,
    toggleSwap,
    updateQuantity,
    toggleAddition,
    updateAdditionQuantity,
    getActiveChanges,
    resetAll,
  } = useKetoSandbox({ nutrition, ingredients, servings });

  // Generate Smart Actions based on current nutrition
  const smartActions = useMemo(() => {
    return generateSmartActions(originalNutrition, ingredients, servings);
  }, [originalNutrition, ingredients, servings]);

  // Calculate projected score including staged changes
  const projectedScore = useMemo(() => {
    if (hasChanges) {
      return previewNutrition.ketoScore;
    }
    return originalNutrition.ketoScore;
  }, [hasChanges, previewNutrition, originalNutrition]);

  // Check for celebration trigger
  useEffect(() => {
    if (projectedScore >= 100 && hasChanges && !showCelebration) {
      setShowCelebration(true);
    } else if (projectedScore < 100) {
      setShowCelebration(false);
    }
  }, [projectedScore, hasChanges, showCelebration]);

  // Create snapshot before any changes
  const createSnapshot = useCallback((): UndoSnapshot => {
    return {
      ingredients: ingredients.map(ing => ({
        id: ing.id,
        name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit,
      })),
      nutrition: nutrition ? {
        calories: nutrition.calories ?? null,
        protein_g: nutrition.protein_g ?? null,
        carbs_g: nutrition.carbs_g ?? null,
        fat_g: nutrition.fat_g ?? null,
        fiber_g: nutrition.fiber_g ?? null,
      } : null,
    };
  }, [ingredients, nutrition]);

  // Handle applying a single Smart Action
  const handleApplyAction = useCallback(async (action: SmartAction) => {
    setApplyingActionId(action.id);
    
    // Create snapshot before applying
    undoSnapshotRef.current = createSnapshot();
    
    // Small delay for visual feedback
    await new Promise(resolve => setTimeout(resolve, 200));

    try {
      switch (action.type) {
        case 'swap':
          if (action.ingredientId && action.swapTo) {
            toggleSwap(action.ingredientId);
          }
          break;

        case 'reduce':
          if (action.ingredientId && action.newQuantity !== undefined) {
            // FIX: Find ingredient and directly update to target quantity
            const ingredient = ingredients.find(i => i.id === action.ingredientId);
            if (ingredient && ingredient.quantity) {
              const isCountable = isCountableUnit(ingredient.unit, ingredient.name);
              const targetQty = roundQuantity(action.newQuantity, isCountable);
              
              // Calculate direction and steps needed
              const currentQty = ingredient.quantity;
              if (targetQty < currentQty) {
                const steps = Math.round(currentQty - targetQty);
                for (let i = 0; i < steps; i++) {
                  updateQuantity(action.ingredientId, 'down');
                }
              } else if (targetQty > currentQty) {
                const steps = Math.round(targetQty - currentQty);
                for (let i = 0; i < steps; i++) {
                  updateQuantity(action.ingredientId, 'up');
                }
              }
            }
          }
          break;

        case 'remove':
          if (action.ingredientId) {
            const ingredient = ingredients.find(i => i.id === action.ingredientId);
            if (ingredient && ingredient.quantity) {
              // Set to minimum (1 for countables)
              const isCountable = isCountableUnit(ingredient.unit, ingredient.name);
              const minQty = isCountable ? 1 : 0.25;
              const steps = Math.max(0, Math.round(ingredient.quantity - minQty));
              for (let i = 0; i < steps; i++) {
                updateQuantity(action.ingredientId, 'down');
              }
            }
          }
          break;

        case 'add_fat':
          if (action.fatAdditionId) {
            toggleAddition(action.fatAdditionId);
            if (action.newQuantity && action.newQuantity > 1) {
              updateAdditionQuantity(action.fatAdditionId, action.newQuantity);
            }
          }
          break;
      }

      setAppliedActionIds(prev => new Set([...prev, action.id]));
      
      toast.success(`Applied: ${action.title}`, {
        description: `+${action.scoreImpact} points`,
      });

    } catch (error) {
      console.error('Failed to apply action:', error);
      toast.error('Failed to apply action');
    } finally {
      setApplyingActionId(null);
    }
  }, [toggleSwap, updateQuantity, toggleAddition, updateAdditionQuantity, createSnapshot, ingredients]);

  // Restore from snapshot (Undo)
  const handleUndo = useCallback(async () => {
    const snapshot = undoSnapshotRef.current;
    if (!snapshot) {
      toast.error('No changes to undo');
      return;
    }

    setIsCommitting(true);

    try {
      // Restore ingredient quantities
      for (const snapIng of snapshot.ingredients) {
        await supabase
          .from('recipe_ingredients')
          .update({ 
            name: snapIng.name,
            quantity: snapIng.quantity 
          })
          .eq('id', snapIng.id);
      }

      // Remove any newly added ingredients (fat additions)
      const originalIds = new Set(snapshot.ingredients.map(i => i.id));
      const { data: currentIngredients } = await supabase
        .from('recipe_ingredients')
        .select('id')
        .eq('recipe_id', recipeId);
      
      if (currentIngredients) {
        for (const ing of currentIngredients) {
          if (!originalIds.has(ing.id)) {
            await supabase
              .from('recipe_ingredients')
              .delete()
              .eq('id', ing.id);
          }
        }
      }

      // Recalculate nutrition
      await recalculateNutrition();

      // Force cache refresh
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['recipe', recipeId] }),
        queryClient.invalidateQueries({ queryKey: ['global-recipes'] }),
        queryClient.invalidateQueries({ queryKey: ['user-recipes'] }),
      ]);
      await queryClient.refetchQueries({ queryKey: ['recipe', recipeId] });

      // Reset local state
      resetAll();
      setAppliedActionIds(new Set());
      setShowCelebration(false);
      undoSnapshotRef.current = null;

      toast.success('Changes reverted successfully');
      onCommit();

    } catch (error) {
      console.error('Failed to undo changes:', error);
      toast.error('Failed to undo changes');
    } finally {
      setIsCommitting(false);
    }
  }, [recipeId, queryClient, resetAll, onCommit]);

  // Commit all changes to database
  const handleCommit = async () => {
    if (!hasChanges) return;
    
    // Create snapshot before committing for undo support
    undoSnapshotRef.current = createSnapshot();
    
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
      
      // 2. Apply quantity changes with ABSOLUTE TARGET VALUES and proper rounding
      for (const qty of changes.quantities) {
        const isCountable = isCountableUnit(qty.unit, qty.ingredientName);
        // FIX: Use absolute target value, properly rounded
        const finalQuantity = roundQuantity(qty.newQuantity, isCountable);
        
        await supabase
          .from('recipe_ingredients')
          .update({ quantity: finalQuantity })
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
          const isCountable = isCountableUnit(qty.unit, qty.ingredientName);
          const finalQty = roundQuantity(qty.newQuantity, isCountable);
          const newQtyStr = finalQty.toString();
          
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
      
      // 6. Force hard refresh to update macros and badge
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['recipe', recipeId] }),
        queryClient.invalidateQueries({ queryKey: ['global-recipes'] }),
        queryClient.invalidateQueries({ queryKey: ['user-recipes'] }),
      ]);
      
      // Force refetch to ensure UI updates immediately
      await queryClient.refetchQueries({ queryKey: ['recipe', recipeId] });
      
      const scoreGain = previewNutrition.ketoScore - originalNutrition.ketoScore;
      
      if (previewNutrition.ketoScore >= 100) {
        toast.success('Perfect Score! Recipe updated and saved.', {
          description: 'Neutron Verified: 100',
          action: {
            label: 'Undo',
            onClick: handleUndo,
          },
        });
      } else {
        toast.success('Recipe optimized!', {
          description: scoreGain > 0 
            ? `Score improved by ${scoreGain} points to ${previewNutrition.ketoScore}!`
            : `Applied changes successfully.`,
          action: {
            label: 'Undo',
            onClick: handleUndo,
          },
        });
      }
      
      resetAll();
      setAppliedActionIds(new Set());
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

  // Handle reset
  const handleReset = () => {
    resetAll();
    setAppliedActionIds(new Set());
    setShowCelebration(false);
  };

  // Don't render if already perfect and no actions available
  if (originalNutrition.ketoScore >= 100 && smartActions.length === 0) {
    return null;
  }

  const isPerfectScore = originalNutrition.ketoScore >= 100;

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
              {appliedActionIds.size > 0 && (
                <Badge className="bg-indigo-500 text-white text-2xs">
                  {appliedActionIds.size} staged
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
              {/* Celebration State - Shows when reaching 100 */}
              <AnimatePresence mode="wait">
                {showCelebration && projectedScore >= 100 ? (
                  <CelebrationState 
                    score={projectedScore} 
                    show={showCelebration}
                  />
                ) : (
                  /* Smart Actions Panel */
                  <motion.div
                    key="actions"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <SmartActionsPanel
                      actions={smartActions}
                      onApplyAction={handleApplyAction}
                      appliedActionIds={appliedActionIds}
                      isApplying={applyingActionId}
                      projectedScore={projectedScore}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action Buttons - ONLY show when NOT in celebration mode */}
              {!showCelebration && hasChanges && (
                <div className="flex items-center gap-2 pt-3 border-t border-border/50">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReset}
                    className="text-muted-foreground"
                  >
                    <RotateCcw className="w-4 h-4 mr-1.5" />
                    Reset
                  </Button>
                  
                  <Button
                    className={`flex-1 text-white ${
                      projectedScore >= 100
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600'
                        : 'bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600'
                    }`}
                    size="sm"
                    onClick={handleCommit}
                    disabled={isCommitting}
                  >
                    {isCommitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-1.5" />
                        {projectedScore >= 100 ? 'Save & Celebrate!' : 'Commit Changes'}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
