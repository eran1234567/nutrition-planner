import { useMemo } from 'react';
import { Plus, Droplets, Flame, Wheat, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { DailyTargets, DayExtra } from '@/types/mealPlan';

interface TopUpItem {
  id: string;
  name: string;
  emoji: string;
  macros: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  primaryMacro: 'protein' | 'carbs' | 'fat';
}

// Common top-up items for filling macro gaps
const TOP_UP_ITEMS: TopUpItem[] = [
  // Fat sources
  { id: 'olive-oil', name: 'Olive oil (1 tbsp)', emoji: '🫒', macros: { calories: 120, protein: 0, carbs: 0, fat: 14 }, primaryMacro: 'fat' },
  { id: 'avocado-half', name: 'Avocado (½)', emoji: '🥑', macros: { calories: 120, protein: 1, carbs: 6, fat: 11 }, primaryMacro: 'fat' },
  { id: 'almonds', name: 'Almonds (1 oz)', emoji: '🥜', macros: { calories: 164, protein: 6, carbs: 6, fat: 14 }, primaryMacro: 'fat' },
  { id: 'peanut-butter', name: 'Peanut butter (2 tbsp)', emoji: '🥜', macros: { calories: 188, protein: 8, carbs: 6, fat: 16 }, primaryMacro: 'fat' },
  { id: 'cheese', name: 'Cheese (1 oz)', emoji: '🧀', macros: { calories: 113, protein: 7, carbs: 0, fat: 9 }, primaryMacro: 'fat' },
  
  // Protein sources
  { id: 'protein-shake', name: 'Protein shake', emoji: '🥤', macros: { calories: 120, protein: 25, carbs: 3, fat: 1 }, primaryMacro: 'protein' },
  { id: 'greek-yogurt', name: 'Greek yogurt (1 cup)', emoji: '🥛', macros: { calories: 100, protein: 17, carbs: 6, fat: 1 }, primaryMacro: 'protein' },
  { id: 'hard-boiled-egg', name: 'Hard boiled egg', emoji: '🥚', macros: { calories: 78, protein: 6, carbs: 1, fat: 5 }, primaryMacro: 'protein' },
  { id: 'chicken-breast', name: 'Chicken breast (4 oz)', emoji: '🍗', macros: { calories: 165, protein: 31, carbs: 0, fat: 4 }, primaryMacro: 'protein' },
  { id: 'cottage-cheese', name: 'Cottage cheese (1 cup)', emoji: '🧀', macros: { calories: 163, protein: 28, carbs: 6, fat: 2 }, primaryMacro: 'protein' },
  
  // Carb sources
  { id: 'rice', name: 'Rice (1 cup cooked)', emoji: '🍚', macros: { calories: 206, protein: 4, carbs: 45, fat: 0 }, primaryMacro: 'carbs' },
  { id: 'banana', name: 'Banana', emoji: '🍌', macros: { calories: 105, protein: 1, carbs: 27, fat: 0 }, primaryMacro: 'carbs' },
  { id: 'oatmeal', name: 'Oatmeal (1 cup)', emoji: '🥣', macros: { calories: 158, protein: 6, carbs: 27, fat: 3 }, primaryMacro: 'carbs' },
  { id: 'sweet-potato', name: 'Sweet potato (medium)', emoji: '🍠', macros: { calories: 103, protein: 2, carbs: 24, fat: 0 }, primaryMacro: 'carbs' },
  { id: 'bread', name: 'Bread (2 slices)', emoji: '🍞', macros: { calories: 160, protein: 6, carbs: 30, fat: 2 }, primaryMacro: 'carbs' },
];

interface MacroGap {
  macro: 'protein' | 'carbs' | 'fat';
  gap: number;
  label: string;
  color: string;
  icon: React.ReactNode;
}

interface MacroGapSuggestionsProps {
  dailyTargets: DailyTargets;
  dayTotals: { calories: number; protein: number; carbs: number; fat: number };
  currentExtras?: DayExtra[];
  onAddTopUp: (item: TopUpItem) => void;
  onRemoveExtra?: (extraId: string) => void;
}

export function MacroGapSuggestions({
  dailyTargets,
  dayTotals,
  currentExtras = [],
  onAddTopUp,
  onRemoveExtra,
}: MacroGapSuggestionsProps) {
  // Calculate gaps
  const gaps = useMemo(() => {
    const result: MacroGap[] = [];
    
    const proteinGap = dailyTargets.protein - dayTotals.protein;
    const carbsGap = dailyTargets.carbs - dayTotals.carbs;
    const fatGap = dailyTargets.fat - dayTotals.fat;
    
    // Only show gaps that are significant (>10% of target)
    if (proteinGap > dailyTargets.protein * 0.1 && proteinGap > 5) {
      result.push({
        macro: 'protein',
        gap: proteinGap,
        label: `${Math.round(proteinGap)}g protein`,
        color: 'hsl(var(--protein))',
        icon: <Flame className="w-3.5 h-3.5" />,
      });
    }
    
    if (carbsGap > dailyTargets.carbs * 0.1 && carbsGap > 10) {
      result.push({
        macro: 'carbs',
        gap: carbsGap,
        label: `${Math.round(carbsGap)}g carbs`,
        color: 'hsl(var(--carbs))',
        icon: <Wheat className="w-3.5 h-3.5" />,
      });
    }
    
    if (fatGap > dailyTargets.fat * 0.1 && fatGap > 5) {
      result.push({
        macro: 'fat',
        gap: fatGap,
        label: `${Math.round(fatGap)}g fat`,
        color: 'hsl(var(--fat))',
        icon: <Droplets className="w-3.5 h-3.5" />,
      });
    }
    
    return result;
  }, [dailyTargets, dayTotals]);

  // Get relevant suggestions for current gaps
  const suggestions = useMemo(() => {
    if (gaps.length === 0) return [];
    
    // Sort gaps by magnitude (percentage of target)
    const sortedGaps = [...gaps].sort((a, b) => {
      const aPercent = a.gap / (dailyTargets[a.macro] || 1);
      const bPercent = b.gap / (dailyTargets[b.macro] || 1);
      return bPercent - aPercent;
    });
    
    // Get the primary gap macro
    const primaryGap = sortedGaps[0];
    
    // Filter items that help fill the primary gap
    const relevantItems = TOP_UP_ITEMS.filter(item => item.primaryMacro === primaryGap.macro);
    
    // Sort by how much of the gap they fill without overshooting too much
    return relevantItems
      .map(item => {
        const fillAmount = item.macros[primaryGap.macro];
        const overshoot = Math.max(0, fillAmount - primaryGap.gap);
        const score = fillAmount - overshoot * 0.5; // Penalize overshoot
        return { item, score, fillAmount };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(s => s.item);
  }, [gaps, dailyTargets]);

  // Filter out already-added extras from suggestions
  const filteredSuggestions = useMemo(() => {
    const addedIds = new Set(currentExtras.map(e => e.id));
    return suggestions.filter(item => !addedIds.has(item.id));
  }, [suggestions, currentExtras]);

  // Don't render if no significant gaps AND no extras added
  if (gaps.length === 0 && currentExtras.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-3 mb-4">
      {/* Currently added extras */}
      {currentExtras.length > 0 && (
        <div className="mb-3">
          <span className="text-xs font-medium text-muted-foreground mb-1.5 block">Added:</span>
          <div className="flex flex-wrap gap-1.5">
            {currentExtras.map(extra => (
              <span
                key={extra.id}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
              >
                <span>{extra.emoji}</span>
                {extra.name}
                <span className="text-muted-foreground">+{extra.macros.fat}g F</span>
                {onRemoveExtra && (
                  <button
                    onClick={() => onRemoveExtra(extra.id)}
                    className="ml-0.5 p-0.5 rounded-full hover:bg-primary/20 transition-colors"
                    aria-label={`Remove ${extra.name}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Gap indicators and suggestions - only show if there are still gaps */}
      {gaps.length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
              Missing:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {gaps.map(gap => (
                <span
                  key={gap.macro}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ 
                    backgroundColor: `${gap.color}20`,
                    color: gap.color,
                  }}
                >
                  {gap.icon}
                  {gap.label}
                </span>
              ))}
            </div>
          </div>
          
          {filteredSuggestions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {filteredSuggestions.map(item => (
                <Button
                  key={item.id}
                  variant="outline"
                  size="sm"
                  className="h-auto py-1.5 px-2.5 text-xs bg-card hover:bg-muted"
                  onClick={() => onAddTopUp(item)}
                >
                  <span className="mr-1">{item.emoji}</span>
                  {item.name}
                  <span className="ml-1.5 text-muted-foreground">
                    +{item.macros[item.primaryMacro]}g
                  </span>
                </Button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Export type for use in other components
export type { TopUpItem };
