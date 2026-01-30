/**
 * Shared filter utility functions for recipe filtering
 * Uses Neutron Engine for keto compliance checking
 */

import { calculateNetCarbs, isKetoBadgeEligible, meetsHealthConsideration } from '@/lib/neutron';
import { dietExclusions, allergyExpansions, dislikeExpansions } from './constants';
import type { FilterableRecipe, RecipeNutrition, RecipeIngredient } from './types';

/**
 * Check if a recipe meets Neutron Engine keto criteria
 * Uses net carbs (total - fiber) for evaluation
 */
export function isKetoFriendly(nutrition: RecipeNutrition | null | undefined): boolean {
  if (!nutrition) return false;
  
  const totalCarbs = nutrition.carbs_g ?? 0;
  const fiber = nutrition.fiber_g ?? 0;
  const protein = nutrition.protein_g ?? 0;
  const fat = nutrition.fat_g ?? 0;
  
  // Calculate net carbs using Neutron Engine
  const netCarbs = calculateNetCarbs(totalCarbs, fiber, 0);
  
  // Use Neutron Engine's keto badge eligibility check
  return isKetoBadgeEligible(netCarbs, fat, protein);
}

/**
 * Check if a recipe meets paleo criteria (no grains, legumes, dairy, etc.)
 */
export function isPaleoFriendly(ingredients: RecipeIngredient[] | undefined): boolean {
  if (!ingredients || ingredients.length === 0) return false;
  
  const paleoExcluded = dietExclusions.paleo;
  
  return !ingredients.some(ing => {
    const ingName = (ing.normalized_name || ing.name || '').toLowerCase();
    return paleoExcluded.some(excluded => ingName.includes(excluded));
  });
}

/**
 * Check if a recipe meets mediterranean criteria
 */
export function isMediterraneanFriendly(ingredients: RecipeIngredient[] | undefined): boolean {
  if (!ingredients || ingredients.length === 0) return false;
  
  const medExcluded = dietExclusions.mediterranean;
  
  return !ingredients.some(ing => {
    const ingName = (ing.normalized_name || ing.name || '').toLowerCase();
    return medExcluded.some(excluded => ingName.includes(excluded));
  });
}

/**
 * Build diet badges for a recipe using Neutron Engine
 */
export function getDietBadges(recipe: FilterableRecipe): string[] {
  const badges: string[] = [];
  const recipeDietTags = (recipe.tags || [])
    .filter(t => t.tag_type === 'diet')
    .map(t => t.tag_value.toLowerCase());
  
  // Keto: auto-detect from macros using Neutron Engine
  if (isKetoFriendly(recipe.nutrition)) badges.push('keto');
  
  // Paleo: auto-detect from ingredients or use tag
  if (recipeDietTags.includes('paleo') || isPaleoFriendly(recipe.ingredients)) badges.push('paleo');
  
  // Mediterranean: auto-detect from ingredients or use tag
  if (recipeDietTags.includes('mediterranean') || isMediterraneanFriendly(recipe.ingredients)) badges.push('mediterranean');
  
  // Vegan, vegetarian, pescatarian: rely on tags
  ['vegan', 'vegetarian', 'pescatarian'].forEach(diet => {
    if (recipeDietTags.includes(diet) && !badges.includes(diet)) {
      badges.push(diet);
    }
  });
  
  return badges;
}

/**
 * Build blocked terms from allergies, dislikes, and diet type
 */
export function buildBlockedTerms(
  allergies: string[],
  dislikes: string[],
  dietType: string
): string[] {
  const normalize = (v: string) => v.trim().toLowerCase();
  
  // For keto, keyword-based diet exclusions (like "fried rice") are too aggressive
  // Keto compliance is enforced by strict macro validation (isKetoFriendly)
  const currentDietExclusions = dietType === 'keto' ? [] : (dietExclusions[dietType] || []);
  
  // Expand allergy terms to include specific ingredients
  const expandedAllergies = allergies.flatMap(allergy => {
    const allergyLower = allergy.toLowerCase();
    const expansions = allergyExpansions[allergyLower] || [];
    return [allergyLower, ...expansions];
  });
  
  // Expand dislike terms to include specific ingredients
  const expandedDislikes = dislikes.flatMap(dislike => {
    const dislikeLower = dislike.toLowerCase();
    const expansions = dislikeExpansions[dislikeLower] || [];
    return expansions.length > 0 ? expansions : [dislikeLower];
  });
  
  const base = [...currentDietExclusions, ...expandedAllergies, ...expandedDislikes]
    .filter(Boolean)
    .map(normalize)
    .filter(Boolean);
  
  // Add singular/plural variants
  const expanded = base.flatMap((term) => {
    const variants = new Set<string>();
    variants.add(term);
    if (term.endsWith('s') && term.length > 1) variants.add(term.slice(0, -1));
    else variants.add(`${term}s`);
    return Array.from(variants);
  });
  
  return Array.from(new Set(expanded)).filter(Boolean);
}

/**
 * Filter recipes based on filter state
 */
export function filterRecipes(
  recipes: FilterableRecipe[],
  options: {
    searchQuery?: string;
    selectedTime?: string | null;
    selectedMealType?: string | null;
    selectedCuisine?: string | null;
    selectedDietType?: string | null;
    blockedTerms?: string[];
    healthConsiderations?: string[];
  }
): FilterableRecipe[] {
  const {
    searchQuery = '',
    selectedTime,
    selectedMealType,
    selectedCuisine,
    selectedDietType,
    blockedTerms = [],
    healthConsiderations = [],
  } = options;

  return recipes.filter(recipe => {
    // Search filter
    if (searchQuery) {
      const searchTerms = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
      const titleLower = recipe.title.toLowerCase();
      const descLower = (recipe.description || '').toLowerCase();
      const matchesSearch = searchTerms.every(term => 
        titleLower.includes(term) || descLower.includes(term)
      );
      if (!matchesSearch) return false;
    }
    
    // Time filter
    if (selectedTime && recipe.total_time && recipe.total_time > parseInt(selectedTime)) {
      return false;
    }
    
    // Meal type filter
    if (selectedMealType) {
      const mealTypesToMatch = selectedMealType === 'lunch' || selectedMealType === 'dinner' 
        ? ['lunch', 'dinner'] 
        : [selectedMealType];
      if (!recipe.tags?.some(t => t.tag_type === 'meal' && mealTypesToMatch.includes(t.tag_value))) {
        return false;
      }
    }
    
    // Cuisine filter
    if (selectedCuisine && recipe.cuisine?.toLowerCase() !== selectedCuisine.toLowerCase()) {
      return false;
    }
    
    // Diet type filter using Neutron Engine
    if (selectedDietType) {
      const dietBadges = getDietBadges(recipe);
      if (!dietBadges.includes(selectedDietType.toLowerCase())) {
        return false;
      }
    }
    
    // Blocked terms filter (allergies, dislikes, diet exclusions)
    if (blockedTerms.length > 0 && recipe.ingredients) {
      const hasBlocked = recipe.ingredients.some(ing => {
        const ingName = (ing.normalized_name || ing.name || '').toLowerCase();
        return blockedTerms.some(term => ingName.includes(term));
      });
      if (hasBlocked) return false;
    }
    
    // Health considerations filter
    if (healthConsiderations.length > 0) {
      const meetsAll = healthConsiderations.every(consideration =>
        meetsHealthConsideration(consideration, recipe.nutrition as any)
      );
      if (!meetsAll) return false;
    }
    
    return true;
  });
}
