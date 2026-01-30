/**
 * Neutron Mode Store - Global state for keto mode toggle
 * 
 * The mode is determined by:
 * 1. URL parameter (keto filter in Discover/MyRecipes)
 * 2. User's diet preference (from profile/calculator)
 * 3. Default to 'standard'
 */

import { create } from 'zustand';
import type { NeutronMode } from '@/lib/neutron';

interface NeutronState {
  // Current calculation mode
  mode: NeutronMode;
  
  // Source of the mode (for debugging/display)
  modeSource: 'filter' | 'preference' | 'default';
  
  // Actions
  setMode: (mode: NeutronMode, source?: 'filter' | 'preference' | 'default') => void;
  
  // Derived helper
  isKetoMode: () => boolean;
}

export const useNeutronStore = create<NeutronState>((set, get) => ({
  mode: 'standard',
  modeSource: 'default',
  
  setMode: (mode, source = 'default') => {
    set({ mode, modeSource: source });
  },
  
  isKetoMode: () => get().mode === 'keto',
}));

/**
 * Hook to sync neutron mode from diet filter/preference
 */
export function syncNeutronMode(dietType: string | null | undefined): void {
  const { setMode } = useNeutronStore.getState();
  
  if (dietType?.toLowerCase() === 'keto') {
    setMode('keto', 'filter');
  } else {
    setMode('standard', 'default');
  }
}
