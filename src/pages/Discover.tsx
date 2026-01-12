import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Search, SlidersHorizontal, Clock, Flame, Sparkles } from 'lucide-react';
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

const timeFilters = [
  { label: '< 15 min', max: 15 },
  { label: '< 30 min', max: 30 },
  { label: '< 45 min', max: 45 },
  { label: '< 60 min', max: 60 },
];

const mealFilters = ['breakfast', 'lunch', 'dinner', 'snack'];

export default function Discover() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { selectedMeals, addSelectedMeal, removeSelectedMeal } = useAppStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTime, setSelectedTime] = useState<number | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<string | null>(null);

  const mealsNeeded = 3; // Default meals per day

  const filteredRecipes = useMemo(() => {
    return seedRecipes.filter(recipe => {
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
  }, [searchQuery, selectedTime, selectedMealType]);

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
            placeholder="Search recipes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 text-base"
          />
        </div>

        {/* Filters */}
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
              compact
            />
          ))}
        </div>

        {filteredRecipes.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No recipes found</p>
          </div>
        )}
      </div>

      {/* Sticky Actions */}
      <StickyActions show={true}>
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm">
            <span className="font-semibold text-primary">{selectedMeals.length}</span>
            <span className="text-muted-foreground"> selected</span>
          </div>
          <Button
            onClick={() => navigate('/plan')}
            disabled={selectedMeals.length === 0}
            className="gradient-primary"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Generate Week
          </Button>
        </div>
      </StickyActions>

      <BottomNav />
    </div>
  );
}
