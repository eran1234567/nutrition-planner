import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Flame, Drumstick, Droplet, Wheat, Leaf, Cookie, Heart, Zap } from 'lucide-react';
import type { IngredientItem } from './IngredientInput';

interface LiveNutritionHeaderProps {
  ingredients: IngredientItem[];
  servings?: number;
}

interface NutritionTotals {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  netCarbs: number;
  fiber: number;
  sugar: number;
  saturatedFat: number;
  cholesterol: number;
  sodium: number;
}

/**
 * Calculate nutrition totals from ingredients
 * Net Carbs = carbs - fiber (minimum 0) - aligned with ingredient_nutrition table columns
 */
function calculateTotals(ingredients: IngredientItem[]): NutritionTotals {
  return ingredients.reduce(
    (acc, ing) => {
      if (!ing.nutrition) return acc;
      
      // Get quantity multiplier (default to 1)
      const qty = parseFloat(ing.quantity) || 1;
      
      // Use carbs and fiber from nutrition object (maps to carbs_g and fiber_g in DB)
      const carbs = (ing.nutrition.carbs || 0) * qty;
      const fiber = (ing.nutrition.fiber || 0) * qty;
      
      // Net Carbs = Total Carbs - Fiber (minimum 0) - key keto calculation
      const netCarbs = Math.max(0, carbs - fiber);
      
      return {
        calories: acc.calories + (ing.nutrition.calories || 0) * qty,
        protein: acc.protein + (ing.nutrition.protein || 0) * qty,
        fat: acc.fat + (ing.nutrition.fat || 0) * qty,
        carbs: acc.carbs + carbs,
        netCarbs: acc.netCarbs + netCarbs,
        fiber: acc.fiber + fiber,
        sugar: acc.sugar + (ing.nutrition.sugar || 0) * qty,
        saturatedFat: acc.saturatedFat + (ing.nutrition.saturatedFat || 0) * qty,
        cholesterol: acc.cholesterol + (ing.nutrition.cholesterol || 0) * qty,
        sodium: acc.sodium + (ing.nutrition.sodium || 0) * qty,
      };
    },
    { calories: 0, protein: 0, fat: 0, carbs: 0, netCarbs: 0, fiber: 0, sugar: 0, saturatedFat: 0, cholesterol: 0, sodium: 0 }
  );
}

function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  return (
    <motion.span
      key={Math.round(value)}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="tabular-nums"
    >
      {Math.round(value)}{suffix}
    </motion.span>
  );
}

export function LiveNutritionHeader({ ingredients, servings = 1 }: LiveNutritionHeaderProps) {
  const { t } = useTranslation();
  
  // Calculate raw totals then normalize to per-serving when servings > 1
  const totals = useMemo(() => {
    const raw = calculateTotals(ingredients);
    const s = servings && servings > 0 ? servings : 1;
    if (s === 1) return raw;
    return {
      calories: raw.calories / s,
      protein: raw.protein / s,
      fat: raw.fat / s,
      carbs: raw.carbs / s,
      netCarbs: raw.netCarbs / s,
      fiber: raw.fiber / s,
      sugar: raw.sugar / s,
      saturatedFat: raw.saturatedFat / s,
      cholesterol: raw.cholesterol / s,
      sodium: raw.sodium / s,
    };
  }, [ingredients, servings]);
  
  const primaryMacros = [
    { 
      icon: Flame, 
      label: t('nutrition.cal', 'Cal'), 
      value: totals.calories, 
      suffix: '',
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10'
    },
    { 
      icon: Drumstick, 
      label: t('nutrition.protein', 'Protein'), 
      value: totals.protein, 
      suffix: 'g',
      color: 'text-red-500',
      bgColor: 'bg-red-500/10'
    },
    { 
      icon: Droplet, 
      label: t('nutrition.fat', 'Fat'), 
      value: totals.fat, 
      suffix: 'g',
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10'
    },
    { 
      icon: Wheat, 
      label: t('nutrition.carbs', 'Carbs'), 
      value: totals.carbs, 
      suffix: 'g',
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10'
    },
  ];

  const secondaryMacros = [
    { 
      icon: Leaf, 
      label: t('nutrition.fiber', 'Fiber'), 
      value: totals.fiber, 
      suffix: 'g',
      color: 'text-green-500',
      bgColor: 'bg-green-500/10'
    },
    { 
      icon: Cookie, 
      label: t('nutrition.sugar', 'Sugar'), 
      value: totals.sugar, 
      suffix: 'g',
      color: 'text-pink-500',
      bgColor: 'bg-pink-500/10'
    },
    { 
      icon: Droplet, 
      label: t('nutrition.satFat', 'Sat Fat'), 
      value: totals.saturatedFat, 
      suffix: 'g',
      color: 'text-amber-600',
      bgColor: 'bg-amber-600/10'
    },
    { 
      icon: Heart, 
      label: t('nutrition.chol', 'Chol'), 
      value: totals.cholesterol, 
      suffix: 'mg',
      color: 'text-rose-500',
      bgColor: 'bg-rose-500/10'
    },
    { 
      icon: Zap, 
      label: t('nutrition.sodium', 'Sodium'), 
      value: totals.sodium, 
      suffix: 'mg',
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10'
    },
  ];

  return (
    <div className="space-y-2">
      {/* Primary macros */}
      <div className="grid grid-cols-4 gap-2">
        {primaryMacros.map(({ icon: Icon, label, value, suffix, color, bgColor }) => (
          <div
            key={label}
            className={`flex flex-col items-center p-2 rounded-lg ${bgColor}`}
          >
            <Icon className={`w-4 h-4 ${color} mb-1`} />
            <span className={`text-sm font-bold ${color}`}>
              <AnimatedNumber value={value} suffix={suffix} />
            </span>
            <span className="text-[10px] text-muted-foreground truncate max-w-full">
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Net Carbs highlight */}
      <div className="text-center py-1">
        <span className="text-sm font-semibold text-green-600">
          {t('nutrition.netCarbs', 'Net Carbs')}: <AnimatedNumber value={totals.netCarbs} suffix="g" />
        </span>
      </div>

      {/* Secondary macros */}
      <div className="grid grid-cols-5 gap-1">
        {secondaryMacros.map(({ icon: Icon, label, value, suffix, color, bgColor }) => (
          <div
            key={label}
            className={`flex flex-col items-center p-1.5 rounded-lg ${bgColor}`}
          >
            <Icon className={`w-3 h-3 ${color} mb-0.5`} />
            <span className={`text-xs font-bold ${color}`}>
              <AnimatedNumber value={value} suffix={suffix} />
            </span>
            <span className="text-[9px] text-muted-foreground truncate max-w-full">
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
