/**
 * NeutronSuggestionCard - Smart Swap and Keto Optimization UI Component
 * 
 * Displays actionable suggestions to optimize a recipe for keto compliance,
 * including Smart Swap recommendations from the shared Neutron Engine.
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, ArrowRight, Check, ChevronDown, ChevronUp, Flame, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  getKetoOptimization, 
  findKetoSwaps,
  type KetoOptimizationResult, 
  type KetoOptimizationSuggestion,
  type KetoSwapSuggestion,
  type RawNutritionData,
  calculateNetCarbs,
  calculateKetoScore,
  KETO_BADGE_MAX_NET_CARBS,
} from '@/lib/neutron';

interface IngredientData {
  name: string;
  quantity?: number | null;
  unit?: string | null;
}

interface NeutronSuggestionCardProps {
  nutrition: RawNutritionData | null;
  ingredients: IngredientData[];
  onPreviewSwap?: (originalIngredient: string, newIngredient: string) => void;
}

export function NeutronSuggestionCard({
  nutrition, 
  ingredients,
  onPreviewSwap 
}: NeutronSuggestionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [previewingSwap, setPreviewingSwap] = useState<KetoSwapSuggestion | null>(null);

  // Get optimization result from Neutron Engine (includes swap suggestions)
  const optimization = useMemo(() => {
    if (!nutrition) return null;
    
    const ingredientsWithMacros = ingredients.map(ing => ({
      name: ing.name,
      quantity: ing.quantity ?? undefined,
      unit: ing.unit ?? undefined,
    }));
    
    return getKetoOptimization(nutrition, ingredientsWithMacros);
  }, [nutrition, ingredients]);

  // Use swap suggestions from the shared Neutron Engine
  const swapSuggestions = useMemo(() => {
    const ingredientNames = ingredients.map(ing => ing.name);
    return findKetoSwaps(ingredientNames);
  }, [ingredients]);

  // Calculate current keto status
  const currentNetCarbs = useMemo(() => {
    if (!nutrition) return 0;
    return calculateNetCarbs(
      nutrition.carbs_g ?? 0,
      nutrition.fiber_g ?? 0,
      nutrition.sugar_alcohols_g ?? 0
    );
  }, [nutrition]);

  const isCurrentlyKeto = optimization?.isKeto ?? false;
  const currentScore = optimization?.ketoScore.score ?? 0;

  // Don't show if already perfect keto
  if (isCurrentlyKeto && currentScore === 100 && swapSuggestions.length === 0) {
    return null;
  }

  // Don't show if no suggestions available
  if (!optimization || (optimization.suggestions.length === 0 && swapSuggestions.length === 0)) {
    return null;
  }

  const primarySuggestion = optimization.suggestions[0];
  const hasSwaps = swapSuggestions.length > 0;

  const handlePreviewSwap = (swap: KetoSwapSuggestion) => {
    // Toggle behavior: if already previewing this swap, clear it
    if (previewingSwap?.originalIngredient === swap.originalIngredient) {
      setPreviewingSwap(null);
      // Optionally notify parent to clear preview (pass empty strings)
      onPreviewSwap?.('', '');
    } else {
      setPreviewingSwap(swap);
      onPreviewSwap?.(swap.originalIngredient, swap.swapTo);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/30 rounded-xl p-4 mb-6"
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              Neutron Optimizer
              {!isCurrentlyKeto && (
                <Badge variant="outline" className="text-2xs bg-primary/10 text-primary border-primary/30">
                  Not Keto
                </Badge>
              )}
              {isCurrentlyKeto && currentScore < 100 && (
                <Badge variant="outline" className="text-2xs bg-accent text-accent-foreground border-border">
                  Score: {currentScore}
                </Badge>
              )}
            </h4>
            <p className="text-xs text-muted-foreground">
              {hasSwaps ? `${swapSuggestions.length} smart swap${swapSuggestions.length > 1 ? 's' : ''} available` : 'Optimization tips'}
            </p>
          </div>
        </div>
        <button className="text-muted-foreground hover:text-foreground transition-colors">
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {/* Primary suggestion - show for non-keto OR keto with score < 100 */}
      {primarySuggestion && (
        <div className="mt-3 p-3 bg-background/50 rounded-lg border border-border/50">
          <p className="text-sm text-foreground">{primarySuggestion.message}</p>
          {primarySuggestion.action?.impact && (
            <span className="inline-block mt-2 text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">
              {primarySuggestion.action.impact}
            </span>
          )}
        </div>
      )}

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {/* Smart Swaps Section */}
            {hasSwaps && (
              <div className="mt-4">
                <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" />
                  Smart Swaps
                </h5>
                <div className="space-y-2">
                  {swapSuggestions.map((swap, index) => (
                    <div 
                      key={index}
                      className={`p-3 rounded-lg border transition-all ${
                        previewingSwap?.originalIngredient === swap.originalIngredient
                          ? 'bg-emerald-500/10 border-emerald-500/50'
                          : 'bg-background/50 border-border/50 hover:border-primary/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-sm text-muted-foreground line-through">{swap.originalIngredient}</span>
                          <ArrowRight className="w-4 h-4 text-primary" />
                          <span className="text-sm font-medium text-foreground">{swap.swapTo}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs h-7 px-2"
                          onClick={() => handlePreviewSwap(swap)}
                        >
                          {previewingSwap?.originalIngredient === swap.originalIngredient ? (
                            <>
                              <Check className="w-3 h-3 mr-1" />
                              Previewing
                            </>
                          ) : (
                            'Preview'
                          )}
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-2xs">{swap.category}</Badge>
                        <span className="text-xs text-muted-foreground">{swap.reason}</span>
                        <span className="text-xs font-medium text-primary">−{swap.estimatedCarbReduction}g carbs</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Additional suggestions */}
            {optimization.suggestions.length > 1 && (
              <div className="mt-4">
                <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Additional Tips
                </h5>
                <ul className="space-y-2">
                  {optimization.suggestions.slice(1).map((suggestion, index) => (
                    <li 
                      key={index}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 ${
                        suggestion.priority === 'high' ? 'bg-destructive' :
                        suggestion.priority === 'medium' ? 'bg-primary' : 'bg-accent'
                      }`} />
                      <span>{suggestion.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Preview result */}
            {previewingSwap && (
              <div className="mt-4 p-3 bg-primary/10 border border-primary/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">
                    With {previewingSwap.swapTo}:
                  </span>
                </div>
                <p className="text-sm text-foreground mt-1">
                  Estimated Net Carbs: <span className="font-semibold">
                    ~{Math.max(0, currentNetCarbs - previewingSwap.estimatedCarbReduction).toFixed(0)}g
                  </span>
                  {currentNetCarbs - previewingSwap.estimatedCarbReduction <= KETO_BADGE_MAX_NET_CARBS && (
                    <Badge className="ml-2 bg-primary text-primary-foreground text-2xs">Keto Eligible!</Badge>
                  )}
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
