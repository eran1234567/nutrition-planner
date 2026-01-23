import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { 
  MealSlot, 
  MealSlotId, 
  DailyTargets, 
  GeneratedPlan,
  DayExtra,
  MEAL_SLOT_DEFINITIONS,
} from '@/types/mealPlan';
import { getDefaultPercentsForSlots } from '@/types/mealPlan';

// Macro gap context for smart recipe sorting
export interface MacroGapContext {
  proteinGap: number;
  carbsGap: number;
  fatGap: number;
  caloriesGap: number;
  primaryGap: 'protein' | 'carbs' | 'fat' | null;
}

// Macro calculator inputs for persistence
export interface MacroCalculatorInputs {
  age: string;
  weight: string;
  height: string;
  heightFt: string;
  heightIn: string;
  sex: 'male' | 'female';
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive';
  goal: 'lose' | 'maintain' | 'gain';
  unit: 'metric' | 'imperial';
  bodyFatMethod: 'direct' | 'navy';
  bodyFatPercent: string;
  waist: string;
  neck: string;
  hip: string;
  // Distribution step values
  dietType: 'none' | 'vegetarian' | 'vegan' | 'pescatarian' | 'keto' | 'paleo' | 'mediterranean';
  deficitType: 'standard' | 'custom_percent' | 'custom_deficit_calories' | 'custom_calories';
  customDeficitPercent: number;
  customCalories: string;
  customDeficitCalories: string;
  proteinPerLb: number;
  carbsPercent: number;
  fatPercent: number;
  lastAdjusted: 'carbs' | 'fat'; // tracks which macro to auto-calc
}

// Swap context for direct recipe replacement
export interface SwapContext {
  dayIndex: number;
  slotId: MealSlotId;
  originalRecipeName: string;
  slotLabel: string;
}

interface MealPlanState {
  // Current user ID for storage isolation
  currentUserId: string | null;
  
  // Plan configuration (from modal)
  dailyTargets: DailyTargets | null;
  selectedMealSlots: MealSlot[];
  numberOfDays: number;
  
  // Recipe selection
  recipePoolsBySlot: Record<string, string[]>; // slotId -> recipeIds
  exactAssignments: Record<number, Record<string, { recipeId: string; servingMultiplier: number }>>; // dayIndex -> slotId -> assignment
  
  // Generated plan
  generatedPlan: GeneratedPlan | null;
  lockedSlots: Record<number, string[]>; // dayIndex -> slotIds that are locked
  
  // Plan mode state
  isPlanMode: boolean;
  currentSlotFilter: MealSlotId | null;
  lastSelectedSlot: MealSlotId | null;
  
  // Swap context for direct replacement (set when clicking swap on an existing slot)
  swapContext: SwapContext | null;
  
  // Macro gap context for smart swaps
  macroGapContext: MacroGapContext | null;
  
  // Macro calculator saved inputs
  macroCalculatorInputs: MacroCalculatorInputs | null;
  
  // Actions
  setCurrentUserId: (userId: string | null) => void;
  setDailyTargets: (targets: DailyTargets) => void;
  setSelectedMealSlots: (slots: MealSlot[]) => void;
  setNumberOfDays: (days: number) => void;
  
  // Recipe pool actions
  addToPool: (slotId: string, recipeId: string) => void;
  removeFromPool: (slotId: string, recipeId: string) => void;
  clearPool: (slotId: string) => void;
  clearAllPools: () => void;
  
  // Exact assignment actions
  setExactAssignment: (dayIndex: number, slotId: string, recipeId: string, servingMultiplier?: number) => void;
  removeExactAssignment: (dayIndex: number, slotId: string) => void;
  clearExactAssignments: () => void;
  
  // Generated plan actions
  setGeneratedPlan: (plan: GeneratedPlan) => void;
  clearGeneratedPlan: () => void;
  updateSlotMultiplier: (dayIndex: number, slotId: string, multiplier: number) => void;
  toggleSlotLock: (dayIndex: number, slotId: string) => void;
  swapRecipe: (dayIndex: number, slotId: string, newRecipeId: string) => void;
  addDayExtra: (dayIndex: number, extra: DayExtra) => void;
  removeDayExtra: (dayIndex: number, extraId: string) => void;
  
  // Mode actions
  setIsPlanMode: (isPlanMode: boolean) => void;
  setCurrentSlotFilter: (slotId: MealSlotId | null) => void;
  setLastSelectedSlot: (slotId: MealSlotId | null) => void;
  setSwapContext: (context: SwapContext | null) => void;
  setMacroGapContext: (context: MacroGapContext | null) => void;
  setMacroCalculatorInputs: (inputs: MacroCalculatorInputs | null) => void;
  
