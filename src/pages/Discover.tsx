import { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Search, Clock, Sparkles, BookOpen, ChefHat, Baby, Plus, Check, Target, UtensilsCrossed, AlertTriangle, HeartPulse, X, Flame, Wheat, Droplets, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/PageHeader';
import { BottomNav } from '@/components/layout/BottomNav';
import { RecipeCard } from '@/components/recipe/RecipeCard';
import { StickyActions } from '@/components/ui/StickyActions';
import { Chip } from '@/components/ui/Chip';
import { Skeleton } from '@/components/ui/skeleton';
import { PlanModeHeader } from '@/components/plan/PlanModeHeader';
import { AddToPlanModal } from '@/components/plan/AddToPlanModal';
import { FilterDropdown } from '@/components/discover/FilterDropdown';
import { MultiSelectDropdown } from '@/components/discover/MultiSelectDropdown';
import { useGlobalRecipes } from '@/hooks/useGlobalRecipes';
import { useAppStore } from '@/stores/appStore';
import { useMealPlanStore } from '@/stores/mealPlanStore';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserData } from '@/hooks/useUserData';
import { supabase } from '@/integrations/supabase/client';
import type { MealSlotId } from '@/types/mealPlan';

// Age-based meal suitability
type AgeGroup = 'toddler' | 'child' | 'teen' | 'adult';

const getAgeGroup = (age: number | null | undefined): AgeGroup => {
  if (!age || age >= 16) return 'adult';
  if (age >= 10) return 'teen';
  if (age >= 4) return 'child';
  return 'toddler';
};

// Ingredients/terms not suitable for young children (safety, texture, spice)
const ageRestrictedTerms: Record<AgeGroup, string[]> = {
  toddler: [
    'whole nut', 'peanut', 'almond', 'walnut', 'cashew', 'pistachio', 'macadamia',
    'popcorn', 'hard candy', 'gum', 'marshmallow',
    'jalapeño', 'jalapeno', 'habanero', 'ghost pepper', 'cayenne', 'hot sauce', 'sriracha', 'wasabi', 'horseradish',
    'extra spicy', 'very spicy', 'fiery', 'blazing',
    'raw fish', 'sashimi', 'tartare', 'rare steak', 'runny egg', 'soft boiled',
    'cured meat', 'prosciutto', 'salami', 'pepperoni',
    'wine sauce', 'beer batter', 'bourbon', 'rum', 'whiskey', 'brandy',
    'jerky', 'beef jerky', 'dried meat',
  ],
  child: [
    'jalapeño', 'jalapeno', 'habanero', 'ghost pepper', 'cayenne',
    'extra spicy', 'very spicy', 'fiery', 'blazing',
    'raw fish', 'sashimi', 'tartare',
    'wine sauce', 'beer batter', 'bourbon', 'rum', 'whiskey', 'brandy',
  ],
  teen: [
    'wine sauce', 'beer batter', 'bourbon', 'rum sauce', 'whiskey glaze', 'brandy',
  ],
  adult: [],
};

const timeFilterOptions = [
  { value: '15', label: '< 15 min' },
  { value: '30', label: '< 30 min' },
  { value: '45', label: '< 45 min' },
  { value: '60', label: '< 60 min' },
];

const mealFilterOptions = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
];

const cuisineFilterOptions = [
  { value: 'American', label: 'American' },
  { value: 'Italian', label: 'Italian' },
  { value: 'Mexican', label: 'Mexican' },
  { value: 'Asian', label: 'Asian' },
  { value: 'Mediterranean', label: 'Mediterranean' },
  { value: 'Indian', label: 'Indian' },
  { value: 'Japanese', label: 'Japanese' },
  { value: 'Thai', label: 'Thai' },
  { value: 'French', label: 'French' },
  { value: 'Greek', label: 'Greek' },
  { value: 'Brazilian', label: 'Brazilian' },
];

const dietTypeOptions = [
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'pescatarian', label: 'Pescatarian' },
  { value: 'keto', label: 'Keto' },
  { value: 'paleo', label: 'Paleo' },
  { value: 'mediterranean', label: 'Mediterranean' },
];

const allergyOptions = [
  { value: 'dairy', label: 'Dairy' },
  { value: 'gluten', label: 'Gluten' },
  { value: 'nuts', label: 'Nuts' },
  { value: 'peanuts', label: 'Peanuts' },
  { value: 'shellfish', label: 'Shellfish' },
  { value: 'soy', label: 'Soy' },
  { value: 'eggs', label: 'Eggs' },
  { value: 'fish', label: 'Fish' },
];

const commonDislikes = [
  { value: 'mushrooms', label: 'Mushrooms' },
  { value: 'onions', label: 'Onions' },
  { value: 'peppers', label: 'Peppers' },
  { value: 'tomatoes', label: 'Tomatoes' },
  { value: 'cilantro', label: 'Cilantro' },
  { value: 'olives', label: 'Olives' },
  { value: 'spicy', label: 'Spicy' },
];

const healthConsiderationOptions = [
  { value: 'diabetes-friendly', label: 'Diabetes Friendly' },
  { value: 'heart-healthy', label: 'Heart Healthy' },
  { value: 'low-sodium', label: 'Low Sodium' },
  { value: 'kidney-friendly', label: 'Kidney Friendly' },
];

interface UserRecipe {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  prep_time: number | null;
  cook_time: number | null;
  total_time: number | null;
  servings: number | null;
  difficulty: string | null;
  cuisine: string | null;
  nutrition?: {
    calories: number | null;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
  };
  ingredients: Array<{
    name: string;
    normalized_name: string | null;
  }>;
  tags: { tag_type: string; tag_value: string }[];
  isUserRecipe: boolean;
}

