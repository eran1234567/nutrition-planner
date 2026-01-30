/**
 * Shared hook for recipe filtering
 * Used by both Discover and My Recipes pages
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useNeutronStore, syncNeutronMode } from '@/stores/neutronStore';
import { useUserData } from './useUserData';
import { useMealPlanStore } from '@/stores/mealPlanStore';
import { buildBlockedTerms, filterRecipes } from '@/lib/filters/utils';
import type { FilterableRecipe, RecipeFilterState, RecipeFilterActions } from '@/lib/filters/types';

interface UseRecipeFiltersOptions {
  /** If true, syncs diet type from macro calculator on initial load */
  syncFromCalculator?: boolean;
}

interface UseRecipeFiltersResult {
  // Filter state
  filters: RecipeFilterState;
  actions: RecipeFilterActions;
  
  // Computed values
  activeDietType: string | null;
  blockedTerms: string[];
  activeHealthPreferences: string[];
  isKetoMode: boolean;
  
  // Filter function
  applyFilters: (recipes: FilterableRecipe[]) => FilterableRecipe[];
}

export function useRecipeFilters(options: UseRecipeFiltersOptions = {}): UseRecipeFiltersResult {
  const { syncFromCalculator = false } = options;
  const { preferences } = useUserData();
  const { macroCalculatorInputs } = useMealPlanStore();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Track if user has explicitly cleared the diet filter
  const [dietExplicitlyCleared, setDietExplicitlyCleared] = useState(false);
  const hasSyncedDiet = useRef(false);
  
  // Get pending onboarding data from localStorage
  const pendingOnboarding = useMemo(() => {
    try {
      const raw = window.localStorage.getItem('pendingOnboarding');
      if (!raw) return null;
      return JSON.parse(raw) as {
        dietType?: string;
        allergies?: string[];
        dislikes?: string[];
        diabetesFriendly?: boolean;
        kidneyFriendly?: boolean;
        heartHealthy?: boolean;
        lowSodium?: boolean;
      };
    } catch {
      return null;
    }
  }, []);
  
  // Get effective values from preferences/onboarding
  const calculatorDietType = macroCalculatorInputs?.dietType && macroCalculatorInputs.dietType !== 'none'
    ? macroCalculatorInputs.dietType
    : null;
  
  const effectiveDietType = (calculatorDietType ?? pendingOnboarding?.dietType ?? preferences?.diet_type ?? 'none') as string;
  const effectiveAllergies = pendingOnboarding?.allergies ?? preferences?.allergies ?? [];
  const effectiveDislikes = pendingOnboarding?.dislikes ?? preferences?.dislikes ?? [];
  
  const healthPreferences = useMemo(() => {
    const prefs: string[] = [];
    if (preferences?.medical_diabetes_friendly || pendingOnboarding?.diabetesFriendly) prefs.push('diabetes-friendly');
    if (preferences?.medical_kidney_friendly || pendingOnboarding?.kidneyFriendly) prefs.push('kidney-friendly');
    if (preferences?.medical_heart_healthy || pendingOnboarding?.heartHealthy) prefs.push('heart-healthy');
    if (preferences?.medical_low_sodium || pendingOnboarding?.lowSodium) prefs.push('low-sodium');
    return prefs;
  }, [preferences, pendingOnboarding]);
  
  // Read filter values from URL params
  const filters: RecipeFilterState = {
    searchQuery: searchParams.get('q') || '',
    selectedTime: searchParams.get('time'),
    selectedMealType: searchParams.get('meal'),
    selectedCuisine: searchParams.get('cuisine'),
    selectedDietType: searchParams.get('diet'),
    selectedAllergies: useMemo(() => {
      const allergies = searchParams.get('allergies');
      return allergies ? allergies.split(',').filter(Boolean) : [];
    }, [searchParams]),
    selectedDislikes: useMemo(() => {
      const dislikes = searchParams.get('dislikes');
      return dislikes ? dislikes.split(',').filter(Boolean) : [];
    }, [searchParams]),
    selectedHealthConsiderations: useMemo(() => {
      const health = searchParams.get('health');
      return health ? health.split(',').filter(Boolean) : [];
    }, [searchParams]),
  };
  
  // Helper to update URL params
  const updateSearchParams = useCallback((key: string, value: string | string[] | null) => {
    const newParams = new URLSearchParams(searchParams);
    if (value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
      newParams.delete(key);
    } else if (Array.isArray(value)) {
      newParams.set(key, value.join(','));
    } else {
      newParams.set(key, value);
    }
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);
  
  // Filter actions
  const actions: RecipeFilterActions = {
    setSearchQuery: useCallback((value: string) => updateSearchParams('q', value || null), [updateSearchParams]),
    setSelectedTime: useCallback((value: string | null) => updateSearchParams('time', value), [updateSearchParams]),
    setSelectedMealType: useCallback((value: string | null) => updateSearchParams('meal', value), [updateSearchParams]),
    setSelectedCuisine: useCallback((value: string | null) => updateSearchParams('cuisine', value), [updateSearchParams]),
    setSelectedDietType: useCallback((value: string | null) => {
      if (value === null) {
        setDietExplicitlyCleared(true);
      }
      updateSearchParams('diet', value);
    }, [updateSearchParams]),
    setSelectedAllergies: useCallback((value: string[]) => updateSearchParams('allergies', value), [updateSearchParams]),
    setSelectedDislikes: useCallback((value: string[]) => updateSearchParams('dislikes', value), [updateSearchParams]),
    setSelectedHealthConsiderations: useCallback((value: string[]) => updateSearchParams('health', value), [updateSearchParams]),
    clearAllFilters: useCallback(() => {
      setSearchParams(new URLSearchParams(), { replace: true });
      setDietExplicitlyCleared(false);
    }, [setSearchParams]),
  };
  
  // Combine profile diet type with dropdown selection
  const activeDietType = dietExplicitlyCleared 
    ? filters.selectedDietType 
    : (filters.selectedDietType || (effectiveDietType === 'none' ? null : effectiveDietType));
  const userDietType = (activeDietType || 'none').toLowerCase();
  
  // Sync Neutron mode with keto filter state
  useEffect(() => {
    syncNeutronMode(userDietType);
  }, [userDietType]);
  
  // Sync diet from calculator on initial load (if enabled)
  // Also sync from user-enabled keto mode
  const isUserEnabledKetoMode = useNeutronStore((s) => s.isUserEnabledKetoMode);
  
  useEffect(() => {
    // If user explicitly enabled Keto Mode via the Discovery Banner, auto-set the filter
    if (isUserEnabledKetoMode() && !filters.selectedDietType && !dietExplicitlyCleared && !hasSyncedDiet.current) {
      hasSyncedDiet.current = true;
      updateSearchParams('diet', 'keto');
      return;
    }
    
    // Otherwise, sync from calculator if enabled
    if (syncFromCalculator && !hasSyncedDiet.current && !filters.selectedDietType && calculatorDietType && !dietExplicitlyCleared) {
      hasSyncedDiet.current = true;
      updateSearchParams('diet', calculatorDietType);
    }
  }, [syncFromCalculator, filters.selectedDietType, calculatorDietType, dietExplicitlyCleared, updateSearchParams, isUserEnabledKetoMode]);
  
  // Combine profile allergies/dislikes with dropdown selections
  const allAllergies = useMemo(() => 
    [...new Set([...effectiveAllergies, ...filters.selectedAllergies])],
    [effectiveAllergies, filters.selectedAllergies]
  );
  
  const allDislikes = useMemo(() => 
    [...new Set([...effectiveDislikes, ...filters.selectedDislikes])],
    [effectiveDislikes, filters.selectedDislikes]
  );
  
  // Build blocked terms
  const blockedTerms = useMemo(() => 
    buildBlockedTerms(allAllergies, allDislikes, userDietType),
    [allAllergies, allDislikes, userDietType]
  );
  
  // Active health preferences
  const activeHealthPreferences = useMemo(() => {
    const basePrefs = [...healthPreferences];
    filters.selectedHealthConsiderations.forEach(pref => {
      if (!basePrefs.includes(pref)) {
        basePrefs.push(pref);
      }
    });
    return basePrefs;
  }, [healthPreferences, filters.selectedHealthConsiderations]);
  
  const isKetoMode = useNeutronStore((s) => s.mode === 'keto');
  
  // Apply filters function
  const applyFilters = useCallback((recipes: FilterableRecipe[]) => {
    return filterRecipes(recipes, {
      searchQuery: filters.searchQuery,
      selectedTime: filters.selectedTime,
      selectedMealType: filters.selectedMealType,
      selectedCuisine: filters.selectedCuisine,
      selectedDietType: activeDietType,
      blockedTerms,
      healthConsiderations: activeHealthPreferences,
    });
  }, [filters, activeDietType, blockedTerms, activeHealthPreferences]);
  
  return {
    filters,
    actions,
    activeDietType,
    blockedTerms,
    activeHealthPreferences,
    isKetoMode,
    applyFilters,
  };
}
