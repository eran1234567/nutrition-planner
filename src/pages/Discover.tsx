import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Search, Clock, Sparkles, User as UserIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/PageHeader';
import { BottomNav } from '@/components/layout/BottomNav';
import { RecipeCard } from '@/components/recipe/RecipeCard';
import { StickyActions } from '@/components/ui/StickyActions';
import { Chip } from '@/components/ui/Chip';
import { seedRecipes } from '@/data/seedRecipes';
import { useAppStore } from '@/stores/appStore';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
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
  tags: { tag_type: string; tag_value: string }[];
  isUserRecipe: boolean;
}

export default function Discover() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { selectedMeals, addSelectedMeal, removeSelectedMeal } = useAppStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTime, setSelectedTime] = useState<number | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<string | null>(null);
  const [userRecipes, setUserRecipes] = useState<UserRecipe[]>([]);
  const [showUserRecipes, setShowUserRecipes] = useState(false);

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
          tags: r.recipe_tags || [],
          isUserRecipe: true,
        })));
      }
    };

    loadUserRecipes();
  }, [user]);

  const allRecipes = useMemo(() => {
    // Convert seed recipes to same format
    const formattedSeedRecipes = seedRecipes.map(r => ({
      ...r,
      isUserRecipe: false,
    }));

    // Combine user recipes with seed recipes
    return [...userRecipes, ...formattedSeedRecipes];
  }, [userRecipes]);

  const filteredRecipes = useMemo(() => {
    return allRecipes.filter(recipe => {
      // Filter by source
      if (showUserRecipes && !recipe.isUserRecipe) {
        return false;
      }

      // Filter out recipes without valid images (only for seed recipes)
      if (!recipe.isUserRecipe && (!recipe.image_url || recipe.image_url.includes('undefined') || !recipe.image_url.startsWith('http'))) {
        return false;
      }

      // Search filter
      if (searchQuery && !recipe.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Time filter
      if (selectedTime && recipe.total_time && recipe.total_time > selectedTime) {
        return false;
      }

      // Meal type filter
      if (selectedMealType && !recipe.tags.some(t => t.tag_type === 'meal' && t.tag_value === selectedMealType)) {
        return false;
      }

      return true;
    });
  }, [allRecipes, searchQuery, selectedTime, selectedMealType, showUserRecipes]);

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

        {/* Source filter (if user has recipes) */}
        {userRecipes.length > 0 && (
          <div className="flex gap-2 mb-2">
            <Chip
              selected={!showUserRecipes}
              onClick={() => setShowUserRecipes(false)}
              variant="outline"
            >
              {t('discover.allRecipes', 'All Recipes')}
            </Chip>
            <Chip
              selected={showUserRecipes}
              onClick={() => setShowUserRecipes(true)}
              variant="outline"
              icon={<UserIcon className="w-3 h-3" />}
            >
              {t('discover.myRecipes', 'My Recipes')} ({userRecipes.length})
            </Chip>
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

        {/* Recipe Grid */}
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

        {filteredRecipes.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">{t('discover.noRecipes', 'No recipes found')}</p>
            {showUserRecipes && (
              <Button
                variant="link"
                onClick={() => navigate('/my-recipes')}
                className="mt-2"
              >
                {t('discover.addRecipes', 'Add your own recipes')}
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
