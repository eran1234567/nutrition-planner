import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Lock, Unlock, Minus, Plus, ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { GeneratedSlot } from '@/types/mealPlan';
import type { GlobalRecipe } from '@/hooks/useGlobalRecipes';

interface PlanSlotCardProps {
  slot: GeneratedSlot;
  slotLabel: string;
  recipe: GlobalRecipe | null;
  isLocked: boolean;
  onToggleLock: () => void;
  onSetMultiplier: (multiplier: number) => void;
  onSwap: () => void;
}

const MIN_MULTIPLIER = 0.25;
const MAX_MULTIPLIER = 5.0;
const STEP = 0.25;

export function PlanSlotCard({
  slot,
  slotLabel,
  recipe,
  isLocked,
  onToggleLock,
  onSetMultiplier,
  onSwap,
}: PlanSlotCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(slot.servingMultiplier.toString());
  const inputRef = useRef<HTMLInputElement>(null);

  const handleRecipeClick = () => {
    if (recipe) {
      // Pass the actual number of servings needed (multiplier × recipe base servings)
      // so the detail page can calculate the correct scaling
      const actualServingsNeeded = slot.servingMultiplier * (recipe.servings || 1);
      navigate(`/recipe/${recipe.id}?servings=${actualServingsNeeded}`);
    }
  };

  // Format multiplier to clean display (remove floating point precision issues)
  const formatMultiplier = (value: number) => {
    // Round to 2 decimal places and remove trailing zeros
    return parseFloat(value.toFixed(2)).toString();
  };

  // Update input when slot changes externally
  useEffect(() => {
    if (!isEditing) {
      setInputValue(formatMultiplier(slot.servingMultiplier));
    }
  }, [slot.servingMultiplier, isEditing]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const validateAndApply = (value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num >= MIN_MULTIPLIER && num <= MAX_MULTIPLIER) {
      // Round to 2 decimal places
      const rounded = Math.round(num * 100) / 100;
      onSetMultiplier(rounded);
      setInputValue(formatMultiplier(rounded));
    } else {
      // Reset to current value
      setInputValue(formatMultiplier(slot.servingMultiplier));
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      validateAndApply(inputValue);
    } else if (e.key === 'Escape') {
      setInputValue(formatMultiplier(slot.servingMultiplier));
      setIsEditing(false);
    }
  };

  const handleBlur = () => {
    validateAndApply(inputValue);
  };

  const handleDecrease = () => {
    const newValue = Math.max(MIN_MULTIPLIER, slot.servingMultiplier - STEP);
    const rounded = Math.round(newValue * 100) / 100;
    onSetMultiplier(rounded);
  };

  const handleIncrease = () => {
    const newValue = Math.min(MAX_MULTIPLIER, slot.servingMultiplier + STEP);
    const rounded = Math.round(newValue * 100) / 100;
    onSetMultiplier(rounded);
  };

  const canDecrease = slot.servingMultiplier > MIN_MULTIPLIER;
  const canIncrease = slot.servingMultiplier < MAX_MULTIPLIER;

  if (!recipe) {
    return (
      <div className="p-3 rounded-xl border border-dashed border-border bg-muted/30">
        <div className="flex items-center justify-between">
          <span className="font-medium text-muted-foreground">{slotLabel}</span>
          <span className="text-xs text-muted-foreground">No recipe assigned</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      'rounded-xl border bg-card overflow-hidden',
      isLocked ? 'border-primary/50' : 'border-border'
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border">
        <span className="font-medium text-sm">{slotLabel}</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={onToggleLock}
            title={isLocked ? 'Unlock slot' : 'Lock slot'}
          >
            {isLocked ? (
              <Lock className="w-3.5 h-3.5 text-primary" />
            ) : (
              <Unlock className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={onSwap}
            title="Swap recipe"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Content - Clickable to view recipe details */}
      <div className="p-3">
        <button
          onClick={handleRecipeClick}
          className="flex gap-3 w-full text-left hover:opacity-80 transition-opacity cursor-pointer"
        >
          {/* Image */}
          <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
            {recipe.image_url ? (
              <img
                src={recipe.image_url}
                alt={recipe.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl">🍽️</div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm line-clamp-2">{recipe.title}</p>
            {/* Macro badges with colors */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
              <span className="text-xs text-[hsl(var(--calories))] font-medium">
                {slot.slotTotals.calories} cal
              </span>
              <span className="text-xs text-[hsl(var(--protein))] font-medium">
                {slot.slotTotals.protein}g P
              </span>
              <span className="text-xs text-[hsl(var(--carbs))] font-medium">
                {slot.slotTotals.carbs}g C
              </span>
              <span className="text-xs text-[hsl(var(--fat))] font-medium">
                {slot.slotTotals.fat}g F
              </span>
            </div>
          </div>
        </button>

        {/* Serving multiplier */}
        <div className="flex items-center justify-end mt-3 pt-3 border-t border-border gap-2">
          <span className="text-xs text-muted-foreground">Servings</span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={handleDecrease}
            disabled={!canDecrease}
          >
            <Minus className="w-3 h-3" />
          </Button>
          
          {isEditing ? (
            <Input
              ref={inputRef}
              type="number"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              min={MIN_MULTIPLIER}
              max={MAX_MULTIPLIER}
              step={0.05}
              className="h-7 w-14 text-center text-sm font-medium p-1"
            />
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="text-sm font-medium w-14 text-center py-1 rounded hover:bg-muted transition-colors"
              title="Click to edit"
            >
              {formatMultiplier(slot.servingMultiplier)}x
            </button>
          )}
          
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={handleIncrease}
            disabled={!canIncrease}
          >
            <Plus className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