  // Reset
  resetPlanState: () => void;
}

const initialState = {
  currentUserId: null,
  dailyTargets: null,
  selectedMealSlots: [],
  numberOfDays: 7,
  recipePoolsBySlot: {},
  exactAssignments: {},
  generatedPlan: null,
  lockedSlots: {},
  isPlanMode: false,
  currentSlotFilter: null,
  lastSelectedSlot: null,
  swapContext: null,
  macroGapContext: null,
  macroCalculatorInputs: null,
};

// Helper to get user-specific storage key
const getUserStorageKey = (userId: string | null) => 
  userId ? `meal-plan-storage-${userId}` : 'meal-plan-storage-anonymous';

type PersistEnvelope<TState> = {
  state?: Partial<TState>;
  version?: number;
};

const safeParsePersist = <TState,>(raw: string | null): PersistEnvelope<TState> | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PersistEnvelope<TState>;
  } catch {
    return null;
  }
};

const hasMeaningfulMealPlanData = (state?: Partial<MealPlanState> | null) => {
  if (!state) return false;
  const hasPools = !!state.recipePoolsBySlot && Object.values(state.recipePoolsBySlot).some((p) => (p ?? []).length > 0);
  const hasExact = !!state.exactAssignments && Object.keys(state.exactAssignments).length > 0;
  const hasGenerated = !!state.generatedPlan;
  const hasSlots = !!state.selectedMealSlots && state.selectedMealSlots.length > 0;
  const hasTargets = !!state.dailyTargets && (state.dailyTargets.calories ?? 0) > 0;
  return hasPools || hasExact || hasGenerated || hasSlots || hasTargets;
};

const hasAnyPoolRecipes = (state?: Partial<MealPlanState> | null) => {
  if (!state?.recipePoolsBySlot) return false;
  return Object.values(state.recipePoolsBySlot).some((p) => (p ?? []).length > 0);
};

const hasAnyExactAssignments = (state?: Partial<MealPlanState> | null) => {
  if (!state?.exactAssignments) return false;
  return Object.keys(state.exactAssignments).length > 0;
};

