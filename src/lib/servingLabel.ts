/**
 * Generates a dynamic serving label based on the recipe's hero ingredient.
 * 
 * Logic:
 * 1. Identify the "hero" ingredient (protein/main component with highest quantity)
 * 2. Calculate portion per serving
 * 3. Format as "1 serving = [portion] [unit] [name]"
 */

interface Ingredient {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  normalized_name?: string | null;
}

interface RecipeForServing {
  servings?: number | null;
  ingredients?: Ingredient[] | null;
}

// Keywords that indicate a "hero" ingredient (proteins, main components)
const HERO_KEYWORDS = [
  // Proteins
  'salmon', 'chicken', 'beef', 'pork', 'fish', 'shrimp', 'steak', 'lamb',
  'turkey', 'duck', 'cod', 'tilapia', 'tuna', 'tofu', 'tempeh', 'seitan',
  'sausage', 'bacon', 'ham', 'meatball', 'patty', 'fillet', 'filet',
  'breast', 'thigh', 'wing', 'drumstick', 'chop', 'rib', 'tenderloin',
  'scallop', 'lobster', 'crab', 'mussel', 'clam', 'oyster', 'octopus',
  'egg', 'eggs',
  // Main carbs/starches
  'pasta', 'rice', 'noodle', 'bread', 'tortilla', 'wrap', 'pita',
  'potato', 'sweet potato', 'quinoa', 'couscous',
  // Countable items
  'burger', 'taco', 'enchilada', 'quesadilla', 'sandwich', 'pizza',
  'pancake', 'waffle', 'crepe', 'muffin', 'cookie', 'brownie',
  'dumpling', 'gyoza', 'spring roll', 'samosa', 'empanada',
];

// Units that indicate countable portions
const COUNTABLE_UNITS = [
  'piece', 'pieces', 'slice', 'slices', 'fillet', 'fillets', 'filet', 'filets',
  'breast', 'breasts', 'thigh', 'thighs', 'drumstick', 'drumsticks',
  'chop', 'chops', 'steak', 'steaks', 'patty', 'patties',
  'ball', 'balls', 'meatball', 'meatballs',
  'egg', 'eggs', 'tortilla', 'tortillas', 'wrap', 'wraps',
  'taco', 'tacos', 'burger', 'burgers', 'sandwich', 'sandwiches',
  'serving', 'servings', 'portion', 'portions',
  'cup', 'cups', 'bowl', 'bowls',
  'scallop', 'scallops', 'shrimp', 'prawns',
];

/**
 * Smart rounding for portion values:
 * - If close to integer (within 0.05), round to whole number
 * - Otherwise, keep 1 decimal place
 */
function smartRound(value: number): string {
  const rounded = Math.round(value);
  if (Math.abs(value - rounded) < 0.05) {
    return rounded.toString();
  }
  // Keep 1 decimal place
  const oneDecimal = Math.round(value * 10) / 10;
  return oneDecimal % 1 === 0 ? oneDecimal.toString() : oneDecimal.toFixed(1);
}

/**
 * Determines the priority score for an ingredient to be the "hero"
 */
function getHeroScore(ingredient: Ingredient): number {
  const name = (ingredient.name || '').toLowerCase();
  const normalizedName = (ingredient.normalized_name || '').toLowerCase();
  const unit = (ingredient.unit || '').toLowerCase();
  const quantity = ingredient.quantity || 0;
  
  let score = 0;
  
  // Check if ingredient name contains hero keywords
  for (const keyword of HERO_KEYWORDS) {
    if (name.includes(keyword) || normalizedName.includes(keyword)) {
      score += 100;
      break;
    }
  }
  
  // Boost score if unit is countable (indicates a main component)
  for (const countableUnit of COUNTABLE_UNITS) {
    if (unit.includes(countableUnit)) {
      score += 50;
      break;
    }
  }
  
  // Add quantity as a tiebreaker (higher quantity = more likely to be main)
  score += Math.min(quantity, 20);
  
  // Penalize very common ingredients that are rarely the "hero"
  const commonIngredients = ['oil', 'salt', 'pepper', 'garlic', 'onion', 'butter', 'water', 'broth', 'stock'];
  for (const common of commonIngredients) {
    if (name.includes(common)) {
      score -= 50;
      break;
    }
  }
  
  return score;
}

