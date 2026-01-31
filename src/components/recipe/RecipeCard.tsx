import { useState, useMemo } from 'react';
import { Clock, Users, Check, Plus, Trash2, Minus, Flame, Leaf, Fish, Drumstick, Sun, Heart, Droplets, Activity, Globe, Pizza, UtensilsCrossed, Soup, Cherry, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useNeutronStore } from '@/stores/neutronStore';
import { processNutrition, getNeutronBadges, type RawNutritionData, type NeutronMode } from '@/lib/neutron';
import { KetoLogicTooltip } from './KetoLogicTooltip';

interface NutritionData {
  calories?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  fiber_g?: number | null;
  sugar_alcohols_g?: number | null;
  sodium_mg?: number | null;
}

interface RecipeCardRecipe {
  id: string;
  title: string;
  image_url?: string | null;
  total_time?: number | null;
  servings?: number | null;
  cuisine?: string | null;
  is_kid_friendly?: boolean | null;
  is_meal_prep_friendly?: boolean | null;
  nutrition?: NutritionData | null;
  ingredients?: Array<{ name: string; normalized_name?: string | null }>;
  tags?: Array<{ tag_type: string; tag_value: string }>;
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

// Health badge tooltip definitions
const HEALTH_BADGE_TOOLTIPS: Record<string, string> = {
  'low-sodium': '< 300mg sodium per serving',
  'kidney-friendly': '< 400mg sodium + < 30g protein',
  'diabetes-friendly': '≥ 5g fiber + < 40g carbs',
  'heart-healthy': '≥ 5g fiber + < 300mg sodium',
};

// Diet badge tooltip definitions (Neutron-aware)
const DIET_BADGE_TOOLTIPS: Record<string, string> = {
  keto: '≤ 10g net carbs, ≥ 60% fat',
  paleo: 'No grains, legumes, dairy, or refined oils',
  mediterranean: 'No red meat, processed foods, or refined grains',
  vegan: 'No animal products',
  vegetarian: 'No meat or fish',
  pescatarian: 'Fish allowed, no meat',
};

// Cuisine badge config with colors and icons
const CUISINE_BADGES: Record<string, { label: string; icon: React.ReactNode; bgClass: string; textClass: string }> = {
  american: { label: 'American', icon: <UtensilsCrossed className="w-3 h-3" />, bgClass: 'bg-red-500/90', textClass: 'text-white' },
  italian: { label: 'Italian', icon: <Pizza className="w-3 h-3" />, bgClass: 'bg-green-700/90', textClass: 'text-white' },
  mexican: { label: 'Mexican', icon: <Cherry className="w-3 h-3" />, bgClass: 'bg-red-600/90', textClass: 'text-white' },
  asian: { label: 'Asian', icon: <Soup className="w-3 h-3" />, bgClass: 'bg-amber-500/90', textClass: 'text-white' },
  mediterranean: { label: 'Mediterranean', icon: <Sun className="w-3 h-3" />, bgClass: 'bg-orange-500/90', textClass: 'text-white' },
  indian: { label: 'Indian', icon: <Flame className="w-3 h-3" />, bgClass: 'bg-orange-600/90', textClass: 'text-white' },
  japanese: { label: 'Japanese', icon: <Fish className="w-3 h-3" />, bgClass: 'bg-pink-500/90', textClass: 'text-white' },
  thai: { label: 'Thai', icon: <Leaf className="w-3 h-3" />, bgClass: 'bg-teal-500/90', textClass: 'text-white' },
  french: { label: 'French', icon: <UtensilsCrossed className="w-3 h-3" />, bgClass: 'bg-blue-600/90', textClass: 'text-white' },
  greek: { label: 'Greek', icon: <Sun className="w-3 h-3" />, bgClass: 'bg-sky-600/90', textClass: 'text-white' },
  brazilian: { label: 'Brazilian', icon: <Leaf className="w-3 h-3" />, bgClass: 'bg-yellow-500/90', textClass: 'text-white' },
};

interface RecipeCardProps {
  recipe: RecipeCardRecipe;
  isSelected?: boolean;
  isRemovable?: boolean;
  isUserRecipe?: boolean; // Show "My Recipe" indicator
  onSelect?: () => void;
  onClick?: () => void;
  onDelete?: () => void;
  compact?: boolean;
  dietBadges?: string[]; // Override auto-detection if provided
  healthBadges?: string[]; // Override auto-detection if provided
  showCuisineBadge?: boolean;
  showKidBadge?: boolean;
  showKetoScore?: boolean; // Show keto score when in keto mode
}

export function RecipeCard({ 
  recipe, 
  isSelected = false,
  isRemovable = false,
  isUserRecipe = false,
  onSelect, 
  onClick,
  onDelete,
  compact = false,
  dietBadges: overrideDietBadges,
  healthBadges: overrideHealthBadges,
  showCuisineBadge = false,
  showKidBadge = false,
  showKetoScore = false,
}: RecipeCardProps) {
  const [imageError, setImageError] = useState(false);
  const mode = useNeutronStore((s) => s.mode);

  // Process nutrition through Neutron Engine
  const neutronResult = useMemo(() => {
    const rawNutrition: RawNutritionData = recipe.nutrition || {};
    const processed = processNutrition(rawNutrition, mode);
    const badges = getNeutronBadges(
      rawNutrition,
      recipe.ingredients,
      recipe.tags
    );
    return { nutrition: processed, badges };
  }, [recipe.nutrition, recipe.ingredients, recipe.tags, mode]);

  const { nutrition, badges } = neutronResult;
  
  // Check if we have valid nutrition data to display
  const hasNutrition = recipe.nutrition && (
    recipe.nutrition.calories != null || 
    recipe.nutrition.protein_g != null || 
    recipe.nutrition.carbs_g != null || 
    recipe.nutrition.fat_g != null
  );

  // Get cuisine badge if enabled
  const cuisineBadge = showCuisineBadge && recipe.cuisine 
    ? CUISINE_BADGES[recipe.cuisine.toLowerCase()] 
    : null;

  // Use provided badges or auto-detected from Neutron
  const effectiveDietBadges = overrideDietBadges ?? badges.dietBadges;
  const effectiveHealthBadges = overrideHealthBadges ?? badges.healthBadges;

  // Combine diet and health badges, show up to 3 to balance visibility with space
  const allBadges = [...effectiveDietBadges, ...effectiveHealthBadges];
  const visibleBadges = cuisineBadge ? allBadges.slice(0, 2) : allBadges.slice(0, 3);

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

        {/* Keto Score badge (when in keto mode and showKetoScore is true) */}
        {showKetoScore && mode === 'keto' && badges.ketoScore.score > 0 && (
          <KetoLogicTooltip nutrition={recipe.nutrition as RawNutritionData} showScore>
            <div className="absolute top-2 left-2 px-2 py-1 rounded-full bg-success text-success-foreground text-xs font-bold cursor-help">
              {badges.ketoScore.score}
            </div>
          </KetoLogicTooltip>
        )}

        {/* User Recipe indicator */}
        {isUserRecipe && !showKetoScore && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
                <User className="w-3.5 h-3.5" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              My Recipe
            </TooltipContent>
          </Tooltip>
        )}

