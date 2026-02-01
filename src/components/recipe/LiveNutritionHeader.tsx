import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Flame, Drumstick, Droplet, Wheat } from 'lucide-react';
import type { IngredientItem } from './IngredientInput';

interface LiveNutritionHeaderProps {
  ingredients: IngredientItem[];
}

interface NutritionTotals {
  calories: number;
  protein: number;
  fat: number;
  netCarbs: number;
}

function calculateTotals(ingredients: IngredientItem[]): NutritionTotals {
  return ingredients.reduce(
    (acc, ing) => {
      if (!ing.nutrition) return acc;
      
      // Get quantity multiplier (default to 1)
      const qty = parseFloat(ing.quantity) || 1;
      
      const carbs = (ing.nutrition.carbs || 0) * qty;
      const fiber = (ing.nutrition.fiber || 0) * qty;
      // Net Carbs = Total Carbs - Fiber (minimum 0)
      const netCarbs = Math.max(0, carbs - fiber);
      
      return {
        calories: acc.calories + (ing.nutrition.calories || 0) * qty,
        protein: acc.protein + (ing.nutrition.protein || 0) * qty,
        fat: acc.fat + (ing.nutrition.fat || 0) * qty,
        netCarbs: acc.netCarbs + netCarbs,
      };
    },
    { calories: 0, protein: 0, fat: 0, netCarbs: 0 }
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

export function LiveNutritionHeader({ ingredients }: LiveNutritionHeaderProps) {
  const { t } = useTranslation();
  
  const totals = useMemo(() => calculateTotals(ingredients), [ingredients]);
  
  const macros = [
    { 
      icon: Flame, 
      label: t('nutrition.calories', 'Calories'), 
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
      label: t('nutrition.netCarbs', 'Net Carbs'), 
      value: totals.netCarbs, 
      suffix: 'g',
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10'
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-2">
      {macros.map(({ icon: Icon, label, value, suffix, color, bgColor }) => (
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
  );
}
