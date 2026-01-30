/**
 * Neutron Mode Store - Global state for keto mode toggle
 * 
 * The mode is determined by:
 * 1. Explicit user action (Enable Keto Mode button)
 * 2. URL parameter (keto filter in Discover/MyRecipes)
 * 3. User's diet preference (from profile/calculator)
 * 4. Default to 'standard'
 */

import { create } from 'zustand';
import type { NeutronMode } from '@/lib/neutron';

const KETO_MODE_KEY = 'neutron_keto_mode_enabled';

interface NeutronState {
  // Current calculation mode
  mode: NeutronMode;
  
  // Source of the mode (for debugging/display)
  modeSource: 'user' | 'filter' | 'preference' | 'default';
  
  // Actions
  setMode: (mode: NeutronMode, source?: 'user' | 'filter' | 'preference' | 'default') => void;
  
  // Enable Keto Mode globally (persisted)
  enableKetoMode: () => void;
  
  // Disable Keto Mode globally
  disableKetoMode: () => void;
  
  // Check if Keto Mode was explicitly enabled by user
  isUserEnabledKetoMode: () => boolean;
  
  // Derived helper
  isKetoMode: () => boolean;
}

export const useNeutronStore = create<NeutronState>((set, get) => ({
  mode: 'standard',
  modeSource: 'default',
  
  setMode: (mode, source = 'default') => {
    set({ mode, modeSource: source });
  },
  
  enableKetoMode: () => {
    // Persist the user's choice
    try {
      localStorage.setItem(KETO_MODE_KEY, 'true');
    } catch (e) {
      console.warn('Failed to persist keto mode:', e);
    }
    set({ mode: 'keto', modeSource: 'user' });
  },
  
  disableKetoMode: () => {
    try {
      localStorage.removeItem(KETO_MODE_KEY);
    } catch (e) {
      console.warn('Failed to clear keto mode:', e);
    }
    set({ mode: 'standard', modeSource: 'default' });
  },
  
  isUserEnabledKetoMode: () => {
    try {
      return localStorage.getItem(KETO_MODE_KEY) === 'true';
    } catch {
      return false;
    }
  },
  
  isKetoMode: () => get().mode === 'keto',
}));

/**
 * Initialize keto mode from persisted storage on app load
 */
export function initializeNeutronMode(): void {
  const { setMode, isUserEnabledKetoMode } = useNeutronStore.getState();
  
  if (isUserEnabledKetoMode()) {
    setMode('keto', 'user');
  }
}

/**
 * Hook to sync neutron mode from diet filter/preference
 * User-enabled mode takes precedence
 */
export function syncNeutronMode(dietType: string | null | undefined): void {
  const { setMode, isUserEnabledKetoMode, modeSource } = useNeutronStore.getState();
  
  // If user explicitly enabled keto mode, don't override it with filter sync
  if (isUserEnabledKetoMode() && modeSource === 'user') {
    return;
  }
  
  if (dietType?.toLowerCase() === 'keto') {
    setMode('keto', 'filter');
  } else if (!isUserEnabledKetoMode()) {
    setMode('standard', 'default');
  }
}
