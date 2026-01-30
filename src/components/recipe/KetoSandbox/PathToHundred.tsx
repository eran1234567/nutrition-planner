/**
 * PathToHundred - Prescriptive "Path to 100" recommendation header
 * Calculates exact steps to reach a perfect 100 Keto Score
 */

import { motion } from 'framer-motion';
import { Target, Sparkles, Minus, Droplets, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { NutritionPreview } from './types';
import { KETO_SCORE_CARB_THRESHOLD, KETO_SCORE_PROTEIN_THRESHOLD, CALORIES_PER_GRAM } from '@/lib/neutron';

export interface Recommendation {
  type: 'reduce_carbs' | 'add_fat' | 'balance_protein';
  priority: number;
  message: string;
  action?: {
    ingredientId?: string;
    ingredientName?: string;
    reduction?: number; // For carb reduction (number of units)
    unit?: string;
    fatGrams?: number; // For fat addition
    fatSource?: string;
    fatAmount?: number;
    fatUnit?: string;
  };
}

interface PathToHundredProps {
  currentScore: number;
  projectedScore: number;
  nutrition: NutritionPreview;
  recommendations: Recommendation[];
  onAutoApply: () => void;
  isApplying: boolean;
  hasChanges: boolean;
}

// Fat sources with grams per unit
const FAT_SOURCES = [
  { name: 'Olive Oil', gramsPerUnit: 13.5, unit: 'tbsp' },
  { name: 'Butter', gramsPerUnit: 11.5, unit: 'tbsp' },
  { name: 'MCT Oil', gramsPerUnit: 14, unit: 'tbsp' },
];

export function calculateRecommendations(
  nutrition: NutritionPreview,
  highCarbIngredients: Array<{ id: string; name: string; carbsPerUnit: number; currentQty: number; unit: string | null }>
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const { netCarbs, fatPercent, proteinPercent, fat_g, protein_g } = nutrition;

  // Priority 1: Reduce carbs if above 5g (causes score penalty)
  if (netCarbs > KETO_SCORE_CARB_THRESHOLD) {
    const carbsToReduce = netCarbs - KETO_SCORE_CARB_THRESHOLD;
    
    // Find the highest-carb ingredient to suggest reduction
    if (highCarbIngredients.length > 0) {
      const topIngredient = highCarbIngredients[0];
      const unitsToReduce = Math.ceil(carbsToReduce / topIngredient.carbsPerUnit);
      const actualReduction = Math.min(unitsToReduce, topIngredient.currentQty - 1); // Leave at least 1
      
      if (actualReduction > 0) {
        recommendations.push({
          type: 'reduce_carbs',
          priority: 1,
          message: `Reduce ${topIngredient.name} by ${actualReduction} ${topIngredient.unit || 'unit'}${actualReduction > 1 ? 's' : ''}`,
          action: {
            ingredientId: topIngredient.id,
            ingredientName: topIngredient.name,
            reduction: actualReduction,
            unit: topIngredient.unit || 'unit',
          },
        });
      }
    } else {
      recommendations.push({
        type: 'reduce_carbs',
        priority: 1,
        message: `Reduce net carbs by ${carbsToReduce.toFixed(1)}g to reach ≤5g`,
      });
    }
  }

  // Priority 2: Add fat if below 60% or protein > 35%
  if (fatPercent < 60 || proteinPercent > KETO_SCORE_PROTEIN_THRESHOLD) {
    // Calculate exact fat needed using the formula:
    // Target: Fat calories = 60.1% of total net energy
    // Fat% = (fat * 9) / ((fat * 9) + (protein * 4) + (netCarbs * 4))
    // Solving for target fat: fat_target = (0.601 * (protein * 4 + netCarbs * 4)) / (9 * 0.399)
    
    const nonFatCals = protein_g * CALORIES_PER_GRAM.protein + netCarbs * CALORIES_PER_GRAM.carbs;
    const targetFatCals = (0.601 * nonFatCals) / 0.399;
    const currentFatCals = fat_g * CALORIES_PER_GRAM.fat;
    const additionalFatCalsNeeded = Math.max(0, targetFatCals - currentFatCals);
    const additionalFatGrams = Math.ceil(additionalFatCalsNeeded / CALORIES_PER_GRAM.fat);

    if (additionalFatGrams > 0) {
      // Pick the best fat source
      const fatSource = FAT_SOURCES[0]; // Olive oil as default
      const amount = Math.ceil(additionalFatGrams / fatSource.gramsPerUnit);

      recommendations.push({
        type: proteinPercent > KETO_SCORE_PROTEIN_THRESHOLD ? 'balance_protein' : 'add_fat',
        priority: proteinPercent > KETO_SCORE_PROTEIN_THRESHOLD ? 2 : 3,
        message: `Add ${amount} ${fatSource.unit} ${fatSource.name} (+${additionalFatGrams}g fat)`,
        action: {
          fatGrams: additionalFatGrams,
          fatSource: fatSource.name,
          fatAmount: amount,
          fatUnit: fatSource.unit,
        },
      });
    }
  }

  return recommendations.sort((a, b) => a.priority - b.priority);
}

export function PathToHundred({
  currentScore,
  projectedScore,
  nutrition,
  recommendations,
  onAutoApply,
  isApplying,
  hasChanges,
}: PathToHundredProps) {
  const isPerfect = projectedScore >= 100;
  const scoreGap = 100 - currentScore;

  if (isPerfect && !hasChanges) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/20 to-emerald-600/10 border border-emerald-500/40"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
              Perfect 100 Score! 🎯
            </h4>
            <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">
              This recipe is fully optimized for keto
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-xl bg-gradient-to-r from-indigo-500/20 to-violet-500/10 border border-indigo-500/40"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
            <Target className="w-4 h-4 text-indigo-500" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
              Path to 100
            </h4>
            <p className="text-2xs text-indigo-500/70">
              {scoreGap} points to perfect
            </p>
          </div>
        </div>

        {/* Projected Score Badge */}
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Badge
              variant="outline"
              className="text-xs border-indigo-400/50 text-indigo-500 bg-indigo-500/10"
            >
              Preview: {projectedScore}
            </Badge>
          )}
          <div
            className={`px-3 py-1.5 rounded-full text-sm font-bold ${
              projectedScore >= 100
                ? 'bg-emerald-500 text-white'
                : 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
            }`}
          >
            {projectedScore >= 100 ? '100 ✓' : currentScore}
          </div>
        </div>
      </div>

      {/* Recommendations List */}
      <div className="space-y-2 mb-4">
        {recommendations.slice(0, 3).map((rec, idx) => (
          <div
            key={idx}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/50 dark:bg-black/20 border border-indigo-200/50 dark:border-indigo-800/30"
          >
            <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center flex-shrink-0">
              {rec.type === 'reduce_carbs' ? (
                <Minus className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              ) : (
                <Droplets className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              )}
            </div>
            <span className="text-sm text-foreground flex-1">{rec.message}</span>
            {rec.action && (
              <Badge variant="outline" className="text-2xs text-indigo-500 border-indigo-300/50">
                {rec.type === 'reduce_carbs' ? 'Carbs' : 'Fat'}
              </Badge>
            )}
          </div>
        ))}
      </div>

      {/* Auto-Apply Button */}
      {recommendations.some(r => r.action) && (
        <Button
          onClick={onAutoApply}
          disabled={isApplying || isPerfect}
          className="w-full bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white"
        >
          {isApplying ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Applying...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Auto-Apply Recommendations
            </>
          )}
        </Button>
      )}
    </motion.div>
  );
}