        {/* Time badge */}
        {recipe.total_time && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 rounded-full bg-card/90 text-xs font-medium">
            <Clock className="w-3 h-3" />
            <span>{recipe.total_time} min</span>
          </div>
        )}

        {/* Cuisine, diet and health badges - single row */}
        <TooltipProvider delayDuration={300}>
          <div className="absolute bottom-2 right-2 flex items-center gap-1">
            {cuisineBadge && (
              <span
                className={cn(
                  'px-1.5 py-0.5 rounded-full text-2xs font-semibold flex items-center gap-0.5 whitespace-nowrap',
                  cuisineBadge.bgClass,
                  cuisineBadge.textClass
                )}
              >
                {cuisineBadge.icon}
                <span className="hidden sm:inline">{cuisineBadge.label}</span>
              </span>
            )}
            {visibleBadges.map((badgeKey) => {
              const badge = DIET_BADGES[badgeKey];
              if (!badge) return null;
              const tooltip = HEALTH_BADGE_TOOLTIPS[badgeKey] || DIET_BADGE_TOOLTIPS[badgeKey];
              
              const badgeElement = (
                <span
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

              // Keto badge: ALWAYS show KetoLogicTooltip for detailed analysis
              // (Only show optimizer tips section when in keto mode)
              if (badgeKey === 'keto') {
                return (
                  <KetoLogicTooltip 
                    key={badgeKey} 
                    nutrition={recipe.nutrition as RawNutritionData}
                    showScore
                    showOptimizer={mode === 'keto'} // Only show optimizer in keto mode
                  >
                    {badgeElement}
                  </KetoLogicTooltip>
                );
              }

              // Wrap other badges with standard tooltip if available
              if (tooltip) {
                return (
                  <Tooltip key={badgeKey}>
                    <TooltipTrigger asChild>
                      {badgeElement}
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {tooltip}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return <span key={badgeKey}>{badgeElement}</span>;
            })}
            {showKidBadge && recipe.is_kid_friendly && (
              <span className="px-1.5 py-0.5 rounded-full bg-warning/90 text-warning-foreground text-2xs font-medium whitespace-nowrap">
                👶<span className="hidden sm:inline"> Kid</span>
              </span>
            )}
          </div>
        </TooltipProvider>
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

        {/* Nutrition per serving - Neutron-aware */}
        {hasNutrition && (
          <div className="bg-muted/50 rounded-lg p-2 mt-1">
            <p className="text-2xs text-muted-foreground mb-1.5 font-medium">Per serving</p>
            <div className="flex items-center justify-between gap-1">
              <div className="text-center flex-1">
                <p className="text-sm font-bold text-[hsl(var(--calories))]">{Math.round(nutrition.calories)}</p>
                <p className="text-2xs text-muted-foreground">kcal</p>
              </div>
              <div className="text-center flex-1">
                <p className="text-sm font-bold text-[hsl(var(--protein))]">{Math.round(nutrition.protein)}g</p>
                <p className="text-2xs text-muted-foreground">protein</p>
              </div>
              <div className="text-center flex-1">
                <p className="text-sm font-bold text-[hsl(var(--fat))]">{Math.round(nutrition.fat)}g</p>
                <p className="text-2xs text-muted-foreground">fat</p>
              </div>
              <div className="text-center flex-1">
                <p className="text-sm font-bold text-[hsl(var(--carbs))]">{Math.round(nutrition.displayCarbs)}g</p>
                <p className="text-2xs text-muted-foreground whitespace-nowrap">{mode === 'keto' ? 'net' : 'carbs'}</p>
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
