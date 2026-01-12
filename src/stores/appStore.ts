import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { UnitSystem, OnboardingState, Recipe, GroceryListItem } from '@/types';

interface AppState {
  // User settings
  units: UnitSystem;
  locale: string;
  setUnits: (units: UnitSystem) => void;
  setLocale: (locale: string) => void;

  // Onboarding
  onboardingState: OnboardingState;
  setOnboardingStep: (step: number) => void;
  updateOnboarding: (updates: Partial<OnboardingState>) => void;
  resetOnboarding: () => void;

  // Selected meals for plan generation
  selectedMeals: Recipe[];
  addSelectedMeal: (recipe: Recipe) => void;
  removeSelectedMeal: (recipeId: string) => void;
  clearSelectedMeals: () => void;

  // Offline grocery list cache
  groceryCache: GroceryListItem[];
  setGroceryCache: (items: GroceryListItem[]) => void;
  toggleGroceryItem: (itemId: string) => void;

  // UI state
  isOnline: boolean;
  setIsOnline: (online: boolean) => void;
}

const initialOnboardingState: OnboardingState = {
  step: 0,
  totalSteps: 7,
  settings: {
    units: 'imperial',
    locale: 'en',
  },
  profile: {
    displayName: '',
    age: undefined,
    isChild: false,
  },
  diet: {
    type: 'none',
    mealsPerDay: 3,
  },
  macros: {
    useDefaults: true,
    calories: undefined,
    protein: undefined,
    carbs: undefined,
    fat: undefined,
  },
  restrictions: {
    allergies: [],
    dislikes: [],
  },
  medical: {
    diabetesFriendly: false,
    kidneyFriendly: false,
    heartHealthy: false,
    lowSodium: false,
    disclaimerAccepted: false,
  },
  cuisine: {
    preferred: [],
    budget: 'medium',
  },
  household: {
    members: [],
  },
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // User settings
      units: 'imperial',
      locale: 'en',
      setUnits: (units) => set({ units }),
      setLocale: (locale) => set({ locale }),

      // Onboarding
      onboardingState: initialOnboardingState,
      setOnboardingStep: (step) =>
        set((state) => ({
          onboardingState: { ...state.onboardingState, step },
        })),
      updateOnboarding: (updates) =>
        set((state) => ({
          onboardingState: { ...state.onboardingState, ...updates },
        })),
      resetOnboarding: () => set({ onboardingState: initialOnboardingState }),

      // Selected meals
      selectedMeals: [],
      addSelectedMeal: (recipe) =>
        set((state) => ({
          selectedMeals: [...state.selectedMeals, recipe],
        })),
      removeSelectedMeal: (recipeId) =>
        set((state) => ({
          selectedMeals: state.selectedMeals.filter((r) => r.id !== recipeId),
        })),
      clearSelectedMeals: () => set({ selectedMeals: [] }),

      // Grocery cache
      groceryCache: [],
      setGroceryCache: (items) => set({ groceryCache: items }),
      toggleGroceryItem: (itemId) =>
        set((state) => ({
          groceryCache: state.groceryCache.map((item) =>
            item.id === itemId ? { ...item, is_checked: !item.is_checked } : item
          ),
        })),

      // UI state
      isOnline: true,
      setIsOnline: (online) => set({ isOnline: online }),
    }),
    {
      name: 'nutrition-planner-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        units: state.units,
        locale: state.locale,
        groceryCache: state.groceryCache,
      }),
    }
  )
);
