/**
 * Shared types for recipe filtering
 */

export interface RecipeNutrition {
  calories?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  fiber_g?: number | null;
  sodium_mg?: number | null;
}

export interface RecipeIngredient {
  name: string;
  normalized_name?: string | null;
}

export interface RecipeTag {
  tag_type: string;
  tag_value: string;
}

export interface FilterableRecipe {
  id: string;
  title: string;
  description?: string | null;
  image_url?: string | null;
  total_time?: number | null;
  servings?: number | null;
  cuisine?: string | null;
  is_kid_friendly?: boolean | null;
  is_meal_prep_friendly?: boolean | null;
  nutrition?: RecipeNutrition | null;
  ingredients?: RecipeIngredient[];
  tags?: RecipeTag[];
}

export interface RecipeFilterState {
  searchQuery: string;
  selectedTime: string | null;
  selectedMealType: string | null;
  selectedCuisine: string | null;
  selectedDietType: string | null;
  selectedAllergies: string[];
  selectedDislikes: string[];
  selectedHealthConsiderations: string[];
}

export interface RecipeFilterActions {
  setSearchQuery: (value: string) => void;
  setSelectedTime: (value: string | null) => void;
  setSelectedMealType: (value: string | null) => void;
  setSelectedCuisine: (value: string | null) => void;
  setSelectedDietType: (value: string | null) => void;
  setSelectedAllergies: (value: string[]) => void;
  setSelectedDislikes: (value: string[]) => void;
  setSelectedHealthConsiderations: (value: string[]) => void;
  clearAllFilters: () => void;
}
