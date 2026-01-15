export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive';
export type Goal = 'lose' | 'maintain' | 'gain';
export type DietType = 'none' | 'vegetarian' | 'vegan' | 'pescatarian' | 'keto' | 'paleo' | 'mediterranean';
export type DeficitType = 'standard' | 'custom_percent' | 'custom_calories';

export interface UserMetrics {
  age: number;
  weightKg: number;
  heightCm: number;
  sex: Sex;
  bodyFatPercent?: number;
}

export interface CalculationOptions {
  activityLevel: ActivityLevel;
  goal: Goal;
  useAdultOverride?: boolean;
}

export interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MacroRanges {
  protein: { min: number; max: number; default: number }; // g per lb LBM
  fat: { min: number; max: number; default: number }; // % of calories
}

export interface CalculationResult {
  bmr: number;
  tdee: number;
  targetCalories: number;
  leanBodyMassLbs: number;
  isYouth: boolean;
  macroRanges: MacroRanges;
  goalRestrictions: {
    loseDisabled: boolean;
    maxSurplusPercent: number;
    defaultSurplusPercent: number;
  };
}
