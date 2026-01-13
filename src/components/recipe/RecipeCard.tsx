import { useState } from 'react';
import { Clock, Flame, Users, Check, Plus, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { Recipe } from '@/types';

interface RecipeCardProps {
  recipe: Recipe;
  isSelected?: boolean;
  onSelect?: () => void;
  onClick?: () => void;
  onDelete?: () => void;
  compact?: boolean;
}

export function RecipeCard({ 
  recipe, 
  isSelected = false, 
  onSelect, 
  onClick,
  onDelete,
  compact = false 
}: RecipeCardProps) {
  const nutrition = recipe.nutrition;
  const [imageError, setImageError] = useState(false);

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'recipe-card cursor-pointer',
        isSelected && 'ring-2 ring-primary ring-offset-2'
      )}
      onClick={onClick}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {recipe.image_url && !imageError ? (
          <img
            src={recipe.image_url}
            alt={recipe.title}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-primary-soft">
            <span className="text-4xl">🍽️</span>
          </div>
        )}
        
        {/* Selection indicator */}
        {onSelect && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className={cn(
              'absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all',
              isSelected 
                ? 'bg-primary text-primary-foreground shadow-lg' 
                : 'bg-card/90 text-muted-foreground hover:bg-card'
            )}
          >
            {isSelected ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          </button>
        )}

        {/* Delete button */}
        {onDelete && !onSelect && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center bg-destructive/90 text-destructive-foreground hover:bg-destructive transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}

        {/* Time badge */}
        {recipe.total_time && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 rounded-full bg-card/90 text-xs font-medium">
            <Clock className="w-3 h-3" />
            <span>{recipe.total_time} min</span>
          </div>
        )}

        {/* Tags */}
        <div className="absolute bottom-2 right-2 flex gap-1">
          {recipe.is_kid_friendly && (
            <span className="px-2 py-0.5 rounded-full bg-warning/90 text-warning-foreground text-2xs font-medium">
              👶 Kid
            </span>
          )}
          {recipe.is_meal_prep_friendly && (
            <span className="px-2 py-0.5 rounded-full bg-primary/90 text-primary-foreground text-2xs font-medium">
              📦 Prep
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={cn('p-3', compact && 'p-2')}>
        <h3 className={cn(
          'font-semibold text-foreground line-clamp-2 mb-2',
          compact ? 'text-sm' : 'text-base'
        )}>
          {recipe.title}
        </h3>

        {/* Macros */}
        {nutrition && (
          <div className="flex flex-wrap gap-1.5">
            <div className="macro-badge macro-calories">
              <Flame className="w-3 h-3" />
              <span>{nutrition.calories}</span>
            </div>
            <div className="macro-badge macro-protein">
              <span>P</span>
              <span>{nutrition.protein_g}g</span>
            </div>
            <div className="macro-badge macro-carbs">
              <span>C</span>
              <span>{nutrition.carbs_g}g</span>
            </div>
            <div className="macro-badge macro-fat">
              <span>F</span>
              <span>{nutrition.fat_g}g</span>
            </div>
          </div>
        )}

        {/* Servings */}
        {!compact && (
          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
            <Users className="w-3 h-3" />
            <span>{recipe.servings} servings</span>
          </div>
        )}
      </div>
    </motion.article>
  );
}
