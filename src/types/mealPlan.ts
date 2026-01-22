export type MealSlotId = 'breakfast' | 'snack-1' | 'lunch' | 'snack-2' | 'dinner' | 'snack-3';

export interface MealSlot {
  id: MealSlotId;
  label: string;
  percentOfDay: number;
  type: 'breakfast' | 'snack' | 'lunch' | 'dinner';
}

export interface DailyTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface SlotTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface RecipePoolEntry {
  recipeId: string;
}

export interface ExactAssignment {
  recipeId: string;
  servingMultiplier: number;
  isLocked: boolean;
}

export interface GeneratedSlot {
  slotId: MealSlotId;
  recipeId: string;
  servingMultiplier: number;
  isLocked: boolean;
  slotTotals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

// Top-up item added to fill macro gaps
export interface DayExtra {
  id: string;
  name: string;
  emoji: string;
  macros: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

export interface GeneratedDay {
  dayIndex: number;
  slots: GeneratedSlot[];
  extras?: DayExtra[]; // Top-up items for filling macro gaps
  dayTotals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  deltaVsTarget: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

export interface GeneratedPlan {
  days: GeneratedDay[];
  createdAt: string;
}

export const MEAL_SLOT_DEFINITIONS: Record<MealSlotId, { label: string; type: 'breakfast' | 'snack' | 'lunch' | 'dinner' }> = {
  'breakfast': { label: 'Breakfast', type: 'breakfast' },
  'snack-1': { label: 'Morning Snack', type: 'snack' },
  'lunch': { label: 'Lunch', type: 'lunch' },
  'snack-2': { label: 'Afternoon Snack', type: 'snack' },
  'dinner': { label: 'Dinner', type: 'dinner' },
  'snack-3': { label: 'Evening Snack', type: 'snack' },
};

export const DEFAULT_SLOT_PERCENTS: Record<MealSlotId, number> = {
  'breakfast': 25,
  'snack-1': 10,
  'lunch': 30,
  'snack-2': 10,
  'dinner': 25,
  'snack-3': 0,
};

export function getDefaultPercentsForSlots(slotIds: MealSlotId[]): Record<MealSlotId, number> {
  if (slotIds.length === 0) return {} as Record<MealSlotId, number>;
  
  // Filter to only include requested slots
  const hasSnacks = slotIds.some(id => id.includes('snack'));
  const mainMeals = slotIds.filter(id => !id.includes('snack'));
  const snacks = slotIds.filter(id => id.includes('snack'));
  
  const result: Partial<Record<MealSlotId, number>> = {};
  
  if (snacks.length === 0) {
    // No snacks - distribute evenly among main meals
    const perMeal = Math.floor(100 / mainMeals.length);
    const remainder = 100 - (perMeal * mainMeals.length);
    mainMeals.forEach((id, i) => {
      result[id] = perMeal + (i === 0 ? remainder : 0);
    });
  } else {
    // With snacks - give snacks 10% each, rest to main meals
    const snackPercent = 10;
    const totalSnackPercent = snacks.length * snackPercent;
    const remainingPercent = 100 - totalSnackPercent;
    const perMainMeal = Math.floor(remainingPercent / mainMeals.length);
    const remainder = remainingPercent - (perMainMeal * mainMeals.length);
    
    mainMeals.forEach((id, i) => {
      result[id] = perMainMeal + (i === 0 ? remainder : 0);
    });
    snacks.forEach(id => {
      result[id] = snackPercent;
    });
  }
  
  return result as Record<MealSlotId, number>;
}

// Finer-grained multipliers for more precise macro matching
export const SERVING_MULTIPLIERS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 2.75, 3.0] as const;
