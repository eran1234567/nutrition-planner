import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Search, Clock, Sparkles, BookOpen, ChefHat, Baby } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/PageHeader';
import { BottomNav } from '@/components/layout/BottomNav';
import { RecipeCard } from '@/components/recipe/RecipeCard';
import { StickyActions } from '@/components/ui/StickyActions';
import { Chip } from '@/components/ui/Chip';
import { Skeleton } from '@/components/ui/skeleton';
import { useGlobalRecipes } from '@/hooks/useGlobalRecipes';
import { useAppStore } from '@/stores/appStore';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserData } from '@/hooks/useUserData';
import { supabase } from '@/integrations/supabase/client';

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
    // Choking hazards
    'whole nut', 'peanut', 'almond', 'walnut', 'cashew', 'pistachio', 'macadamia',
    'popcorn', 'hard candy', 'gum', 'marshmallow',
    // Spicy foods
    'jalapeño', 'jalapeno', 'habanero', 'ghost pepper', 'cayenne', 'hot sauce', 'sriracha', 'wasabi', 'horseradish',
    'extra spicy', 'very spicy', 'fiery', 'blazing',
    // Raw/undercooked items
    'raw fish', 'sashimi', 'tartare', 'rare steak', 'runny egg', 'soft boiled',
    // High sodium/processed
    'cured meat', 'prosciutto', 'salami', 'pepperoni',
    // Alcohol-based
    'wine sauce', 'beer batter', 'bourbon', 'rum', 'whiskey', 'brandy',
    // Tough textures
    'jerky', 'beef jerky', 'dried meat',
  ],
  child: [
    // Less restrictive - mainly spicy and raw items
    'jalapeño', 'jalapeno', 'habanero', 'ghost pepper', 'cayenne',
    'extra spicy', 'very spicy', 'fiery', 'blazing',
    'raw fish', 'sashimi', 'tartare',
    'wine sauce', 'beer batter', 'bourbon', 'rum', 'whiskey', 'brandy',
  ],
  teen: [
    // Only alcohol-based items
    'wine sauce', 'beer batter', 'bourbon', 'rum sauce', 'whiskey glaze', 'brandy',
  ],
  adult: [], // No restrictions
};

const timeFilters = [
  { label: '< 15 min', max: 15 },
  { label: '< 30 min', max: 30 },
  { label: '< 45 min', max: 45 },
  { label: '< 60 min', max: 60 },
];

const mealFilters = ['breakfast', 'lunch', 'dinner', 'snack'];