/**
 * Extracts the core ingredient name (removes quantities/descriptors)
 */
function getCleanIngredientName(name: string): string {
  // Remove common descriptors and keep the core name
  return name
    .replace(/\b(fresh|dried|chopped|diced|minced|sliced|cubed|boneless|skinless|organic|large|medium|small|raw|cooked)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Formats the unit for singular/plural based on portion
 */
function formatUnit(unit: string, portion: number): string {
  const singular = unit.replace(/s$/i, '');
  const isPlural = portion !== 1;
  
  // Handle special cases
  if (singular.toLowerCase() === 'piece') return isPlural ? 'pieces' : 'piece';
  if (singular.toLowerCase() === 'slice') return isPlural ? 'slices' : 'slice';
  if (singular.toLowerCase() === 'fillet' || singular.toLowerCase() === 'filet') return isPlural ? 'fillets' : 'fillet';
  if (singular.toLowerCase() === 'breast') return isPlural ? 'breasts' : 'breast';
  if (singular.toLowerCase() === 'egg') return isPlural ? 'eggs' : 'egg';
  
  return isPlural ? (unit.endsWith('s') ? unit : unit + 's') : singular;
}

/**
 * Generates a dynamic serving label based on the recipe's hero ingredient.
 */
export function generateServingLabel(recipe: RecipeForServing): string {
  const servings = recipe.servings || 1;
  const ingredients = recipe.ingredients || [];
  
  if (ingredients.length === 0) {
    return `1 serving = 1/${servings} of recipe`;
  }
  
  // Score all ingredients and find the hero
  const scoredIngredients = ingredients
    .filter(ing => ing.quantity && ing.quantity > 0)
    .map(ing => ({
      ingredient: ing,
      score: getHeroScore(ing),
    }))
    .sort((a, b) => b.score - a.score);
  
  // If no ingredient has a positive score, use fallback
  if (scoredIngredients.length === 0 || scoredIngredients[0].score <= 0) {
    return `1 serving = 1/${servings} of recipe`;
  }
  
  const hero = scoredIngredients[0].ingredient;
  const heroQuantity = hero.quantity || 0;
  const portion = heroQuantity / servings;
  
  // If portion is too small or zero, use fallback
  if (portion < 0.1) {
    return `1 serving = 1/${servings} of recipe`;
  }
  
  const portionStr = smartRound(portion);
  const cleanName = getCleanIngredientName(hero.name);
  
  // If we have a countable unit, format nicely
  if (hero.unit) {
    const unit = hero.unit.toLowerCase();
    const isCountableUnit = COUNTABLE_UNITS.some(cu => unit.includes(cu));
    
    if (isCountableUnit) {
      // Format: "1 fillet salmon" or "2 eggs"
      const formattedUnit = formatUnit(hero.unit, parseFloat(portionStr));
      
      // Check if unit is already part of the name (avoid "1 fillet salmon fillets")
      const nameWithoutUnit = cleanName.replace(new RegExp(hero.unit, 'gi'), '').trim();
      
      return `1 serving = ${portionStr} ${formattedUnit} ${nameWithoutUnit}`.replace(/\s+/g, ' ').trim();
    } else {
      // For weight-based units, show the amount
      // E.g., "1 serving = 150g chicken breast"
      const portionAmount = Math.round(heroQuantity / servings);
      return `1 serving = ${portionAmount}${hero.unit} ${cleanName}`;
    }
  }
  
  // No unit - just show portion of the item
  return `1 serving = ${portionStr} ${cleanName}`;
}

/**
 * Checks if a serving_size is a generic placeholder that should be regenerated
 */
export function isGenericServingSize(servingSize: string | null | undefined): boolean {
  if (!servingSize) return true;
  
  const generic = [
    '1 serving',
    '1 serving = 1 serving',
    'one serving',
    'per serving',
  ];
  
  const normalized = servingSize.toLowerCase().trim();
  return generic.some(g => normalized === g || normalized.includes('= 1 serving'));
}
