export type UnitSystem = 'imperial' | 'metric';
export type ScopeType = 'private' | 'household' | 'global';
export type UploadStatus = 'pending' | 'parsing' | 'parsed' | 'failed';
export type MemberRole = 'owner' | 'admin' | 'member';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type DietType = 'none' | 'vegetarian' | 'vegan' | 'pescatarian' | 'keto' | 'paleo' | 'mediterranean';

export interface Profile {
  id: string;
  user_id: string;
  household_id?: string;
  display_name?: string;
  avatar_url?: string;
  age?: number;
  is_child: boolean;
  locale: string;
  units: UnitSystem;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Preferences {
  id: string;
  profile_id?: string;
  member_id?: string;
  diet_type: DietType;
  allergies: string[];
  dislikes: string[];
  calorie_target?: number;
  protein_target?: number;
  carbs_target?: number;
  fat_target?: number;
  fiber_target?: number;
  meals_per_day: number;
  medical_diabetes_friendly: boolean;
  medical_kidney_friendly: boolean;
  medical_heart_healthy: boolean;
  medical_low_sodium: boolean;
  medical_disclaimer_accepted: boolean;
  max_cook_time: number;
  budget_level: string;
  cuisines_preferred: string[];
  equipment_available: string[];
}

export interface Recipe {
  id: string;
  owner_user_id?: string;
  household_id?: string;
  scope: ScopeType;
  title: string;
  description?: string;
  servings: number;
  prep_time?: number;
  cook_time?: number;
  total_time?: number;
  cuisine?: string;
  difficulty: string;
  notes?: string;
  image_url?: string;
  is_kid_friendly: boolean;
  is_meal_prep_friendly: boolean;
  is_budget_friendly: boolean;
  is_deleted: boolean;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
  // Joined data
  nutrition?: RecipeNutrition;
  ingredients?: RecipeIngredient[];
  steps?: RecipeStep[];
  tags?: RecipeTag[];
}

export interface RecipeNutrition {
  id: string;
  recipe_id: string;
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  fiber_g?: number;
  sodium_mg?: number;
  sugar_g?: number;
  saturated_fat_g?: number;
  cholesterol_mg?: number;
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  name: string;
  quantity?: number;
  unit?: string;
  normalized_name?: string;
  aisle?: string;
  order_index: number;
}

export interface RecipeStep {
  id: string;
  recipe_id: string;
  step_number: number;
  instruction: string;
}

export interface RecipeTag {
  id: string;
  recipe_id: string;
  tag_type: string;
  tag_value: string;
}

export interface MealPlan {
  id: string;
  profile_id?: string;
  household_id?: string;
  week_start: string;
  name?: string;
  is_active: boolean;
  created_at: string;
  days?: MealPlanDay[];
}

export interface MealPlanDay {
  id: string;
  meal_plan_id: string;
  day_date: string;
  day_index: number;
  meals?: MealPlanMeal[];
}

export interface MealPlanMeal {
  id: string;
  meal_plan_day_id: string;
  recipe_id: string;
  meal_type: MealType;
  servings: number;
  is_leftover: boolean;
  leftover_from_meal_id?: string;
  notes?: string;
  recipe?: Recipe;
}

export interface GroceryListItem {
  id: string;
  meal_plan_id: string;
  ingredient_name: string;
  quantity?: number;
  unit?: string;
  aisle?: string;
  is_checked: boolean;
  is_pantry_staple: boolean;
  created_at: string;
}

export interface Household {
  id: string;
  name: string;
  owner_user_id: string;
  locale: string;
  units_default: UnitSystem;
  created_at: string;
  updated_at: string;
  members?: HouseholdMember[];
}

export interface HouseholdMember {
  id: string;
  household_id: string;
  user_id?: string;
  member_name: string;
  avatar_url?: string;
  age?: number;
  is_child: boolean;
  role: MemberRole;
  created_at: string;
}

export interface Upload {
  id: string;
  owner_user_id: string;
  household_id?: string;
  scope: ScopeType;
  file_url?: string;
  file_name?: string;
  file_type?: string;
  source_url?: string;
  status: UploadStatus;
  parsed_text?: string;
  error_message?: string;
  created_at: string;
}

// For onboarding wizard state
export interface OnboardingState {
  step: number;
  totalSteps: number;
  settings: {
    units: UnitSystem;
    locale: string;
  };
  profile: {
    displayName: string;
    age?: number;
    isChild: boolean;
  };
  diet: {
    type: DietType;
    mealsPerDay: number;
  };
  macros: {
    useDefaults: boolean;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  };
  restrictions: {
    allergies: string[];
    dislikes: string[];
  };
  medical: {
    diabetesFriendly: boolean;
    kidneyFriendly: boolean;
    heartHealthy: boolean;
    lowSodium: boolean;
    disclaimerAccepted: boolean;
  };
  cuisine: {
    preferred: string[];
    budget: string;
  };
  household: {
    members: Array<{
      name: string;
      age?: number;
      isChild: boolean;
    }>;
  };
}