const cuisineFilters = ['American', 'Italian', 'Mexican', 'Asian', 'Mediterranean', 'Indian', 'Japanese', 'Thai', 'French', 'Greek'];

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

  // If the user isn't signed in yet, onboarding stores choices locally.
  // Use those values to keep Discover filtering consistent for guests.
  const pendingOnboarding = useMemo(() => {
    try {
      const raw = window.localStorage.getItem('pendingOnboarding');
      if (!raw) return null;
      return JSON.parse(raw) as {
        dietType?: string;
        allergies?: string[];
        dislikes?: string[];
      };
    } catch {
      return null;
    }
  }, []);

  const effectiveDietType = (pendingOnboarding?.dietType ?? preferences?.diet_type ?? 'none') as string;
  const effectiveAllergies = pendingOnboarding?.allergies ?? preferences?.allergies ?? [];
  const effectiveDislikes = pendingOnboarding?.dislikes ?? preferences?.dislikes ?? [];

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTime, setSelectedTime] = useState<number | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<string | null>(null);
  const [selectedCuisine, setSelectedCuisine] = useState<string | null>(null);
  const [userRecipes, setUserRecipes] = useState<UserRecipe[]>([]);
  const [recipeSource, setRecipeSource] = useState<'all' | 'my' | 'app'>('all');

  // Get user diet type for filtering
  const userDietType = (effectiveDietType || 'none').toLowerCase();

  // Define ingredients/terms that are excluded for each diet type
  const dietExclusions: Record<string, string[]> = {
    vegan: [
      'chicken', 'beef', 'pork', 'lamb', 'fish', 'salmon', 'tuna', 'shrimp', 'prawn', 'lobster', 'crab', 'shellfish', 'seafood',
      'meat', 'bacon', 'ham', 'sausage', 'turkey', 'duck', 'veal', 'steak',
      'egg', 'eggs',
      'dairy', 'milk', 'cheese', 'butter', 'cream', 'yogurt',
      'honey',
    ],
    vegetarian: [
      'chicken', 'beef', 'pork', 'lamb', 'fish', 'salmon', 'tuna', 'shrimp', 'prawn', 'lobster', 'crab', 'shellfish', 'seafood',
      'meat', 'bacon', 'ham', 'sausage', 'turkey', 'duck', 'veal', 'steak',
    ],
    pescatarian: ['chicken', 'beef', 'pork', 'lamb', 'meat', 'bacon', 'ham', 'sausage', 'turkey', 'duck', 'veal', 'steak'],
    keto: [], // Keto is about macros, not specific ingredients - handled differently
    paleo: ['bread', 'pasta', 'rice', 'grain', 'wheat', 'oat', 'corn', 'bean', 'lentil', 'peanut', 'soy', 'tofu', 'sugar', 'dairy', 'milk', 'cheese'],
    mediterranean: [], // Mediterranean is a style, not exclusionary
    none: [],
  };

  // Get user allergies + dislikes for filtering
  // Note: we expand simple singular/plural variants (e.g., "eggs" -> "egg") to catch common cases.
  const blockedTerms = useMemo(() => {
    const normalize = (v: string) => v.trim().toLowerCase();

    // Start with diet-based exclusions
    const dietExcluded = dietExclusions[userDietType] || [];

    const base = [...dietExcluded, ...effectiveAllergies, ...effectiveDislikes]
      .filter(Boolean)
      .map(normalize)
      .filter(Boolean);

    const expanded = base.flatMap((term) => {
      const variants = new Set<string>();
      variants.add(term);

      // naive singular/plural handling
      if (term.endsWith('s') && term.length > 1) variants.add(term.slice(0, -1));
      else variants.add(`${term}s`);

      return Array.from(variants);
    });

    return Array.from(new Set(expanded)).filter(Boolean);
  }, [effectiveAllergies, effectiveDislikes, userDietType]);

  // Get user age from profile or pending onboarding
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

  // Get age-restricted terms based on user's age
  const ageBlockedTerms = useMemo(() => {
    const restricted = ageRestrictedTerms[userAgeGroup] || [];
    // Expand with singular/plural variants
    return restricted.flatMap(term => {
      const variants = new Set<string>();
      variants.add(term.toLowerCase());
      if (term.endsWith('s') && term.length > 1) variants.add(term.slice(0, -1).toLowerCase());
      else variants.add(`${term}s`.toLowerCase());
      return Array.from(variants);
    });
  }, [userAgeGroup]);

  // Debug: confirm preferences are present and the terms we're filtering
  useEffect(() => {
    console.log('[Discover] userDietType:', userDietType);
    console.log('[Discover] userAge:', userAge, 'ageGroup:', userAgeGroup);
    console.log('[Discover] blockedTerms:', blockedTerms);
    console.log('[Discover] ageBlockedTerms:', ageBlockedTerms);
  }, [blockedTerms, userDietType, userAge, userAgeGroup, ageBlockedTerms]);

  // Fetch global recipes from database
  const { data: globalRecipes = [], isLoading: isLoadingGlobal } = useGlobalRecipes();
  // Load user's recipes from database
  useEffect(() => {
    if (!user) return;

    const loadUserRecipes = async () => {
      const { data, error } = await supabase
        .from('recipes')
        .select(`
          id,
          title,
          description,
          image_url,
          prep_time,
          cook_time,
          total_time,
          servings,
          difficulty,
          cuisine,
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
          nutrition: r.recipe_nutrition?.[0] || undefined,
          ingredients: r.recipe_ingredients || [],
          tags: r.recipe_tags || [],
          isUserRecipe: true,
        })));
      }
    };

    loadUserRecipes();
  }, [user]);

  const allRecipes = useMemo(() => {
    // Filter based on recipe source
    switch (recipeSource) {
      case 'my':
        return userRecipes;
      case 'app':
        return globalRecipes;
      default: // 'all'
        return [...userRecipes, ...globalRecipes];
    }
  }, [userRecipes, globalRecipes, recipeSource]);

  const filteredRecipes = useMemo(() => {
    let recipes = allRecipes.filter(recipe => {
      // Filter out recipes without valid images (only for app recipes)
      if (!recipe.isUserRecipe && (!recipe.image_url || recipe.image_url.includes('undefined') || !recipe.image_url.startsWith('http'))) {
        return false;
      }

      // Search filter
      if (searchQuery && !recipe.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Time filter (manual selection from chips)
      if (selectedTime && recipe.total_time && recipe.total_time > selectedTime) {
        return false;
      }

      // Meal type filter
      if (selectedMealType && !recipe.tags.some(t => t.tag_type === 'meal' && t.tag_value === selectedMealType)) {
        return false;
      }

      // Cuisine filter
      if (selectedCuisine && recipe.cuisine?.toLowerCase() !== selectedCuisine.toLowerCase()) {
        return false;
      }

      // Filter based on user allergies, diet, and dislikes (only for global/app recipes, not user's own)
      if (!recipe.isUserRecipe && blockedTerms.length > 0) {
        const titleLower = recipe.title.toLowerCase();
        const descLower = (recipe.description || '').toLowerCase();

        // Get all ingredient names (use normalized_name if available, fallback to name)
        const ingredientNames = (recipe.ingredients || []).map((ing) =>
          (ing.normalized_name || ing.name || '').toLowerCase()
        );

        const matchesBlocked = (text: string) => blockedTerms.some((term) => text.includes(term));
        const matchesBlockedIngredients = () =>
          blockedTerms.some((term) => ingredientNames.some((name) => name.includes(term)));

        if (matchesBlocked(titleLower)) return false;
        if (matchesBlockedIngredients()) return false;
      }

      // Age-based filtering (only for app recipes)
      if (!recipe.isUserRecipe && ageBlockedTerms.length > 0) {
        const titleLower = recipe.title.toLowerCase();
        const descLower = (recipe.description || '').toLowerCase();
        const ingredientNames = (recipe.ingredients || []).map((ing) =>
          (ing.normalized_name || ing.name || '').toLowerCase()
        );

        const matchesAgeRestricted = (text: string) => ageBlockedTerms.some((term) => text.includes(term));
        const matchesAgeRestrictedIngredients = () =>
          ageBlockedTerms.some((term) => ingredientNames.some((name) => name.includes(term)));

        if (matchesAgeRestricted(titleLower)) return false;
        if (matchesAgeRestricted(descLower)) return false;
        if (matchesAgeRestrictedIngredients()) return false;
      }

      return true;
    });

    // For young children (toddler/child), prioritize kid-friendly recipes by sorting them first
    if (userAgeGroup === 'toddler' || userAgeGroup === 'child') {
      recipes = recipes.sort((a, b) => {
        const aKidFriendly = (a as any).is_kid_friendly ? 1 : 0;
        const bKidFriendly = (b as any).is_kid_friendly ? 1 : 0;
        return bKidFriendly - aKidFriendly; // Kid-friendly first
      });
    }

    return recipes;
  }, [allRecipes, searchQuery, selectedTime, selectedMealType, selectedCuisine, blockedTerms, ageBlockedTerms, userAgeGroup]);

  const isSelected = (recipeId: string) => selectedMeals.some(r => r.id === recipeId);

  const handleSelect = (recipe: any) => {
    if (isSelected(recipe.id)) {
      removeSelectedMeal(recipe.id);
    } else {
      addSelectedMeal(recipe);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-40">
      <div className="page-container">
        <PageHeader
          title={t('discover.title')}
          subtitle={t('discover.subtitle')}
        />

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

        {/* Age-based filtering indicator for young users */}
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
        {userRecipes.length > 0 && (
          <div className="p-3 rounded-xl bg-card border border-border mb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  {t('discover.recipeSource', 'Recipe Source')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('discover.myRecipesCount', '{{count}} recipes uploaded', { count: userRecipes.length })}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Chip
                selected={recipeSource === 'all'}
                onClick={() => setRecipeSource('all')}
                variant="outline"
              >
                {t('discover.allRecipes', 'All Recipes')}
              </Chip>
              <Chip
                selected={recipeSource === 'my'}
                onClick={() => setRecipeSource('my')}
                variant="outline"
              >
                {t('discover.onlyMyRecipes', 'My Recipes')}
              </Chip>
              <Chip
                selected={recipeSource === 'app'}
                onClick={() => setRecipeSource('app')}
                variant="outline"
              >
                {t('discover.onlyAppRecipes', 'App Recipes')}
              </Chip>
            </div>
          </div>
        )}

        {/* Meal type filters */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 mb-2">
          {mealFilters.map(meal => (
            <Chip
              key={meal}
              selected={selectedMealType === meal}
              onClick={() => setSelectedMealType(selectedMealType === meal ? null : meal)}
              variant="outline"
            >
              {t(`mealTypes.${meal}`)}
            </Chip>
          ))}
        </div>

        {/* Time filters */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 mb-2">
          {timeFilters.map(filter => (
            <Chip
              key={filter.max}
              selected={selectedTime === filter.max}
              onClick={() => setSelectedTime(selectedTime === filter.max ? null : filter.max)}
              variant="outline"
              icon={<Clock className="w-3 h-3" />}
            >
              {filter.label}
            </Chip>
          ))}
        </div>

        {/* Cuisine filters */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-4 mb-4">
          {cuisineFilters.map(cuisine => (
            <Chip
              key={cuisine}
              selected={selectedCuisine === cuisine}
              onClick={() => setSelectedCuisine(selectedCuisine === cuisine ? null : cuisine)}
              variant="outline"
              icon={<ChefHat className="w-3 h-3" />}
            >
              {t(`cuisines.${cuisine.toLowerCase()}`, cuisine)}
            </Chip>
          ))}
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
            {filteredRecipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe as any}
                isSelected={isSelected(recipe.id)}
                onSelect={() => handleSelect(recipe)}
                onClick={() => navigate(`/recipe/${recipe.id}`)}
                compact
              />
            ))}
          </div>
        )}

        {!isLoadingGlobal && filteredRecipes.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">{t('discover.noRecipes', 'No recipes found')}</p>
            {recipeSource === 'my' && userRecipes.length === 0 && (
              <Button
                variant="link"
                onClick={() => navigate('/my-recipes')}
                className="mt-2"
              >
                {t('discover.addRecipes', 'Add your own recipes')}
              </Button>
            )}
            {recipeSource !== 'all' && (
              <Button
                variant="link"
                onClick={() => setRecipeSource('all')}
                className="mt-2"
              >
                {t('discover.showAllRecipes', 'Show all recipes')}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Sticky Actions */}
      <StickyActions show={true}>
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm">
            <span className="font-semibold text-primary">{selectedMeals.length}</span>
            <span className="text-muted-foreground"> {t('discover.selected', 'selected')}</span>
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
      </StickyActions>

      <BottomNav />
    </div>
  );
}