export const useMealPlanStore = create<MealPlanState>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      setCurrentUserId: (userId) => {
        const currentUserId = get().currentUserId;
        
        // If user changed, clear old data and load new user's data
        if (currentUserId !== userId) {
          // If the user is transitioning from anonymous -> signed-in, migrate any
          // saved meal plan state so it doesn't "disappear" after refresh.
          // This commonly happens when a user applies calculator settings before
          // auth finished initializing.
          if (!currentUserId && userId) {
            const anonKey = getUserStorageKey(null);
            const userKey = getUserStorageKey(userId);

            const anonRaw = localStorage.getItem(anonKey);
            const userRaw = localStorage.getItem(userKey);

            const anonParsed = safeParsePersist<MealPlanState>(anonRaw);
            const userParsed = safeParsePersist<MealPlanState>(userRaw);

            const anonState = anonParsed?.state ?? null;
            const userState = userParsed?.state ?? null;

            if (!anonState || !hasMeaningfulMealPlanData(anonState)) {
              // Nothing useful to migrate.
              return;
            }

            // IMPORTANT: userState might already contain slot defaults (from previous sessions)
            // while pools were added before auth finished initializing. In that case, we still
            // want to migrate pools/exact assignments WITHOUT overwriting the user's existing data.
            const anonHasPools = hasAnyPoolRecipes(anonState);
            const anonHasExact = hasAnyExactAssignments(anonState);
            const userHasPools = hasAnyPoolRecipes(userState);
            const userHasExact = hasAnyExactAssignments(userState);

            const shouldMigratePools = anonHasPools && !userHasPools;
            const shouldMigrateExact = anonHasExact && !userHasExact;

            // If user has no meaningful data at all, migrate everything.
            const migrateAll = !hasMeaningfulMealPlanData(userState);

            if (migrateAll || shouldMigratePools || shouldMigrateExact) {
              const base = (userParsed ?? anonParsed ?? {}) as PersistEnvelope<MealPlanState>;
              const baseState = (userState ?? {}) as Partial<MealPlanState>;

              const mergedState: Partial<MealPlanState> = {
                ...baseState,
                ...(migrateAll ? (anonState as Partial<MealPlanState>) : {}),
                // Selective merges
                ...(shouldMigratePools ? { recipePoolsBySlot: anonState.recipePoolsBySlot } : {}),
                ...(shouldMigrateExact ? { exactAssignments: anonState.exactAssignments } : {}),
                // If the user has no slots yet, carry them over so pools render correctly.
                ...(baseState.selectedMealSlots?.length ? {} : { selectedMealSlots: anonState.selectedMealSlots ?? [] }),
                ...(baseState.numberOfDays ? {} : { numberOfDays: anonState.numberOfDays ?? 7 }),
                // Ensure the next storage reads/writes use the user-scoped key.
                currentUserId: userId,
              };

              const merged: PersistEnvelope<MealPlanState> = {
                ...base,
                state: mergedState,
              };

              try {
                if (import.meta.env.DEV) {
                  console.log('[MealPlanStore] Migrating anonymous plan state to user', {
                    migrateAll,
                    shouldMigratePools,
                    shouldMigrateExact,
                  });
                }
                localStorage.setItem(userKey, JSON.stringify(merged));
                localStorage.removeItem(anonKey);
              } catch (e) {
                if (import.meta.env.DEV) console.warn('Failed to migrate anonymous meal plan state:', e);
              }
            }
          }

          // Clear current state first
          set({ ...initialState, currentUserId: userId });
          
          // Try to load the new user's data from their storage
          if (userId) {
            const storageKey = getUserStorageKey(userId);
            try {
              const stored = localStorage.getItem(storageKey);
              if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed.state) {
                  set({
                    ...parsed.state,
                    currentUserId: userId,
                  });
                }
              }
            } catch (e) {
              if (import.meta.env.DEV) console.warn('Failed to load user meal plan data:', e);
            }
          }
        }
      },
      
      setDailyTargets: (targets) => set({ dailyTargets: targets }),
      
      setSelectedMealSlots: (slots) => set({ selectedMealSlots: slots }),
      
      setNumberOfDays: (days) => set({ numberOfDays: Math.max(1, Math.min(7, days)) }),
      
      addToPool: (slotId, recipeId) => set((state) => {
        const currentPool = state.recipePoolsBySlot[slotId] || [];
        if (import.meta.env.DEV) console.log('[MealPlanStore] addToPool called:', { slotId, recipeId, currentPool });
        if (currentPool.includes(recipeId)) {
          if (import.meta.env.DEV) console.log('[MealPlanStore] Recipe already in pool, skipping:', recipeId);
          return state;
        }
        const newPool = [...currentPool, recipeId];
        if (import.meta.env.DEV) console.log('[MealPlanStore] New pool after add:', newPool);
        return {
          recipePoolsBySlot: {
            ...state.recipePoolsBySlot,
            [slotId]: newPool,
          },
        };
      }),
      
      removeFromPool: (slotId, recipeId) => set((state) => {
        const currentPool = state.recipePoolsBySlot[slotId] || [];
        return {
          recipePoolsBySlot: {
            ...state.recipePoolsBySlot,
            [slotId]: currentPool.filter(id => id !== recipeId),
          },
        };
      }),
      
      clearPool: (slotId) => set((state) => {
        const { [slotId]: _, ...rest } = state.recipePoolsBySlot;
        return { recipePoolsBySlot: rest };
      }),
      
      clearAllPools: () => set({ recipePoolsBySlot: {} }),
      
      setExactAssignment: (dayIndex, slotId, recipeId, servingMultiplier = 1.0) => set((state) => {
        const dayAssignments = state.exactAssignments[dayIndex] || {};
        return {
          exactAssignments: {
            ...state.exactAssignments,
            [dayIndex]: {
              ...dayAssignments,
              [slotId]: { recipeId, servingMultiplier },
            },
          },
        };
      }),
      
      removeExactAssignment: (dayIndex, slotId) => set((state) => {
        const dayAssignments = state.exactAssignments[dayIndex];
        if (!dayAssignments) return state;
        const { [slotId]: _, ...rest } = dayAssignments;
        return {
          exactAssignments: {
            ...state.exactAssignments,
            [dayIndex]: rest,
          },
        };
      }),
      
      clearExactAssignments: () => set({ exactAssignments: {} }),
      
      setGeneratedPlan: (plan) => set({ generatedPlan: plan }),
      
      clearGeneratedPlan: () => set({ generatedPlan: null, lockedSlots: {} }),
      
      updateSlotMultiplier: (dayIndex, slotId, multiplier) => set((state) => {
        if (!state.generatedPlan) return state;
        
        // Note: slotTotals will be recalculated in Plan.tsx when recipes are available
        // Store only updates the multiplier - actual macro calculation happens in the component
        const newDays = state.generatedPlan.days.map(day => {
          if (day.dayIndex !== dayIndex) return day;
          
          const newSlots = day.slots.map(slot => {
            if (slot.slotId !== slotId) return slot;
            return { ...slot, servingMultiplier: multiplier };
          });
          
          return { ...day, slots: newSlots };
        });
        
        return {
          generatedPlan: { ...state.generatedPlan, days: newDays },
        };
      }),
      
      toggleSlotLock: (dayIndex, slotId) => set((state) => {
        const dayLocks = state.lockedSlots[dayIndex] || [];
        const isLocked = dayLocks.includes(slotId);
        
        return {
          lockedSlots: {
            ...state.lockedSlots,
            [dayIndex]: isLocked
              ? dayLocks.filter(id => id !== slotId)
              : [...dayLocks, slotId],
          },
        };
      }),
      
      swapRecipe: (dayIndex, slotId, newRecipeId) => set((state) => {
        if (!state.generatedPlan) return state;
        
        const newDays = state.generatedPlan.days.map(day => {
          if (day.dayIndex !== dayIndex) return day;
          
          const newSlots = day.slots.map(slot => {
            if (slot.slotId !== slotId) return slot;
            return { ...slot, recipeId: newRecipeId, servingMultiplier: 1.0 };
          });
          
          return { ...day, slots: newSlots };
        });
        
        return {
          generatedPlan: { ...state.generatedPlan, days: newDays },
        };
      }),
      
      addDayExtra: (dayIndex, extra) => set((state) => {
        if (!state.generatedPlan) return state;
        
        const newDays = state.generatedPlan.days.map(day => {
          if (day.dayIndex !== dayIndex) return day;
          const currentExtras = day.extras || [];
          // Prevent duplicates
          if (currentExtras.some(e => e.id === extra.id)) return day;
          return { ...day, extras: [...currentExtras, extra] };
        });
        
        return {
          generatedPlan: { ...state.generatedPlan, days: newDays },
        };
      }),
      
      removeDayExtra: (dayIndex, extraId) => set((state) => {
        if (!state.generatedPlan) return state;
        
        const newDays = state.generatedPlan.days.map(day => {
          if (day.dayIndex !== dayIndex) return day;
          return { ...day, extras: (day.extras || []).filter(e => e.id !== extraId) };
        });
        
        return {
          generatedPlan: { ...state.generatedPlan, days: newDays },
        };
      }),
      
      setIsPlanMode: (isPlanMode) => set({ isPlanMode }),
      
      setCurrentSlotFilter: (slotId) => set({ currentSlotFilter: slotId }),
      
      setLastSelectedSlot: (slotId) => set({ lastSelectedSlot: slotId }),
      
      setSwapContext: (context) => set({ swapContext: context }),
      
      setMacroGapContext: (context) => set({ macroGapContext: context }),
      
      setMacroCalculatorInputs: (inputs) => set({ macroCalculatorInputs: inputs }),
      
      resetPlanState: () => set({ ...initialState, currentUserId: get().currentUserId }),
    }),
    {
      name: 'meal-plan-storage',
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          // Get current user from the store state
          const state = useMealPlanStore.getState?.();
          const userId = state?.currentUserId;
          const key = getUserStorageKey(userId);
          return localStorage.getItem(key);
        },
        setItem: (name, value) => {
          const state = useMealPlanStore.getState?.();
          const userId = state?.currentUserId;
          const key = getUserStorageKey(userId);
          localStorage.setItem(key, value);
        },
        removeItem: (name) => {
          const state = useMealPlanStore.getState?.();
          const userId = state?.currentUserId;
          const key = getUserStorageKey(userId);
          localStorage.removeItem(key);
        },
      })),
      partialize: (state) => ({
        currentUserId: state.currentUserId,
        dailyTargets: state.dailyTargets,
        selectedMealSlots: state.selectedMealSlots,
        numberOfDays: state.numberOfDays,
        recipePoolsBySlot: state.recipePoolsBySlot,
        exactAssignments: state.exactAssignments,
        generatedPlan: state.generatedPlan,
        lockedSlots: state.lockedSlots,
        macroCalculatorInputs: state.macroCalculatorInputs,
        // Persist plan mode state so it survives navigation between pages
        isPlanMode: state.isPlanMode,
        currentSlotFilter: state.currentSlotFilter,
        lastSelectedSlot: state.lastSelectedSlot,
      }),
    }
  )
);
