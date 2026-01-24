import { useState } from 'react';
import { Clock, Users, Check, Plus, Trash2, Minus, Flame, Leaf, Fish, Drumstick, Sun, Heart, Droplets, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface NutritionData {
  calories?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
}

interface RecipeCardRecipe {
  id: string;
  title: string;
  image_url?: string | null;
  total_time?: number | null;
  servings?: number | null;
  is_kid_friendly?: boolean | null;
  is_meal_prep_friendly?: boolean | null;
  nutrition?: NutritionData | null;
  // Allow additional properties from different recipe types
  [key: string]: unknown;
}

// Diet badge config with colors and icons
const DIET_BADGES: Record<string, { label: string; icon: React.ReactNode; bgClass: string; textClass: string }> = {
  keto: { label: 'Keto', icon: <Flame className="w-3 h-3" />, bgClass: 'bg-emerald-500/90', textClass: 'text-white' },
  vegan: { label: 'Vegan', icon: <Leaf className="w-3 h-3" />, bgClass: 'bg-green-600/90', textClass: 'text-white' },
  vegetarian: { label: 'Vegetarian', icon: <Leaf className="w-3 h-3" />, bgClass: 'bg-lime-500/90', textClass: 'text-white' },
  pescatarian: { label: 'Pescatarian', icon: <Fish className="w-3 h-3" />, bgClass: 'bg-sky-500/90', textClass: 'text-white' },
  paleo: { label: 'Paleo', icon: <Drumstick className="w-3 h-3" />, bgClass: 'bg-amber-600/90', textClass: 'text-white' },
  mediterranean: { label: 'Mediterranean', icon: <Sun className="w-3 h-3" />, bgClass: 'bg-orange-500/90', textClass: 'text-white' },
  // Health consideration badges
  'diabetes-friendly': { label: 'Diabetes', icon: <Activity className="w-3 h-3" />, bgClass: 'bg-blue-500/90', textClass: 'text-white' },
  'heart-healthy': { label: 'Heart', icon: <Heart className="w-3 h-3" />, bgClass: 'bg-rose-500/90', textClass: 'text-white' },
  'low-sodium': { label: 'Low Na', icon: <Droplets className="w-3 h-3" />, bgClass: 'bg-cyan-500/90', textClass: 'text-white' },
  'kidney-friendly': { label: 'Kidney', icon: <Droplets className="w-3 h-3" />, bgClass: 'bg-purple-500/90', textClass: 'text-white' },
};

interface RecipeCardProps {
  recipe: RecipeCardRecipe;
  isSelected?: boolean;
  isRemovable?: boolean;
  onSelect?: () => void;
  onClick?: () => void;
  onDelete?: () => void;
  compact?: boolean;
  dietBadges?: string[]; // Array of diet types to show as badges
  healthBadges?: string[]; // Array of health considerations to show as badges
  showKidBadge?: boolean;
}

export function RecipeCard({ 
  recipe, 
  isSelected = false,
  isRemovable = false,
  onSelect, 
  onClick,
  onDelete,
  compact = false,
  dietBadges = [],
  healthBadges = [],
  showKidBadge = false
}: RecipeCardProps) {
  const nutrition = recipe.nutrition;
  const [imageError, setImageError] = useState(false);
  
  // Check if we have valid nutrition data to display
  const hasNutrition = nutrition && (
    nutrition.calories != null || 
    nutrition.protein_g != null || 
    nutrition.carbs_g != null || 
    nutrition.fat_g != null
  );

  // Combine diet and health badges, show up to 3 to balance visibility with space
  const allBadges = [...dietBadges, ...healthBadges];
  const visibleBadges = allBadges.slice(0, 3);

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'recipe-card cursor-pointer h-full flex flex-col',
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
              isRemovable
                ? 'bg-destructive text-destructive-foreground shadow-lg hover:bg-destructive/90'
                : isSelected 
                  ? 'bg-primary text-primary-foreground shadow-lg' 
                  : 'bg-card/90 text-muted-foreground hover:bg-card'
            )}
          >
            {isRemovable ? <Minus className="w-5 h-5" /> : isSelected ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
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

        {/* Diet and health badges - single row */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1">
          {visibleBadges.map((badgeKey) => {
            const badge = DIET_BADGES[badgeKey];
            if (!badge) return null;
            return (
              <span
                key={badgeKey}
                className={cn(
                  'px-1.5 py-0.5 rounded-full text-2xs font-semibold flex items-center gap-0.5 whitespace-nowrap',
                  badge.bgClass,
                  badge.textClass
                )}
              >
                {badge.icon}
                <span className="hidden sm:inline">{badge.label}</span>
              </span>
            );
          })}
          {showKidBadge && recipe.is_kid_friendly && (
            <span className="px-1.5 py-0.5 rounded-full bg-warning/90 text-warning-foreground text-2xs font-medium whitespace-nowrap">
              👶<span className="hidden sm:inline"> Kid</span>
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={cn('p-3 flex-1 flex flex-col', compact && 'p-2')}>
        {/* Fixed height title area to ensure consistent alignment */}
        <div className="h-[3rem] mb-2">
          <h3 className={cn(
            'font-semibold text-foreground line-clamp-2',
            compact ? 'text-sm' : 'text-base'
          )}>
            {recipe.title}
          </h3>
        </div>

        {/* Nutrition per serving */}
        {hasNutrition && (
          <div className="bg-muted/50 rounded-lg p-2 mt-1">
            <p className="text-2xs text-muted-foreground mb-1.5 font-medium">Per serving</p>
            <div className="flex items-center justify-between gap-1">
              <div className="text-center flex-1">
                <p className="text-sm font-bold text-[hsl(var(--calories))]">{nutrition?.calories ?? '-'}</p>
                <p className="text-2xs text-muted-foreground">kcal</p>
              </div>
              <div className="text-center flex-1">
                <p className="text-sm font-bold text-[hsl(var(--protein))]">{nutrition?.protein_g ?? '-'}g</p>
                <p className="text-2xs text-muted-foreground">protein</p>
              </div>
              <div className="text-center flex-1">
                <p className="text-sm font-bold text-[hsl(var(--carbs))]">{nutrition?.carbs_g ?? '-'}g</p>
                <p className="text-2xs text-muted-foreground">carbs</p>
              </div>
              <div className="text-center flex-1">
                <p className="text-sm font-bold text-[hsl(var(--fat))]">{nutrition?.fat_g ?? '-'}g</p>
                <p className="text-2xs text-muted-foreground">fat</p>
              </div>
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
