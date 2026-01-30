/**
 * Neutron Engine - Types for dual-mode nutrition calculation system
 */

export type NeutronMode = 'standard' | 'keto';

export interface RawNutritionData {
  calories?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  fiber_g?: number | null;
  sugar_g?: number | null;
  sodium_mg?: number | null;
  saturated_fat_g?: number | null;
  cholesterol_mg?: number | null;
  sugar_alcohols_g?: number | null; // For future use
}

export interface NeutronNutrition {
  // Core values (always present)
  calories: number;
  protein: number;
  fat: number;
  totalCarbs: number;
  fiber: number;
  
  // Computed values
  netCarbs: number;          // totalCarbs - fiber - sugarAlcohols
  sugarAlcohols: number;
  
  // Extended values
  sugar: number;
  sodium: number;
  saturatedFat: number;
  cholesterol: number;
  
  // Mode-specific display values
  displayCarbs: number;      // totalCarbs in standard mode, netCarbs in keto mode
  carbLabel: string;         // "Carbs" or "Net Carbs"
  
  // Energy calculations
  standardEnergy: number;    // (fat*9) + (protein*4) + (totalCarbs*4)
  netEnergy: number;         // (fat*9) + (protein*4) + (netCarbs*4)
  
  // Macro percentages based on current mode's energy base
  fatPercent: number;
  proteinPercent: number;
  carbPercent: number;
}

export interface KetoScore {
  score: number;             // 0-100
  isKeto: boolean;           // Passes badge threshold
  penalties: {
    carbPenalty: number;     // -10 per gram over 5g net carbs
    proteinPenalty: number;  // -5 if protein > 35% of net energy
  };
}

export interface NeutronBadges {
  isKeto: boolean;
  ketoScore: KetoScore;
  dietBadges: string[];
  healthBadges: string[];
}

export interface NeutronResult {
  mode: NeutronMode;
  nutrition: NeutronNutrition;
  badges: NeutronBadges;
}
