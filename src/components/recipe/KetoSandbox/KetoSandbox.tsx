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
    originalNutrition,
    resetAll,
  } = useKetoSandbox({ nutrition, ingredients, servings });

  // Generate Smart Actions based on current nutrition
  const smartActions = useMemo(() => {
    return generateSmartActions(originalNutrition, ingredients, servings);
  }, [originalNutrition, ingredients, servings]);

  // Projected score is just the original since changes are auto-applied to DB
  const projectedScore = originalNutrition.ketoScore;

  // Check for celebration trigger when score hits 100
  useEffect(() => {
    if (projectedScore >= 100 && appliedActionIds.size > 0 && !showCelebration) {
      setShowCelebration(true);
    } else if (projectedScore < 100) {
      setShowCelebration(false);
    }
  }, [projectedScore, appliedActionIds.size, showCelebration]);

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

  // Recalculate nutrition via edge function
  const recalculateNutrition = useCallback(async () => {
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
  }, [recipeId]);

  // Restore from snapshot (Undo) - defined before handleApplyAction to avoid circular ref
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
      await queryClient.invalidateQueries({ queryKey: ['recipe', recipeId] });
      await queryClient.invalidateQueries({ queryKey: ['global-recipes'] });
      await queryClient.invalidateQueries({ queryKey: ['user-recipes'] });
      await queryClient.refetchQueries({ 
        queryKey: ['recipe', recipeId],
        type: 'active',
        exact: true,
      });

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
  }, [recipeId, queryClient, resetAll, onCommit, recalculateNutrition]);

  // Handle applying a single Smart Action - AUTO-COMMITS immediately to DB
  const handleApplyAction = useCallback(async (action: SmartAction) => {
    setApplyingActionId(action.id);
    
    // Create snapshot before applying for undo support
    undoSnapshotRef.current = createSnapshot();

    try {
      // Direct database updates based on action type
      switch (action.type) {
        case 'swap':
          if (action.ingredientId && action.swapTo) {
            await supabase
              .from('recipe_ingredients')
              .update({ name: action.swapTo })
              .eq('id', action.ingredientId);
          }
          break;

        case 'reduce':
          if (action.ingredientId && action.newQuantity !== undefined) {
            const ingredient = ingredients.find(i => i.id === action.ingredientId);
            if (ingredient) {
              const isCountable = isCountableUnit(ingredient.unit, ingredient.name);
              // CRITICAL: Use absolute target value, properly rounded
              const finalQuantity = roundQuantity(action.newQuantity, isCountable);
              
              await supabase
                .from('recipe_ingredients')
                .update({ quantity: finalQuantity })
                .eq('id', action.ingredientId);
            }
          }
          break;

        case 'remove':
          if (action.ingredientId) {
            const ingredient = ingredients.find(i => i.id === action.ingredientId);
            if (ingredient) {
              const isCountable = isCountableUnit(ingredient.unit, ingredient.name);
              const minQty = isCountable ? 1 : 0.25;
              
              await supabase
                .from('recipe_ingredients')
                .update({ quantity: minQty })
                .eq('id', action.ingredientId);
            }
          }
          break;

        case 'add_fat':
          if (action.fatAdditionId && action.unit) {
            const maxOrderIndex = Math.max(...ingredients.map(i => i.order_index ?? 0), 0);
            const fatName = action.fatAdditionId === 'olive-oil' ? 'Olive Oil' 
              : action.fatAdditionId === 'butter' ? 'Butter'
              : action.fatAdditionId === 'coconut-oil' ? 'MCT Oil'
              : action.fatAdditionId;
            
            await supabase
              .from('recipe_ingredients')
              .insert({
                recipe_id: recipeId,
                name: fatName,
                quantity: action.newQuantity || 1,
                unit: action.unit,
                order_index: maxOrderIndex + 1,
              });
          }
          break;
      }

      // Recalculate nutrition immediately and wait for it
      await recalculateNutrition();
      
      // Small delay to ensure backend has processed the recalculation
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Force cache refresh for immediate macro update - hard refresh all relevant caches
      await queryClient.invalidateQueries({ queryKey: ['recipe', recipeId] });
      await queryClient.invalidateQueries({ queryKey: ['global-recipes'] });
      await queryClient.invalidateQueries({ queryKey: ['user-recipes'] });
      
      // Force immediate refetch to get updated macros from server
      await queryClient.refetchQueries({ 
        queryKey: ['recipe', recipeId],
        type: 'active',
        exact: true,
      });

      setAppliedActionIds(prev => new Set([...prev, action.id]));
      
      toast.success(`Applied: ${action.title}`, {
        description: `+${action.scoreImpact} points`,
        action: {
          label: 'Undo',
          onClick: handleUndo,
        },
      });

      // Trigger parent refresh to update the macro card
      onCommit();

    } catch (error) {
      console.error('Failed to apply action:', error);
      toast.error('Failed to apply action');
    } finally {
      setApplyingActionId(null);
    }
  }, [createSnapshot, ingredients, recipeId, queryClient, onCommit, handleUndo, recalculateNutrition]);


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
          {/* Score Badge */}
          <div className={`px-3 py-1.5 rounded-full text-sm font-bold transition-all ${
            projectedScore >= 100
              ? 'bg-emerald-500 text-white'
              : appliedActionIds.size > 0
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
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Reset button - only show if there are staged (unapplied) changes */}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
