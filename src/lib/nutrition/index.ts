// Types
export * from './types';

// Constants
export {
  YOUTH_AGE_THRESHOLD,
  ACTIVITY_MULTIPLIERS,
  YOUTH_ACTIVITY_COEFFICIENTS,
  ADULT_GOAL_MULTIPLIERS,
  YOUTH_GOAL_SETTINGS,
  ADULT_GOAL_SETTINGS,
  YOUTH_MACRO_RANGES,
  ADULT_MACRO_RANGES,
  KETO_MACRO_RANGES,
  SCHOFIELD_COEFFICIENTS,
  YOUTH_GROWTH_ALLOWANCE,
} from './constants';

// BMR functions
export {
  calculateLeanBodyMassKg,
  estimateBodyFatPercent,
  calculateKatchMcArdleBMR,
  calculateMifflinStJeorBMR,
  calculateSchofieldBMR,
  calculateBMR,
  isYouthMode,
} from './bmr';

// TDEE functions
export {
  calculateYouthEER,
  calculateAdultTDEE,
  calculateTDEE,
  getGoalRestrictions,
  calculateTargetCalories,
} from './tdee';

// Macro functions
export {
  getMacroRanges,
  calculateMacros,
  calculateCaloriesFromMacros,
  validateMacroCalorieMatch,
  validateMacroDistribution,
  validateKetoCarbs,
  getDefaultMacroSettings,
  convertWeight,
  convertHeight,
  feetInchesToCm,
  cmToFeetInches,
} from './macros';
