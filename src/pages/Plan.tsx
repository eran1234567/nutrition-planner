import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Plus, ShoppingCart, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/PageHeader';
import { BottomNav } from '@/components/layout/BottomNav';
import { StickyActions } from '@/components/ui/StickyActions';
import { useAppStore } from '@/stores/appStore';
import { useUserData } from '@/hooks/useUserData';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { format, addDays, startOfWeek } from 'date-fns';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

// Maps meals_per_day count to which meal types to show
const getMealTypesForCount = (count: number): MealType[] => {
  switch (count) {
    case 1: return ['lunch'];
    case 2: return ['breakfast', 'lunch'];
    case 3: return ['breakfast', 'lunch', 'dinner'];
    case 4: return ['breakfast', 'lunch', 'dinner', 'snack'];
    case 5: return ['breakfast', 'snack', 'lunch', 'snack', 'dinner'] as MealType[];
    case 6: return ['breakfast', 'snack', 'lunch', 'snack', 'dinner', 'snack'] as MealType[];
    default: return ['breakfast', 'lunch', 'dinner'];
  }
};

// Infer the appropriate meal type for a recipe based on tags, title, and nutrition
const inferMealType = (meal: { title: string; tags?: Array<{ tag_type: string; tag_value: string }> }): MealType => {
  // First check explicit meal_type tag
  const mealTypeTag = meal.tags?.find(tag => 
    tag.tag_type === 'meal_type' && ['breakfast', 'lunch', 'dinner', 'snack'].includes(tag.tag_value)
  );
  if (mealTypeTag) {
    return mealTypeTag.tag_value as MealType;
  }
  
  // Infer from title
  const title = meal.title.toLowerCase();
  
  // Breakfast indicators
  if (title.includes('breakfast') || title.includes('oatmeal') || title.includes('omelet') || 
      title.includes('pancake') || title.includes('egg muffin') || title.includes('crepe') ||
      title.includes('french toast') || title.includes('waffle')) {
    return 'breakfast';
  }
  
  // Snack indicators
  if (title.includes('snack') || title.includes('shake') || title.includes('smoothie') || 
      title.includes('hummus') || title.includes('dip') || title.includes('pudding') ||
      title.includes('protein shake') || title.includes('fruit salad')) {
    return 'snack';
  }
  
  // Lunch indicators (lighter meals, salads, sandwiches, soups)
  if (title.includes('salad') || title.includes('sandwich') || title.includes('wrap') || 
      title.includes('soup') || title.includes('deviled') || title.includes('spring roll')) {
    return 'lunch';
  }
  
  // Default to dinner for heavier/main dishes
  return 'dinner';
};

export default function Plan() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { selectedMeals, onboardingState } = useAppStore();
  const { preferences } = useUserData();
  const [selectedDay, setSelectedDay] = useState(0);

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Get meals per day from preferences or onboarding state
  const mealsPerDay = preferences?.meals_per_day ?? onboardingState?.diet?.mealsPerDay ?? 3;
  
  // Get the meal types to display based on user preference
  const activeMealTypes = useMemo(() => getMealTypesForCount(mealsPerDay), [mealsPerDay]);

  // Assign selected meals to the appropriate meal slots based on inferred type
  const getMealsForDay = (dayIndex: number) => {
    if (selectedMeals.length === 0) return {};
    
    // Group meals by their inferred meal type
    const mealsByType: Record<MealType, typeof selectedMeals> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
    };
    
    selectedMeals.forEach((meal) => {
      const inferredType = inferMealType(meal);
      mealsByType[inferredType].push(meal);
    });
    
    // Build a map of mealType -> meal for this day
    const dayMeals: Record<MealType, typeof selectedMeals[0] | null> = {
      breakfast: null,
      lunch: null,
      dinner: null,
      snack: null,
    };
    
    // For each active meal type, pick a meal (cycling through available meals per day)
    activeMealTypes.forEach((mealType, slotIndex) => {
      const mealsOfType = mealsByType[mealType];
      if (mealsOfType.length > 0) {
        // Cycle through meals of this type based on day index
        const mealIndex = dayIndex % mealsOfType.length;
        dayMeals[mealType] = mealsOfType[mealIndex];
      }
    });
    
    return dayMeals;
  };

  const currentDayMeals = getMealsForDay(selectedDay);

  // Calculate total calories for displayed meals
  const totalCalories = activeMealTypes.reduce((acc, mealType) => {
    const meal = currentDayMeals[mealType];
    return acc + (meal?.nutrition?.calories || 0);
  }, 0);

  return (
    <div className="min-h-screen bg-background pb-40">
      <div className="page-container">
        <PageHeader title={t('plan.weeklyPlan')} />

        {/* Day Selector */}
        <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-4 -mx-1 px-1">
          {days.map((day, index) => (
            <button
              key={index}
              onClick={() => setSelectedDay(index)}
              className={cn(
                'flex flex-col items-center min-w-[48px] py-2 px-3 rounded-xl transition-all',
                selectedDay === index
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card border border-border hover:bg-muted'
              )}
            >
              <span className="text-xs font-medium opacity-80">
                {format(day, 'EEE')}
              </span>
              <span className="text-lg font-bold">{format(day, 'd')}</span>
            </button>
          ))}
        </div>

        {/* Daily View */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{format(days[selectedDay], 'EEEE, MMM d')}</h2>
            {totalCalories > 0 && (
              <span className="text-sm text-muted-foreground">
                {totalCalories} cal
              </span>
            )}
          </div>

          {selectedMeals.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground mb-4">{t('plan.noMeals')}</p>
              <Button variant="outline" onClick={() => navigate('/discover')}>
                <Plus className="w-4 h-4 mr-2" />
                Add meals
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {activeMealTypes.map((mealType, index) => {
                const meal = currentDayMeals[mealType];
                return (
                  <div
                    key={`${mealType}-${index}`}
                    className={cn(
                      'p-3 rounded-xl border',
                      `meal-${mealType} border`
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium capitalize">{t(`mealTypes.${mealType}`)}</span>
                      {!meal && (
                        <Button variant="ghost" size="sm" onClick={() => navigate('/discover')}>
                          <Plus className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    {meal && (
                      <div className="flex gap-3">
                        <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                          {meal.image_url ? (
                            <img src={meal.image_url} alt={meal.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-2xl">🍽️</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{meal.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {meal.nutrition?.calories} cal · {meal.nutrition?.protein_g}g protein
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sticky Actions */}
      <StickyActions>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => navigate('/grocery')}>
            <ShoppingCart className="w-4 h-4 mr-2" />
            {t('grocery.title')}
          </Button>
          <Button variant="outline" className="flex-1">
            <ListChecks className="w-4 h-4 mr-2" />
            Meal Prep
          </Button>
        </div>
      </StickyActions>

      <BottomNav />
    </div>
  );
}
