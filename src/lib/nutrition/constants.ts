import type { ActivityLevel, Goal, MacroRanges } from './types';

// Age threshold for youth calculations
export const YOUTH_AGE_THRESHOLD = 18;

// Activity multipliers for TDEE (adults)
export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  veryActive: 1.9,
};

// Physical Activity Level coefficients for Youth EER (IOM DRI)
export const YOUTH_ACTIVITY_COEFFICIENTS = {
  male: {
    sedentary: 1.0,
    light: 1.13,
    moderate: 1.26,
    active: 1.42,
    veryActive: 1.42, // Same as active for youth
  },
  female: {
    sedentary: 1.0,
    light: 1.16,
    moderate: 1.31,
    active: 1.56,
    veryActive: 1.56, // Same as active for youth
  },
} as const;

// Goal multipliers for adults
export const ADULT_GOAL_MULTIPLIERS: Record<Goal, number> = {
  lose: 0.8, // 20% deficit
  maintain: 1.0,
  gain: 1.1, // 10% surplus (default)
};

// Goal settings for youth
export const YOUTH_GOAL_SETTINGS = {
  maxSurplusPercent: 10,
  defaultSurplusPercent: 5,
  loseDisabled: true, // Weight loss disabled for youth
};

// Goal settings for adults
export const ADULT_GOAL_SETTINGS = {
  maxSurplusPercent: 20,
  defaultSurplusPercent: 10,
  loseDisabled: false,
};

// Macro ranges for youth (more conservative)
export const YOUTH_MACRO_RANGES: MacroRanges = {
  protein: { min: 0.6, max: 1.1, default: 0.8 }, // g per lb LBM
  fat: { min: 25, max: 35, default: 30 }, // % of calories
};

// Macro ranges for adults
export const ADULT_MACRO_RANGES: MacroRanges = {
  protein: { min: 0.8, max: 1.4, default: 1.2 }, // g per lb LBM
  fat: { min: 20, max: 35, default: 25 }, // % of calories
};

// Keto-specific macro ranges (same for youth and adults)
export const KETO_MACRO_RANGES: MacroRanges = {
  protein: { min: 0.6, max: 1.0, default: 0.8 },
  fat: { min: 65, max: 80, default: 70 },
};

// Schofield BMR coefficients by age band and sex (WHO/FAO/UNU)
// Format: { maleCoefficients, femaleCoefficients } for each age band
export const SCHOFIELD_COEFFICIENTS = {
  // 0-3 years
  infant: {
    male: { weightMultiplier: 60.9, constant: -54 },
    female: { weightMultiplier: 61.0, constant: -51 },
  },
  // 3-10 years
  child: {
    male: { weightMultiplier: 22.7, constant: 495 },
    female: { weightMultiplier: 22.5, constant: 499 },
  },
  // 10-18 years
  adolescent: {
    male: { weightMultiplier: 17.5, constant: 651 },
    female: { weightMultiplier: 12.2, constant: 746 },
  },
} as const;

// Growth allowance for youth TDEE (kcal/day)
export const YOUTH_GROWTH_ALLOWANCE = {
  default: 20, // 15-30 kcal/day typical range
  min: 15,
  max: 30,
};