export default function Discover() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { profile, preferences } = useUserData();
  const { selectedMeals, addSelectedMeal, removeSelectedMeal } = useAppStore();
  const { 
    isPlanMode, 
    setIsPlanMode, 
    currentSlotFilter,
    selectedMealSlots,
    recipePoolsBySlot,
    numberOfDays,
    dailyTargets,
    macroGapContext,
    macroCalculatorInputs,
    swapContext,
    setSwapContext,
    swapRecipe,
  } = useMealPlanStore();

  // Modal state for adding to plan
  const [addToPlanModal, setAddToPlanModal] = useState<{ open: boolean; recipeId: string; recipeName: string } | null>(null);

  // Pending onboarding data
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

  // Get diet type from macro calculator if set (highest priority for calculated macros)
  const calculatorDietType =
    macroCalculatorInputs?.dietType && macroCalculatorInputs.dietType !== 'none'
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

  // Use URL search params for persistent filter state
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Read filter values directly from URL params
  const searchQuery = searchParams.get('q') || '';
  const selectedTime = searchParams.get('time');
  const selectedMealType = searchParams.get('meal');
  const selectedCuisine = searchParams.get('cuisine');
  const selectedDietType = searchParams.get('diet');
  const selectedAllergies = useMemo(() => {
    const allergies = searchParams.get('allergies');
    return allergies ? allergies.split(',').filter(Boolean) : [];
  }, [searchParams]);
  const selectedDislikes = useMemo(() => {
    const dislikes = searchParams.get('dislikes');
    return dislikes ? dislikes.split(',').filter(Boolean) : [];
  }, [searchParams]);
  const selectedHealthConsiderations = useMemo(() => {
    const health = searchParams.get('health');
    return health ? health.split(',').filter(Boolean) : [];
  }, [searchParams]);
  const recipeSource = useMemo(() => {
    const source = searchParams.get('source');
    return (source === 'my' || source === 'app') ? source : 'all';
  }, [searchParams]);
  
  const [userRecipes, setUserRecipes] = useState<UserRecipe[]>([]);

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

  // Setters that update URL params
  const setSearchQuery = useCallback((value: string) => updateSearchParams('q', value || null), [updateSearchParams]);
  const setSelectedTime = useCallback((value: string | null) => updateSearchParams('time', value), [updateSearchParams]);
  const setSelectedMealType = useCallback((value: string | null) => updateSearchParams('meal', value), [updateSearchParams]);
  const setSelectedCuisine = useCallback((value: string | null) => updateSearchParams('cuisine', value), [updateSearchParams]);
  const setSelectedDietType = useCallback((value: string | null) => updateSearchParams('diet', value), [updateSearchParams]);
  const setSelectedAllergies = useCallback((value: string[]) => updateSearchParams('allergies', value), [updateSearchParams]);
  const setSelectedDislikes = useCallback((value: string[]) => updateSearchParams('dislikes', value), [updateSearchParams]);
  const setSelectedHealthConsiderations = useCallback((value: string[]) => updateSearchParams('health', value), [updateSearchParams]);
  const setRecipeSource = useCallback((value: 'all' | 'my' | 'app') => updateSearchParams('source', value === 'all' ? null : value), [updateSearchParams]);

  // Combine profile diet type with dropdown selection (dropdown takes priority)
  const activeDietType = selectedDietType || (effectiveDietType === 'none' ? null : effectiveDietType);
  const userDietType = (activeDietType || 'none').toLowerCase();

  // If the macro calculator selected a diet, sync it into the URL so the dropdown
  // is selected and the filter persists across refresh/share.
  useEffect(() => {
    if (!selectedDietType && calculatorDietType) {
      updateSearchParams('diet', calculatorDietType);
    }
  }, [selectedDietType, calculatorDietType, updateSearchParams]);

  const dietExclusions: Record<string, string[]> = {
    vegan: ['chicken', 'beef', 'pork', 'lamb', 'fish', 'salmon', 'tuna', 'shrimp', 'prawn', 'lobster', 'crab', 'shellfish', 'seafood', 'meat', 'bacon', 'ham', 'sausage', 'turkey', 'duck', 'veal', 'steak', 'egg', 'eggs', 'dairy', 'milk', 'cheese', 'butter', 'cream', 'yogurt', 'honey', 'cod', 'tilapia', 'halibut', 'mackerel', 'sardine', 'anchovy', 'trout', 'bass', 'snapper', 'mahi', 'swordfish', 'catfish', 'flounder', 'sole', 'haddock', 'perch', 'pike', 'scallop', 'mussel', 'clam', 'oyster', 'calamari', 'squid', 'octopus', 'crawfish', 'crayfish'],
    vegetarian: ['chicken', 'beef', 'pork', 'lamb', 'fish', 'salmon', 'tuna', 'shrimp', 'prawn', 'lobster', 'crab', 'shellfish', 'seafood', 'meat', 'bacon', 'ham', 'sausage', 'turkey', 'duck', 'veal', 'steak', 'cod', 'tilapia', 'halibut', 'mackerel', 'sardine', 'anchovy', 'trout', 'bass', 'snapper', 'mahi', 'swordfish', 'catfish', 'flounder', 'sole', 'haddock', 'perch', 'pike', 'scallop', 'mussel', 'clam', 'oyster', 'calamari', 'squid', 'octopus', 'crawfish', 'crayfish', 'poke', 'sashimi', 'moqueca', 'cioppino'],
    pescatarian: ['chicken', 'beef', 'pork', 'lamb', 'meat', 'bacon', 'ham', 'sausage', 'turkey', 'duck', 'veal', 'steak'],
    keto: ['bread', 'pasta', 'white rice', 'brown rice', 'jasmine rice', 'basmati rice', 'sticky rice', 'fried rice', 'rice bowl', 'rice pilaf', 'noodle', 'oatmeal', 'oat', 'cereal', 'granola', 'pancake', 'waffle', 'muffin', 'bagel', 'croissant', 'toast', 'tortilla', 'wrap', 'pita', 'couscous', 'quinoa', 'barley', 'wheat', 'flour', 'corn', 'potato', 'sweet potato', 'yam', 'bean', 'lentil', 'chickpea', 'hummus', 'pea', 'sugar', 'honey', 'maple syrup', 'agave', 'candy', 'cake', 'cookie', 'donut', 'pastry', 'pie', 'ice cream', 'frozen yogurt', 'banana', 'apple', 'orange', 'grape', 'mango', 'pineapple', 'watermelon', 'fruit salad', 'smoothie', 'juice', 'soda', 'açaí', 'acai', 'acai bowl', 'açaí bowl', 'oatmeal', 'porridge', 'risotto', 'polenta', 'grits', 'cornbread', 'biscuit', 'cracker', 'pretzel', 'chip', 'fries', 'french fries', 'hash brown', 'tater tot', 'breaded', 'battered', 'tempura', 'teriyaki', 'sweet and sour', 'bbq sauce', 'ketchup', 'jam', 'jelly', 'marmalade', 'dried fruit', 'raisin', 'date', 'fig', 'prune', 'apricot'],
    paleo: ['bread', 'pasta', 'white rice', 'brown rice', 'jasmine rice', 'basmati rice', 'sticky rice', 'fried rice', 'rice bowl', 'rice pilaf', 'noodle', 'grain', 'wheat', 'oat', 'oatmeal', 'corn', 'cornbread', 'polenta', 'grits', 'quinoa', 'barley', 'bulgur', 'couscous', 'farro', 'millet', 'rye', 'spelt', 'buckwheat', 'cereal', 'granola', 'cracker', 'pretzel', 'chip', 'tortilla', 'wrap', 'pita', 'bagel', 'muffin', 'pancake', 'waffle', 'croissant', 'biscuit', 'bean', 'lentil', 'chickpea', 'hummus', 'peanut', 'peanut butter', 'soy', 'tofu', 'tempeh', 'edamame', 'soy sauce', 'miso', 'black bean', 'kidney bean', 'pinto bean', 'navy bean', 'cannellini', 'fava', 'split pea', 'dairy', 'milk', 'cheese', 'yogurt', 'butter', 'cream', 'ice cream', 'sour cream', 'cottage cheese', 'cream cheese', 'whey', 'casein', 'sugar', 'cane sugar', 'brown sugar', 'powdered sugar', 'corn syrup', 'high fructose', 'agave', 'maple syrup', 'molasses', 'candy', 'cake', 'cookie', 'donut', 'pastry', 'pie', 'brownie', 'frosting', 'artificial sweetener', 'aspartame', 'sucralose', 'saccharin', 'vegetable oil', 'canola oil', 'soybean oil', 'corn oil', 'cottonseed oil', 'sunflower oil', 'safflower oil', 'margarine', 'shortening', 'processed', 'hot dog', 'deli meat', 'spam', 'bologna', 'salami'],
    mediterranean: ['beef', 'steak', 'pork', 'bacon', 'ham', 'sausage', 'hot dog', 'salami', 'pepperoni', 'bologna', 'deli meat', 'processed meat', 'ribs', 'brisket', 'pulled pork', 'carnitas', 'chorizo', 'bratwurst', 'kielbasa', 'spam', 'butter', 'margarine', 'lard', 'shortening', 'cream cheese', 'heavy cream', 'whipped cream', 'sugar', 'candy', 'cake', 'cookie', 'brownie', 'donut', 'pastry', 'pie', 'frosting', 'ice cream', 'milkshake', 'soda', 'soft drink', 'energy drink', 'sweetened', 'syrup', 'corn syrup', 'white bread', 'white rice', 'white flour', 'refined', 'processed', 'fried chicken', 'chicken nugget', 'french fries', 'onion rings', 'mozzarella sticks', 'fried', 'deep fried', 'battered', 'breaded', 'fast food', 'chips', 'cheetos', 'doritos', 'crackers', 'onigiri'],
    none: [],
  };

  // Strict Keto meal criteria (carb-defined first, not fat-defined):
  // 1. Net carbs under 8g per serving (strict keto aims for ~20-30g/day total across 3 meals)
  // 2. Carbs must be under 10% of total calories (filters out carb-dense low-cal foods)
  // 3. Protein should not be excessive (avoid gluconeogenesis) - max 35% of calories from protein
  // 4. Fat must provide majority of energy - at least 60% of calories from fat
  const KETO_MAX_CARBS = 8; // Stricter: 8g instead of 10g
  const KETO_MAX_CARB_PERCENT = 10; // Max % of calories from carbs
  const KETO_MAX_PROTEIN_PERCENT = 35; // Max % of calories from protein
  const KETO_MIN_FAT_PERCENT = 60; // Min % of calories from fat (raised from 50%)
  
  // Helper to check if a recipe meets strict keto macro criteria
  const isKetoFriendly = (nutrition: { calories?: number | null; carbs_g?: number | null; protein_g?: number | null; fat_g?: number | null } | undefined): boolean => {
    if (!nutrition) return false; // Reject if no nutrition data (can't verify keto compliance)
    
    const carbs = nutrition.carbs_g ?? 0;
    const protein = nutrition.protein_g ?? 0;
    const fat = nutrition.fat_g ?? 0;
    
    // Rule 1: Absolute carbs must be under threshold (most important for keto)
    if (carbs > KETO_MAX_CARBS) {
      return false;
    }
    
    // Calculate calorie percentages (protein/carbs = 4 cal/g, fat = 9 cal/g)
    const proteinCals = protein * 4;
    const fatCals = fat * 9;
    const carbCals = carbs * 4;
    const totalMacroCals = proteinCals + fatCals + carbCals;
    
    // Need some calorie data to evaluate ratios
    if (totalMacroCals <= 0) {
      return false;
    }
    
    const carbPercent = (carbCals / totalMacroCals) * 100;
    const proteinPercent = (proteinCals / totalMacroCals) * 100;
    const fatPercent = (fatCals / totalMacroCals) * 100;
    
    // Rule 2: Carb percentage must be very low (catches carb-dense low-cal foods like Baba Ganoush, Cucumber Dill Salad)
    if (carbPercent > KETO_MAX_CARB_PERCENT) {
      return false;
    }
    
    // Rule 3: Protein shouldn't be too high (avoid gluconeogenesis)
    if (proteinPercent > KETO_MAX_PROTEIN_PERCENT) {
      return false;
    }
    
    // Rule 4: Fat must dominate energy (true ketogenic ratio)
    if (fatPercent < KETO_MIN_FAT_PERCENT) {
      return false;
    }
    
    return true;
  };

  // Combine profile allergies/dislikes with dropdown selections
  const allAllergies = useMemo(() => 
    [...new Set([...effectiveAllergies, ...selectedAllergies])],
    [effectiveAllergies, selectedAllergies]
  );
  const allDislikes = useMemo(() => 
    [...new Set([...effectiveDislikes, ...selectedDislikes])],
    [effectiveDislikes, selectedDislikes]
  );

  // Allergy term expansions - map category allergies to specific ingredients
  const allergyExpansions: Record<string, string[]> = {
    gluten: ['wheat', 'flour', 'bread', 'pasta', 'noodle', 'barley', 'rye', 'oat', 'oatmeal', 'couscous', 'bulgur', 'farro', 'spelt', 'semolina', 'seitan', 'breaded', 'battered', 'cracker', 'pretzel', 'bagel', 'croissant', 'muffin', 'cake', 'cookie', 'pastry', 'pie crust', 'pizza', 'tortilla', 'wrap', 'panko', 'breadcrumb', 'soy sauce', 'teriyaki'],
    dairy: ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'whey', 'casein', 'lactose', 'ghee', 'ice cream', 'sour cream', 'cottage cheese', 'cream cheese', 'ricotta', 'mozzarella', 'parmesan', 'cheddar', 'feta', 'brie', 'gouda', 'swiss', 'provolone', 'mascarpone', 'half and half', 'heavy cream', 'whipped cream', 'condensed milk', 'evaporated milk', 'buttermilk', 'kefir', 'paneer', 'queso'],
    nuts: ['almond', 'walnut', 'cashew', 'pistachio', 'pecan', 'hazelnut', 'macadamia', 'brazil nut', 'pine nut', 'chestnut', 'nut butter', 'almond butter', 'almond milk', 'almond flour', 'marzipan', 'praline', 'nougat', 'pesto'],
    peanuts: ['peanut', 'peanut butter', 'peanut oil', 'groundnut', 'goober'],
    shellfish: ['shrimp', 'prawn', 'lobster', 'crab', 'crayfish', 'crawfish', 'scallop', 'clam', 'mussel', 'oyster', 'squid', 'calamari', 'octopus', 'langoustine', 'cockle', 'abalone', 'whelk', 'periwinkle'],
    soy: ['soy', 'soya', 'tofu', 'tempeh', 'edamame', 'miso', 'soy sauce', 'soy milk', 'soybean', 'soy protein', 'tamari', 'teriyaki'],
    eggs: ['egg', 'eggs', 'mayonnaise', 'mayo', 'aioli', 'meringue', 'custard', 'quiche', 'frittata', 'omelet', 'omelette', 'hollandaise', 'bearnaise', 'egg wash', 'egg noodle'],
    fish: ['fish', 'salmon', 'tuna', 'cod', 'tilapia', 'halibut', 'mackerel', 'sardine', 'anchovy', 'trout', 'bass', 'snapper', 'mahi', 'swordfish', 'catfish', 'flounder', 'sole', 'haddock', 'perch', 'pike', 'herring', 'fish sauce', 'worcestershire'],
  };

  // Dislike term expansions - map category dislikes to specific ingredients
  const dislikeExpansions: Record<string, string[]> = {
    spicy: ['jalapeño', 'jalapeno', 'habanero', 'serrano', 'cayenne', 'chipotle', 'ghost pepper', 'scotch bonnet', 'thai chili', 'bird eye', 'hot sauce', 'sriracha', 'tabasco', 'gochujang', 'harissa', 'wasabi', 'horseradish', 'chili flake', 'red pepper flake', 'crushed red pepper', 'chili powder', 'hot pepper', 'buffalo', 'kung pao', 'szechuan', 'sichuan', 'vindaloo', 'arrabbiata', 'diablo', 'fra diavolo', 'peri peri', 'piri piri', 'jerk', 'cajun', 'blackened', 'fiery', 'extra hot', 'very hot'],
    mushrooms: ['mushroom', 'shiitake', 'portobello', 'cremini', 'oyster mushroom', 'chanterelle', 'porcini', 'enoki', 'maitake', 'morel', 'truffle', 'funghi', 'fungi'],
    onions: ['onion', 'shallot', 'scallion', 'green onion', 'spring onion', 'leek', 'chive', 'red onion', 'white onion', 'yellow onion', 'vidalia', 'pearl onion', 'cipollini'],
    peppers: ['pepper', 'bell pepper', 'capsicum', 'pimento', 'pimiento', 'roasted pepper', 'stuffed pepper'],
    tomatoes: ['tomato', 'tomatoes', 'marinara', 'pomodoro', 'sun-dried tomato', 'cherry tomato', 'grape tomato', 'roma tomato', 'tomato sauce', 'tomato paste', 'salsa', 'bruschetta', 'pico de gallo', 'gazpacho'],
    cilantro: ['cilantro', 'coriander', 'culantro', 'fresh coriander'],
    olives: ['olive', 'kalamata', 'black olive', 'green olive', 'tapenade', 'olivada'],
  };

  const blockedTerms = useMemo(() => {
    const normalize = (v: string) => v.trim().toLowerCase();
    // For keto, keyword-based diet exclusions (like "fried rice") are too aggressive and
    // hide legit keto recipes (e.g., cauliflower rice). Keto compliance is enforced by
    // strict macro validation (isKetoFriendly) later in filtering.
    const currentDietExclusions = userDietType === 'keto' ? [] : (dietExclusions[userDietType] || []);
    
    // Expand allergy terms to include specific ingredients
    const expandedAllergies = allAllergies.flatMap(allergy => {
      const allergyLower = allergy.toLowerCase();
      const expansions = allergyExpansions[allergyLower] || [];
      return [allergyLower, ...expansions];
    });
    
    // Expand dislike terms to include specific ingredients
    const expandedDislikes = allDislikes.flatMap(dislike => {
      const dislikeLower = dislike.toLowerCase();
      const expansions = dislikeExpansions[dislikeLower] || [];
      return [dislikeLower, ...expansions];
    });
    
    const base = [...currentDietExclusions, ...expandedAllergies, ...expandedDislikes].filter(Boolean).map(normalize).filter(Boolean);
    const expanded = base.flatMap((term) => {
      const variants = new Set<string>();
      variants.add(term);
      if (term.endsWith('s') && term.length > 1) variants.add(term.slice(0, -1));
      else variants.add(`${term}s`);
      return Array.from(variants);
    });
    return Array.from(new Set(expanded)).filter(Boolean);
  }, [allAllergies, allDislikes, userDietType]);

  // Combine profile health preferences with dropdown selections
  const activeHealthPreferences = useMemo(() => {
    const basePrefs = [...healthPreferences];
    selectedHealthConsiderations.forEach(pref => {
      if (!basePrefs.includes(pref)) {
        basePrefs.push(pref);
      }
    });
    return basePrefs;
  }, [healthPreferences, selectedHealthConsiderations]);

  const pendingAge = useMemo(() => {
    try {
      const raw = window.localStorage.getItem('pendingOnboarding');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed.age ? parseInt(parsed.age) : null;
    } catch {
      return null;
    }
  }, []);

  const userAge = pendingAge ?? profile?.age ?? null;
  const userAgeGroup = getAgeGroup(userAge);

  const ageBlockedTerms = useMemo(() => {
    const restricted = ageRestrictedTerms[userAgeGroup] || [];
    return restricted.flatMap(term => {
      const variants = new Set<string>();
      variants.add(term.toLowerCase());
      if (term.endsWith('s') && term.length > 1) variants.add(term.slice(0, -1).toLowerCase());
      else variants.add(`${term}s`.toLowerCase());
      return Array.from(variants);
    });
  }, [userAgeGroup]);

  const { data: globalRecipes = [], isLoading: isLoadingGlobal } = useGlobalRecipes();

  useEffect(() => {
    if (!user) return;

    const loadUserRecipes = async () => {
      const { data, error } = await supabase
        .from('recipes')
        .select(`
          id, title, description, image_url, prep_time, cook_time, total_time, servings, difficulty, cuisine,
          recipe_nutrition(calories, protein_g, carbs_g, fat_g),
          recipe_ingredients(name, normalized_name),
          recipe_tags(tag_type, tag_value)
        `)
        .eq('owner_user_id', user.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading user recipes:', error);
        return;
      }

      if (data) {
        setUserRecipes(data.map(r => ({
          id: r.id,
          title: r.title,
          description: r.description,
          image_url: r.image_url,
          prep_time: r.prep_time,
          cook_time: r.cook_time,
          total_time: r.total_time,
          servings: r.servings,
          difficulty: r.difficulty,
          cuisine: r.cuisine,
          // recipe_nutrition is one-to-one and can come back as an object (or null)
          nutrition: (Array.isArray(r.recipe_nutrition) ? r.recipe_nutrition?.[0] : r.recipe_nutrition) || undefined,
          ingredients: r.recipe_ingredients || [],
          tags: r.recipe_tags || [],
          isUserRecipe: true,
        })));
      }
    };

    loadUserRecipes();
  }, [user]);

  const allRecipes = useMemo(() => {
    switch (recipeSource) {
      case 'my': return userRecipes;
      case 'app': return globalRecipes;
      default: return [...userRecipes, ...globalRecipes];
    }
  }, [userRecipes, globalRecipes, recipeSource]);

  // Apply slot-based filtering when in plan mode
  const filteredRecipes = useMemo(() => {
    // When in swap mode, show all recipes filtered by meal type (not restricted to pool)
    if (swapContext && currentSlotFilter) {
      const slotMealType = getMealTypeForSlot(currentSlotFilter);
      return allRecipes.filter(recipe => {
        if (!recipe.isUserRecipe && (!recipe.image_url || recipe.image_url.includes('undefined') || (!recipe.image_url.startsWith('http') && !recipe.image_url.startsWith('/')))) {
          return false;
        }
        if (searchQuery) {
          const searchTerms = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
          const titleLower = recipe.title.toLowerCase();
          const descLower = (recipe.description || '').toLowerCase();
          const matchesSearch = searchTerms.every(term => 
            titleLower.includes(term) || descLower.includes(term)
          );
          if (!matchesSearch) return false;
        }
        if (selectedTime && recipe.total_time && recipe.total_time > parseInt(selectedTime)) {
          return false;
        }
        // Lunch and dinner are interchangeable
        const mealTypesToMatch = slotMealType === 'lunch' || slotMealType === 'dinner' 
          ? ['lunch', 'dinner'] 
          : [slotMealType];
        if (slotMealType && !recipe.tags.some(t => t.tag_type === 'meal' && mealTypesToMatch.includes(t.tag_value))) {
          return false;
        }
        if (selectedCuisine && recipe.cuisine?.toLowerCase() !== selectedCuisine.toLowerCase()) {
          return false;
        }
        // Apply keto filtering in swap mode
        if (userDietType === 'keto' && !isKetoFriendly(recipe.nutrition)) {
          return false;
        }
        return true;
      });
    }
    
    // When in plan mode with a slot filter selected (not swapping), show only recipes in that slot's pool
    if (isPlanMode && currentSlotFilter) {
      const poolRecipeIds = recipePoolsBySlot[currentSlotFilter] || [];
      if (poolRecipeIds.length === 0) {
        // If pool is empty, show recipes filtered by meal type for that slot
        const slotMealType = getMealTypeForSlot(currentSlotFilter);
        return allRecipes.filter(recipe => {
          if (!recipe.isUserRecipe && (!recipe.image_url || recipe.image_url.includes('undefined') || (!recipe.image_url.startsWith('http') && !recipe.image_url.startsWith('/')))) {
            return false;
          }
          if (searchQuery) {
            const searchTerms = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
            const titleLower = recipe.title.toLowerCase();
            const descLower = (recipe.description || '').toLowerCase();
            const matchesSearch = searchTerms.every(term => 
              titleLower.includes(term) || descLower.includes(term)
            );
            if (!matchesSearch) return false;
          }
          if (selectedTime && recipe.total_time && recipe.total_time > parseInt(selectedTime)) {
            return false;
          }
          // Lunch and dinner are interchangeable
          const mealTypesToMatch = slotMealType === 'lunch' || slotMealType === 'dinner' 
            ? ['lunch', 'dinner'] 
            : [slotMealType];
          if (slotMealType && !recipe.tags.some(t => t.tag_type === 'meal' && mealTypesToMatch.includes(t.tag_value))) {
            return false;
          }
          if (selectedCuisine && recipe.cuisine?.toLowerCase() !== selectedCuisine.toLowerCase()) {
            return false;
          }
          // Apply keto filtering in plan mode
          if (userDietType === 'keto' && !isKetoFriendly(recipe.nutrition)) {
            return false;
          }
          return true;
        });
      }
      
      // Show only recipes that are in the selected slot's pool
      return allRecipes.filter(recipe => poolRecipeIds.includes(recipe.id));
    }
    
    let recipes = allRecipes.filter(recipe => {
      if (!recipe.isUserRecipe && (!recipe.image_url || recipe.image_url.includes('undefined') || (!recipe.image_url.startsWith('http') && !recipe.image_url.startsWith('/')))) {
        return false;
      }
      if (searchQuery) {
        const searchTerms = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
        const titleLower = recipe.title.toLowerCase();
        const descLower = (recipe.description || '').toLowerCase();
        // Match if ALL search terms appear in title OR description
        const matchesSearch = searchTerms.every(term => 
          titleLower.includes(term) || descLower.includes(term)
        );
        if (!matchesSearch) return false;
      }
      if (selectedTime && recipe.total_time && recipe.total_time > parseInt(selectedTime)) {
        return false;
      }
      
      // Apply meal type filter (lunch and dinner are interchangeable)
      if (selectedMealType) {
        const mealTypesToMatch = selectedMealType === 'lunch' || selectedMealType === 'dinner' 
          ? ['lunch', 'dinner'] 
          : [selectedMealType];
        if (!recipe.tags.some(t => t.tag_type === 'meal' && mealTypesToMatch.includes(t.tag_value))) {
          return false;
        }
      }
      if (selectedCuisine && recipe.cuisine?.toLowerCase() !== selectedCuisine.toLowerCase()) {
        return false;
      }
      if (!recipe.isUserRecipe && blockedTerms.length > 0) {
        const titleLower = recipe.title.toLowerCase();
        const ingredientNames = (recipe.ingredients || []).map((ing) => (ing.normalized_name || ing.name || '').toLowerCase());
        const matchesBlocked = (text: string) => blockedTerms.some((term) => text.includes(term));
        const matchesBlockedIngredients = () => blockedTerms.some((term) => ingredientNames.some((name) => name.includes(term)));
        if (matchesBlocked(titleLower)) return false;
        if (matchesBlockedIngredients()) return false;
      }
      if (!recipe.isUserRecipe && ageBlockedTerms.length > 0) {
        const titleLower = recipe.title.toLowerCase();
        const descLower = (recipe.description || '').toLowerCase();
        const ingredientNames = (recipe.ingredients || []).map((ing) => (ing.normalized_name || ing.name || '').toLowerCase());
        const matchesAgeRestricted = (text: string) => ageBlockedTerms.some((term) => text.includes(term));
        const matchesAgeRestrictedIngredients = () => ageBlockedTerms.some((term) => ingredientNames.some((name) => name.includes(term)));
        if (matchesAgeRestricted(titleLower)) return false;
        if (matchesAgeRestricted(descLower)) return false;
        if (matchesAgeRestrictedIngredients()) return false;
      }
      // Keto diet: filter by comprehensive keto criteria (low carbs, moderate protein, high fat)
      if (userDietType === 'keto') {
        if (!isKetoFriendly(recipe.nutrition)) {
          return false;
        }
      }
      if (!recipe.isUserRecipe && activeHealthPreferences.length > 0) {
        const recipeMedicalTags = (recipe.tags || []).filter(t => t.tag_type === 'medical').map(t => t.tag_value);
        const hasAllHealthTags = activeHealthPreferences.every(pref => recipeMedicalTags.includes(pref));
        if (!hasAllHealthTags) return false;
      }
      return true;
    });

    // Sort recipes - prioritize macro gap filling in plan mode
    recipes = recipes.sort((a, b) => {
      let aScore = 0;
      let bScore = 0;
      
      // Macro gap-aware sorting when in plan mode with gap context
      if (isPlanMode && macroGapContext && macroGapContext.primaryGap) {
        const aNutrition = a.nutrition;
        const bNutrition = b.nutrition;
        
        if (aNutrition && bNutrition) {
          // Score based on how well the recipe fills the primary gap
          const getGapFillScore = (nutrition: typeof aNutrition) => {
            if (!nutrition) return 0;
            
            const primaryGap = macroGapContext.primaryGap;
            let fillScore = 0;
            
            // Calculate how much of the gap this recipe fills
            if (primaryGap === 'protein' && macroGapContext.proteinGap > 0) {
              const proteinFill = Math.min(nutrition.protein_g || 0, macroGapContext.proteinGap);
              fillScore = (proteinFill / macroGapContext.proteinGap) * 100;
            } else if (primaryGap === 'carbs' && macroGapContext.carbsGap > 0) {
              const carbsFill = Math.min(nutrition.carbs_g || 0, macroGapContext.carbsGap);
              fillScore = (carbsFill / macroGapContext.carbsGap) * 100;
            } else if (primaryGap === 'fat' && macroGapContext.fatGap > 0) {
              const fatFill = Math.min(nutrition.fat_g || 0, macroGapContext.fatGap);
              fillScore = (fatFill / macroGapContext.fatGap) * 100;
            }
            
            // Penalize if it overshoots other macros significantly
            if (primaryGap !== 'protein' && macroGapContext.proteinGap <= 0) {
              const overshoot = (nutrition.protein_g || 0) / (dailyTargets?.protein || 100);
              if (overshoot > 0.3) fillScore -= overshoot * 10;
            }
            if (primaryGap !== 'carbs' && macroGapContext.carbsGap <= 0) {
              const overshoot = (nutrition.carbs_g || 0) / (dailyTargets?.carbs || 100);
              if (overshoot > 0.3) fillScore -= overshoot * 10;
            }
            if (primaryGap !== 'fat' && macroGapContext.fatGap <= 0) {
              const overshoot = (nutrition.fat_g || 0) / (dailyTargets?.fat || 100);
              if (overshoot > 0.3) fillScore -= overshoot * 10;
            }
            
            return fillScore;
          };
          
          aScore += getGapFillScore(aNutrition);
          bScore += getGapFillScore(bNutrition);
        }
      }
      
      // Kid-friendly boost for young users
      if (userAgeGroup === 'toddler' || userAgeGroup === 'child') {
        if ((a as any).is_kid_friendly) aScore += 5;
        if ((b as any).is_kid_friendly) bScore += 5;
      }
      
      return bScore - aScore;
    });

    return recipes;
  }, [allRecipes, searchQuery, selectedTime, selectedMealType, selectedCuisine, blockedTerms, ageBlockedTerms, userAgeGroup, activeHealthPreferences, isPlanMode, currentSlotFilter, recipePoolsBySlot, macroGapContext, dailyTargets]);

  // Helper to get meal type from slot ID
  function getMealTypeForSlot(slotId: MealSlotId): string {
    const slot = selectedMealSlots.find(s => s.id === slotId);
    return slot?.type || 'dinner';
  }

  // Check if recipe is in current pool
  const isInPool = (recipeId: string) => {
    if (!currentSlotFilter) {
      return Object.values(recipePoolsBySlot).some(pool => pool.includes(recipeId));
    }
    return (recipePoolsBySlot[currentSlotFilter] || []).includes(recipeId);
  };

  const isSelected = (recipeId: string) => {
    if (isPlanMode) {
      return isInPool(recipeId);
    }
    return selectedMeals.some(r => r.id === recipeId);
  };

  const { removeFromPool } = useMealPlanStore();
  
  const handleSelect = (recipe: any) => {
    if (isPlanMode) {
      // If in swap mode, directly replace the recipe and go back to Plan
      if (swapContext) {
        swapRecipe(swapContext.dayIndex, swapContext.slotId, recipe.id);
        setSwapContext(null);
        setIsPlanMode(false);
        navigate('/plan');
        return;
      }
      // If viewing a specific slot and recipe is in that slot's pool, remove it
      if (currentSlotFilter && isInPool(recipe.id)) {
        removeFromPool(currentSlotFilter, recipe.id);
        return;
      }
      // Open add to plan modal
      setAddToPlanModal({
        open: true,
        recipeId: recipe.id,
        recipeName: recipe.title,
      });
    } else {
      if (isSelected(recipe.id)) {
        removeSelectedMeal(recipe.id);
      } else {
        addSelectedMeal(recipe);
      }
    }
  };

  const handleExitPlanMode = () => {
    setIsPlanMode(false);
  };

  const totalPoolRecipes = useMemo(() => {
    return Object.values(recipePoolsBySlot).reduce((sum, pool) => sum + pool.length, 0);
  }, [recipePoolsBySlot]);

  const canGeneratePlan = useMemo(() => {
    if (!isPlanMode || selectedMealSlots.length === 0) return false;
    return selectedMealSlots.every(slot => (recipePoolsBySlot[slot.id] || []).length > 0);
  }, [isPlanMode, selectedMealSlots, recipePoolsBySlot]);

  return (
    <div className="min-h-screen bg-background pb-40">
      <div className="page-container">
        <PageHeader
          title={isPlanMode ? t('plan.selectRecipes', 'Select Recipes') : t('discover.title')}
          subtitle={isPlanMode ? undefined : t('discover.subtitle')}
        />

        {/* Plan Mode Header */}
        {isPlanMode && !swapContext && (
          <PlanModeHeader onExit={handleExitPlanMode} />
        )}

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder={t('discover.searchPlaceholder', 'Search recipes...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 text-base"
          />
        </div>

        {/* Age-based filtering indicator */}
        {(userAgeGroup === 'toddler' || userAgeGroup === 'child') && userAge && (
          <div className="p-3 rounded-xl bg-warning/10 border border-warning/20 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-warning/20 flex items-center justify-center">
                <Baby className="w-4 h-4 text-warning" />
              </div>
              <div>
                <p className="text-sm font-medium text-warning-foreground">
                  {t('discover.kidFriendlyMode', 'Kid-Friendly Mode')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {userAgeGroup === 'toddler' 
                    ? t('discover.toddlerFiltering', 'Showing safe, mild recipes for toddlers')
                    : t('discover.childFiltering', 'Prioritizing kid-approved meals')
                  }
                </p>
              </div>
            </div>
          </div>
        )}
        
        {activeHealthPreferences.length > 0 && (
          <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <HeartPulse className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-primary">
                  {t('discover.healthMode', 'Health-Conscious Mode')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('discover.healthFiltering', 'Prioritizing {{prefs}} recipes', { 
                    prefs: activeHealthPreferences.map(p => p.replace('-', ' ')).join(', ') 
                  })}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Macro gap sorting indicator */}
        {isPlanMode && macroGapContext && macroGapContext.primaryGap && (
          <div className="p-3 rounded-xl bg-accent/50 border border-accent mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                {macroGapContext.primaryGap === 'protein' && <Flame className="w-4 h-4 text-[hsl(var(--protein))]" />}
                {macroGapContext.primaryGap === 'carbs' && <Wheat className="w-4 h-4 text-[hsl(var(--carbs))]" />}
                {macroGapContext.primaryGap === 'fat' && <Droplets className="w-4 h-4 text-[hsl(var(--fat))]" />}
              </div>
              <div>
                <p className="text-sm font-medium">
                  Sorted by {macroGapContext.primaryGap} content
                </p>
                <p className="text-xs text-muted-foreground">
                  Need ~{Math.round(
                    macroGapContext.primaryGap === 'protein' ? macroGapContext.proteinGap :
                    macroGapContext.primaryGap === 'carbs' ? macroGapContext.carbsGap :
                    macroGapContext.fatGap
                  )}g more {macroGapContext.primaryGap} to hit target
                </p>
              </div>
            </div>
          </div>
        )}

        {userRecipes.length > 0 && (
          <div className="p-3 rounded-xl bg-card border border-border mb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">{t('discover.recipeSource', 'Recipe Source')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('discover.myRecipesCount', '{{count}} recipes uploaded', { count: userRecipes.length })}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Chip selected={recipeSource === 'all'} onClick={() => setRecipeSource('all')} variant="outline">
                {t('discover.allRecipes', 'All Recipes')}
              </Chip>
              <Chip selected={recipeSource === 'my'} onClick={() => setRecipeSource('my')} variant="outline">
                {t('discover.onlyMyRecipes', 'My Recipes')}
              </Chip>
              <Chip selected={recipeSource === 'app'} onClick={() => setRecipeSource('app')} variant="outline">
                {t('discover.onlyAppRecipes', 'App Recipes')}
              </Chip>
            </div>
          </div>
        )}

        {/* Filter Dropdowns - all in one row */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-4 mb-4">
          {/* Meal Type - hidden in plan mode when slot is selected */}
          {(!isPlanMode || !currentSlotFilter) && (
            <FilterDropdown
              label="Meal"
              value={selectedMealType}
              options={mealFilterOptions}
              onChange={setSelectedMealType}
              icon={<UtensilsCrossed className="w-3 h-3" />}
            />
          )}
          
          {/* Time */}
          <FilterDropdown
            label="Time"
            value={selectedTime}
            options={timeFilterOptions}
            onChange={setSelectedTime}
            icon={<Clock className="w-3 h-3" />}
          />
          
          {/* Cuisine */}
          <FilterDropdown
            label="Cuisine"
            value={selectedCuisine}
            options={cuisineFilterOptions}
            onChange={setSelectedCuisine}
            icon={<ChefHat className="w-3 h-3" />}
          />
          
          {/* Diet Type */}
          <FilterDropdown
            label="Diet Type"
            value={activeDietType}
            options={dietTypeOptions}
            onChange={setSelectedDietType}
            icon={<Sparkles className="w-3 h-3" />}
          />
          
          {/* Allergies */}
          <MultiSelectDropdown
            label="Allergies"
            values={selectedAllergies}
            options={allergyOptions}
            onChange={setSelectedAllergies}
            icon={<AlertTriangle className="w-3 h-3" />}
            allowCustom
            customPlaceholder="Add allergy..."
          />
          
          {/* Dislikes */}
          <MultiSelectDropdown
            label="Dislikes"
            values={selectedDislikes}
            options={commonDislikes}
            onChange={setSelectedDislikes}
            icon={<X className="w-3 h-3" />}
            allowCustom
            customPlaceholder="Add dislike..."
          />
          
          {/* Health Considerations */}
          <MultiSelectDropdown
            label="Health"
            values={selectedHealthConsiderations}
            options={healthConsiderationOptions}
            onChange={setSelectedHealthConsiderations}
            icon={<HeartPulse className="w-3 h-3" />}
          />
        </div>

        {/* Swap Mode Banner - positioned below filters */}
        {swapContext && (
          <div className="p-4 rounded-xl bg-primary/10 border border-primary/30 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">
                  Choose a new {swapContext.slotLabel}
                </p>
                <p className="text-sm text-muted-foreground">
                  Replacing "{swapContext.originalRecipeName}"
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSwapContext(null);
                  setIsPlanMode(false);
                  navigate('/plan');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Recipe count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{filteredRecipes.length}</span> recipes found
          </p>
        </div>

        {/* Loading skeletons */}
        {isLoadingGlobal && (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-xl overflow-hidden">
                <Skeleton className="aspect-[4/3] w-full" />
                <div className="p-3 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Recipe Grid */}
        {!isLoadingGlobal && (
          <div className="grid grid-cols-2 gap-3">
            {filteredRecipes.map((recipe) => {
              const inCurrentPool = isPlanMode && currentSlotFilter && (recipePoolsBySlot[currentSlotFilter] || []).includes(recipe.id);
              const isChildUser = userAgeGroup === 'toddler' || userAgeGroup === 'child';
              
              // Build diet badges array from recipe tags + keto macro check
              const recipeDietTags = (recipe.tags || [])
                .filter((t: { tag_type: string; tag_value: string }) => t.tag_type === 'diet')
                .map((t: { tag_type: string; tag_value: string }) => t.tag_value.toLowerCase());
              
              // Add keto badge if passes strict macro check (even if not tagged)
              const dietBadges: string[] = [];
              if (isKetoFriendly(recipe.nutrition)) {
                dietBadges.push('keto');
              }
              // Add other diet badges from tags (avoid duplicating keto)
              ['vegan', 'vegetarian', 'pescatarian', 'paleo', 'mediterranean'].forEach(diet => {
                if (recipeDietTags.includes(diet) && !dietBadges.includes(diet)) {
                  dietBadges.push(diet);
                }
              });
              
              return (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe as any}
                  isSelected={isSelected(recipe.id)}
                  isRemovable={inCurrentPool}
                  onSelect={() => handleSelect(recipe)}
                  onClick={() => navigate(`/recipe/${recipe.id}`)}
                  compact
                  dietBadges={dietBadges}
                  showKidBadge={isChildUser}
                />
              );
            })}
          </div>
        )}

        {!isLoadingGlobal && filteredRecipes.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">{t('discover.noRecipes', 'No recipes found')}</p>
            {recipeSource === 'my' && userRecipes.length === 0 && (
              <Button variant="link" onClick={() => navigate('/my-recipes')} className="mt-2">
                {t('discover.addRecipes', 'Add your own recipes')}
              </Button>
            )}
            {recipeSource !== 'all' && (
              <Button variant="link" onClick={() => setRecipeSource('all')} className="mt-2">
                {t('discover.showAllRecipes', 'Show all recipes')}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Sticky Actions - hidden in swap mode */}
      <StickyActions show={!swapContext}>
        {isPlanMode ? (
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm">
              <span className="font-semibold text-primary">{totalPoolRecipes}</span>
              <span className="text-muted-foreground"> recipes added</span>
            </div>
            <Button
              onClick={() => navigate('/plan')}
              disabled={!canGeneratePlan}
              className="gradient-primary"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {t('plan.generatePlan', 'Generate Plan')}
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
          <div className="text-sm">
              <span className="font-semibold text-primary">{selectedMeals.length}</span>
              <span className="text-muted-foreground"> {t('common.selected', 'selected')}</span>
            </div>
            <Button
              onClick={() => navigate('/plan')}
              disabled={selectedMeals.length === 0}
              className="gradient-primary"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {t('discover.generateWeek', 'Generate Week')}
            </Button>
          </div>
        )}
      </StickyActions>

      <BottomNav />

      {/* Add to Plan Modal */}
      {addToPlanModal && (
        <AddToPlanModal
          open={addToPlanModal.open}
          onOpenChange={(open) => !open && setAddToPlanModal(null)}
          recipeId={addToPlanModal.recipeId}
          recipeName={addToPlanModal.recipeName}
          defaultSlot={currentSlotFilter}
        />
      )}
    </div>
  );
}
