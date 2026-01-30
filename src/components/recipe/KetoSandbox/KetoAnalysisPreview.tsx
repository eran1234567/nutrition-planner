/**
 * KetoAnalysisPreview - Real-time keto analysis display during sandbox preview
 */

import { motion } from 'framer-motion';
import { Flame, TrendingUp, TrendingDown, Check, X, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { KETO_BADGE_MAX_NET_CARBS, KETO_BADGE_MIN_FAT_PERCENT } from '@/lib/neutron';
import type { NutritionPreview } from './types';

interface KetoAnalysisPreviewProps {
  original: NutritionPreview;
  preview: NutritionPreview;
  hasChanges: boolean;
}

export function KetoAnalysisPreview({ original, preview, hasChanges }: KetoAnalysisPreviewProps) {
  const displayData = hasChanges ? preview : original;
  const netCarbsDelta = hasChanges ? preview.netCarbs - original.netCarbs : 0;
  const fatDelta = hasChanges ? preview.fat_g - original.fat_g : 0;
  const scoreDelta = hasChanges ? preview.ketoScore - original.ketoScore : 0;
  
  // Calculate progress percentages
  const carbProgress = Math.min(100, (displayData.netCarbs / KETO_BADGE_MAX_NET_CARBS) * 100);
  const fatProgress = Math.min(100, (displayData.fatPercent / KETO_BADGE_MIN_FAT_PERCENT) * 100);
  
  const carbsOk = displayData.netCarbs <= KETO_BADGE_MAX_NET_CARBS;
  const fatOk = displayData.fatPercent >= KETO_BADGE_MIN_FAT_PERCENT;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-muted/80 to-muted/40 border border-border rounded-xl p-4"
    >
      {/* Header with Keto Score */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <Flame className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h4 className="text-sm font-semibold">Keto Analysis</h4>
            <p className="text-xs text-muted-foreground">
              {hasChanges ? 'Live Preview' : 'Current State'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {hasChanges && scoreDelta !== 0 && (
            <Badge 
              variant="outline" 
              className={`text-xs ${scoreDelta > 0 ? 'text-primary border-primary/50' : 'text-destructive border-destructive/50'}`}
            >
              {scoreDelta > 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
              {scoreDelta > 0 ? '+' : ''}{scoreDelta}
            </Badge>
          )}
          <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold ${
            displayData.isKeto 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-muted-foreground/20 text-muted-foreground'
          }`}>
            <span>{displayData.ketoScore}</span>
          </div>
        </div>
      </div>

      {/* Keto Badge Status */}
      {displayData.isKeto && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-primary/10 border border-primary/30 rounded-lg">
          <Check className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-primary">Keto Badge Eligible</span>
        </div>
      )}

      {!displayData.isKeto && hasChanges && preview.isKeto && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-primary/10 border border-primary/30 rounded-lg animate-pulse">
          <Flame className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-primary">Will become Keto Eligible!</span>
        </div>
      )}

      {/* Net Carbs */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Net Carbs</span>
            {carbsOk ? (
              <Check className="w-3.5 h-3.5 text-primary" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {displayData.netCarbs}g <span className="text-muted-foreground">/ {KETO_BADGE_MAX_NET_CARBS}g</span>
            </span>
            {hasChanges && netCarbsDelta !== 0 && (
              <Badge 
                variant="outline" 
                className={`text-2xs ${netCarbsDelta < 0 ? 'text-primary border-primary/50' : 'text-destructive border-destructive/50'}`}
              >
                {netCarbsDelta < 0 ? '' : '+'}{netCarbsDelta.toFixed(1)}g
              </Badge>
            )}
          </div>
        </div>
        <Progress 
          value={carbProgress} 
          className="h-2"
          indicatorClassName={carbsOk ? 'bg-primary' : 'bg-destructive'}
        />
      </div>

      {/* Fat Fuel */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Fat Fuel</span>
            {fatOk ? (
              <Check className="w-3.5 h-3.5 text-primary" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {displayData.fatPercent}% <span className="text-muted-foreground">/ {KETO_BADGE_MIN_FAT_PERCENT}%</span>
            </span>
            {hasChanges && fatDelta !== 0 && (
              <Badge 
                variant="outline" 
                className={`text-2xs ${fatDelta > 0 ? 'text-primary border-primary/50' : 'text-destructive border-destructive/50'}`}
              >
                +{fatDelta.toFixed(0)}g fat
              </Badge>
            )}
          </div>
        </div>
        <Progress 
          value={fatProgress} 
          className="h-2"
          indicatorClassName={fatOk ? 'bg-primary' : 'bg-destructive'}
        />
      </div>

      {/* Macro Summary */}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/50">
        <div className="text-center">
          <p className="text-lg font-bold text-fat">{displayData.fat_g}g</p>
          <p className="text-xs text-muted-foreground">Fat ({displayData.fatPercent}%)</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-protein">{displayData.protein_g}g</p>
          <p className="text-xs text-muted-foreground">Protein ({displayData.proteinPercent}%)</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-carbs">{displayData.netCarbs}g</p>
          <p className="text-xs text-muted-foreground">Net Carbs ({displayData.carbPercent}%)</p>
        </div>
      </div>
    </motion.div>
  );
}
