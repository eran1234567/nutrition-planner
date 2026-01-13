import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Search, Clock, Sparkles, BookOpen } from 'lucide-react';
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

const timeFilters = [
  { label: '< 15 min', max: 15 },
  { label: '< 30 min', max: 30 },
  { label: '< 45 min', max: 45 },
  { label: '< 60 min', max: 60 },
];

const mealFilters = ['breakfast', 'lunch', 'dinner', 'snack'];

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
  const { preferences } = useUserData();
  const { selectedMeals, addSelectedMeal, removeSelectedMeal } = useAppStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTime, setSelectedTime] = useState<number | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<string | null>(null);
  const [userRecipes, setUserRecipes] = useState<UserRecipe[]>([]);
  const [recipeSource, setRecipeSource] = useState<'all' | 'my' | 'app'>('all');

  // Get user allergies + dislikes for filtering
  // Note: we expand simple singular/plural variants (e.g., "eggs" -> "egg") to catch common cases.
  const blockedTerms = useMemo(() => {
    const normalize = (v: string) => v.trim().toLowerCase();

    const base = [...(preferences?.allergies ?? []), ...(preferences?.dislikes ?? [])]
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
  }, [preferences?.allergies, preferences?.dislikes]);

  // Debug: confirm preferences are present and the terms we're filtering
  useEffect(() => {
    console.log('[Discover] blockedTerms:', blockedTerms);
  }, [blockedTerms]);

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

  // User's max cook time preference
  const userMaxCookTime = preferences?.max_cook_time ?? null;

  const filteredRecipes = useMemo(() => {
    return allRecipes.filter(recipe => {
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

      // User preference: max cook time filter (from onboarding)
      // Apply to app recipes; use total_time or fallback to cook_time
      if (!recipe.isUserRecipe && userMaxCookTime) {
        const recipeTime = recipe.total_time ?? recipe.cook_time ?? 0;
        if (recipeTime > userMaxCookTime) {
          return false;
        }
      }

      // Meal type filter
      if (selectedMealType && !recipe.tags.some(t => t.tag_type === 'meal' && t.tag_value === selectedMealType)) {
        return false;
      }

      // Filter based on user allergies and dislikes (only for global/app recipes, not user's own)
      if (!recipe.isUserRecipe && blockedTerms.length > 0) {
        const titleLower = recipe.title.toLowerCase();

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

      return true;
    });
  }, [allRecipes, searchQuery, selectedTime, userMaxCookTime, selectedMealType, blockedTerms]);

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

        {/* Recipe Source Filter */}
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
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-4 mb-4">
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
