import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { 
  MealSlot, 
  MealSlotId, 
  DailyTargets, 
  GeneratedPlan,
  MEAL_SLOT_DEFINITIONS,
} from '@/types/mealPlan';
import { getDefaultPercentsForSlots } from '@/types/mealPlan';

interface MealPlanState {
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
  
  // Actions
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
  
  // Mode actions
  setIsPlanMode: (isPlanMode: boolean) => void;
  setCurrentSlotFilter: (slotId: MealSlotId | null) => void;
  setLastSelectedSlot: (slotId: MealSlotId | null) => void;
  
  // Reset
  resetPlanState: () => void;
}

const initialState = {
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
};

export const useMealPlanStore = create<MealPlanState>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      setDailyTargets: (targets) => set({ dailyTargets: targets }),
      
      setSelectedMealSlots: (slots) => set({ selectedMealSlots: slots }),
      
      setNumberOfDays: (days) => set({ numberOfDays: Math.max(1, Math.min(7, days)) }),
      
      addToPool: (slotId, recipeId) => set((state) => {
        const currentPool = state.recipePoolsBySlot[slotId] || [];
        console.log('[MealPlanStore] addToPool called:', { slotId, recipeId, currentPool });
        if (currentPool.includes(recipeId)) {
          console.log('[MealPlanStore] Recipe already in pool, skipping:', recipeId);
          return state;
        }
        const newPool = [...currentPool, recipeId];
        console.log('[MealPlanStore] New pool after add:', newPool);
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
      
      setIsPlanMode: (isPlanMode) => set({ isPlanMode }),
      
      setCurrentSlotFilter: (slotId) => set({ currentSlotFilter: slotId }),
      
      setLastSelectedSlot: (slotId) => set({ lastSelectedSlot: slotId }),
      
      resetPlanState: () => set(initialState),
    }),
    {
      name: 'meal-plan-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        dailyTargets: state.dailyTargets,
        selectedMealSlots: state.selectedMealSlots,
        numberOfDays: state.numberOfDays,
        recipePoolsBySlot: state.recipePoolsBySlot,
        exactAssignments: state.exactAssignments,
        generatedPlan: state.generatedPlan,
        lockedSlots: state.lockedSlots,
      }),
    }
  )
);
