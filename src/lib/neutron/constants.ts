/**
 * Neutron Engine - Constants for nutrition calculations and badge thresholds
 */

// Keto badge thresholds
export const KETO_BADGE_MAX_NET_CARBS = 10;       // ≤10g net carbs per serving
export const KETO_BADGE_MIN_FAT_PERCENT = 60;     // ≥60% of net energy from fat

// Keto score thresholds
export const KETO_SCORE_CARB_THRESHOLD = 5;      // Penalty starts after 5g net carbs
export const KETO_SCORE_CARB_PENALTY = 10;       // -10 points per gram over threshold
export const KETO_SCORE_PROTEIN_THRESHOLD = 35;  // % of net energy
export const KETO_SCORE_PROTEIN_PENALTY = 5;     // -5 if protein > threshold

// Macro calorie multipliers
export const CALORIES_PER_GRAM = {
  fat: 9,
  protein: 4,
  carbs: 4,
} as const;

// Health badge thresholds
export const HEALTH_THRESHOLDS = {
  // Low Sodium: sodium <300mg per serving
  LOW_SODIUM_MAX: 300,
  
  // Kidney Friendly: low sodium (<400mg), moderate protein (<30g)
  KIDNEY_SODIUM_MAX: 400,
  KIDNEY_PROTEIN_MAX: 30,
  
  // Diabetes Friendly: high fiber (>5g), moderate carbs (<40g)
  DIABETES_FIBER_MIN: 5,
  DIABETES_CARBS_MAX: 40,
  
  // Heart Healthy: high fiber (>5g), low sodium (<300mg)
  HEART_FIBER_MIN: 5,
  HEART_SODIUM_MAX: 300,
} as const;

// Diet exclusions for auto-detection (ingredients that disqualify recipes)
export const DIET_EXCLUSIONS: Record<string, string[]> = {
  paleo: [
    'bread', 'pasta', 'rice', 'noodle', 'grain', 'wheat', 'oat', 'corn', 'quinoa', 
    'barley', 'cereal', 'granola', 'tortilla', 'bean', 'lentil', 'chickpea', 'hummus', 
    'peanut', 'soy', 'tofu', 'tempeh', 'edamame', 'dairy', 'milk', 'cheese', 'yogurt', 
    'butter', 'cream', 'sugar', 'candy', 'cake', 'cookie', 'donut', 'pastry'
  ],
  mediterranean: [
    'beef', 'steak', 'pork', 'bacon', 'ham', 'sausage', 'hot dog', 'salami', 
    'processed meat', 'butter', 'margarine', 'sugar', 'candy', 'cake', 'cookie', 
    'donut', 'soda', 'fried', 'deep fried'
  ],
} as const;
