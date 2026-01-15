import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, ShoppingCart, ListChecks, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/PageHeader';
import { BottomNav } from '@/components/layout/BottomNav';
import { StickyActions } from '@/components/ui/StickyActions';
import { NutritionGoalsModal } from '@/components/plan/NutritionGoalsModal';
import { DailyTargets } from '@/components/plan/DailyTargets';
import { useAppStore } from '@/stores/appStore';
import { useUserData } from '@/hooks/useUserData';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { format, addDays, startOfWeek } from 'date-fns';
import type { Recipe } from '@/types';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

type MealSlot = {
  slotType: MealType;
  meal: Recipe | null;
};

// Maps meals_per_day count to which meal types to show
const getMealTypesForCount = (count: number): MealType[] => {
  switch (count) {
    case 1:
      return ['lunch'];
    case 2:
      return ['breakfast', 'lunch'];
    case 3:
      return ['breakfast', 'lunch', 'dinner'];
    case 4:
      return ['breakfast', 'lunch', 'dinner', 'snack'];
    case 5:
      return ['breakfast', 'snack', 'lunch', 'snack', 'dinner'] as MealType[];
    case 6:
      return ['breakfast', 'snack', 'lunch', 'snack', 'dinner', 'snack'] as MealType[];
    default:
      return ['breakfast', 'lunch', 'dinner'];
  }
};

const inferMealType = (meal: Pick<Recipe, 'title' | 'tags'>): MealType => {
  // 1) Explicit tag wins
  const mealTypeTag = meal.tags?.find(
    (tag) => tag.tag_type === 'meal_type' && ['breakfast', 'lunch', 'dinner', 'snack'].includes(tag.tag_value)
  );
  if (mealTypeTag) return mealTypeTag.tag_value as MealType;

  const title = (meal.title || '').toLowerCase();

  // 2) Breakfast indicators
  if (
    title.includes('breakfast') ||
    title.includes('oatmeal') ||
    title.includes('omelet') ||
    title.includes('pancake') ||
    title.includes('egg muffin') ||
    title.includes('crepe') ||
    title.includes('french toast') ||
    title.includes('waffle') ||
    // important: handles "Avocado Deviled Eggs" better than classifying as lunch
    title.includes('egg') ||
    title.includes('eggs')
  ) {
    return 'breakfast';
  }

  // 3) Snack indicators
  if (
    title.includes('snack') ||
    title.includes('shake') ||
    title.includes('smoothie') ||
    title.includes('hummus') ||
    title.includes('dip') ||
    title.includes('pudding') ||
    title.includes('protein shake')
  ) {
    return 'snack';
  }

  // 4) Lunch indicators (lighter meals, salads, sandwiches, soups)
  if (
    title.includes('salad') ||
    title.includes('sandwich') ||
    title.includes('wrap') ||
    title.includes('soup') ||
    title.includes('spring roll')
  ) {
    return 'lunch';
  }

  // 5) Default
  return 'dinner';
};

const slotPreferenceOrder: Record<MealType, MealType[]> = {
  breakfast: ['breakfast', 'snack', 'lunch', 'dinner'],
  lunch: ['lunch', 'dinner', 'snack', 'breakfast'],
  dinner: ['dinner', 'lunch', 'snack', 'breakfast'],
  snack: ['snack', 'breakfast', 'lunch', 'dinner'],
};

function pickRotatingUnique(
  candidates: Recipe[],
  dayIndex: number,
  slotIndex: number,
  used: Set<string>
): Recipe | null {
  if (candidates.length === 0) return null;

  // deterministic but varied across days/slots
  const start = (dayIndex + slotIndex) % candidates.length;
  for (let i = 0; i < candidates.length; i++) {
    const idx = (start + i) % candidates.length;
    const candidate = candidates[idx];
    if (!used.has(candidate.id)) return candidate;
  }

  // if we must repeat, return the rotating one
  return candidates[start] ?? null;
}

export default function Plan() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { selectedMeals, onboardingState } = useAppStore();
  const { preferences, loading: preferencesLoading } = useUserData();
  const [selectedDay, setSelectedDay] = useState(0);
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [hasShownInitialModal, setHasShownInitialModal] = useState(false);

  // Show nutrition goals modal on first visit if no goals are set
  useEffect(() => {
    if (preferencesLoading || hasShownInitialModal) return;
    
    const hasNutritionGoals = preferences?.calorie_target || preferences?.meals_per_day;
    if (!hasNutritionGoals) {
      setShowGoalsModal(true);
      setHasShownInitialModal(true);
    }
  }, [preferences, preferencesLoading, hasShownInitialModal]);

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const mealsPerDay = preferences?.meals_per_day ?? onboardingState?.diet?.mealsPerDay ?? 3;
  const activeMealTypes = useMemo(() => getMealTypesForCount(mealsPerDay), [mealsPerDay]);

  const currentDaySlots: MealSlot[] = useMemo(() => {
    if (selectedMeals.length === 0) {
      return activeMealTypes.map((slotType) => ({ slotType, meal: null }));
    }

    const mealsByType: Record<MealType, Recipe[]> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
    };

    // bucket all selected meals
    for (const meal of selectedMeals) {
      mealsByType[inferMealType(meal)].push(meal);
    }

    const used = new Set<string>();

    // build slots; if a slot type has no matching meals, fallback to best available type
    return activeMealTypes.map((slotType, slotIndex) => {
      let chosen = pickRotatingUnique(mealsByType[slotType], selectedDay, slotIndex, used);

      if (!chosen) {
        const prefOrder = slotPreferenceOrder[slotType];
        for (const fallbackType of prefOrder) {
          chosen = pickRotatingUnique(mealsByType[fallbackType], selectedDay, slotIndex, used);
          if (chosen) break;
        }
      }

      if (chosen) used.add(chosen.id);

      return { slotType, meal: chosen };
    });
  }, [activeMealTypes, selectedDay, selectedMeals]);

  const totalCalories = useMemo(() => {
    return currentDaySlots.reduce((acc, slot) => acc + (slot.meal?.nutrition?.calories || 0), 0);
  }, [currentDaySlots]);

  return (
    <div className="min-h-screen bg-background pb-40">
      <div className="page-container">
        <PageHeader 
          title={t('plan.weeklyPlan')} 
          rightAction={
            <Button variant="ghost" size="icon" onClick={() => setShowGoalsModal(true)}>
              <Settings className="w-5 h-5" />
            </Button>
          }
        />

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
              <span className="text-xs font-medium opacity-80">{format(day, 'EEE')}</span>
              <span className="text-lg font-bold">{format(day, 'd')}</span>
            </button>
          ))}
        </div>

        {/* Daily Targets */}
        {preferences?.calorie_target && preferences?.protein_target && preferences?.carbs_target && preferences?.fat_target && (
          <DailyTargets
            calorieTarget={preferences.calorie_target}
            proteinTarget={preferences.protein_target}
            carbsTarget={preferences.carbs_target}
            fatTarget={preferences.fat_target}
          />
        )}

        {/* Daily View */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{format(days[selectedDay], 'EEEE, MMM d')}</h2>
            {totalCalories > 0 && <span className="text-sm text-muted-foreground">{totalCalories} cal</span>}
          </div>

          {selectedMeals.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground mb-4">{t('plan.noMeals')}</p>
              <Button variant="outline" onClick={() => navigate('/discover')} type="button">
                <Plus className="w-4 h-4 mr-2" />
                Add meals
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {currentDaySlots.map(({ slotType, meal }, index) => {
                const isEmpty = !meal;

                return (
                  <div
                    key={`${slotType}-${index}`}
                    className={cn('p-3 rounded-xl border', `meal-${slotType} border`, isEmpty && 'cursor-pointer')}
                    onClick={isEmpty ? () => navigate('/discover') : undefined}
                    role={isEmpty ? 'button' : undefined}
                    tabIndex={isEmpty ? 0 : undefined}
                    onKeyDown={
                      isEmpty
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') navigate('/discover');
                          }
                        : undefined
                    }
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium capitalize">{t(`mealTypes.${slotType}`)}</span>
                      {isEmpty && (
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate('/discover');
                          }}
                          aria-label={`Add ${slotType}`}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    {meal && (
                      <div className="flex gap-3">
                        <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                          {meal.image_url ? (
                            <img
                              src={meal.image_url}
                              alt={meal.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
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
          <Button variant="outline" className="flex-1" onClick={() => navigate('/grocery')} type="button">
            <ShoppingCart className="w-4 h-4 mr-2" />
            {t('grocery.title')}
          </Button>
          <Button variant="outline" className="flex-1" type="button">
            <ListChecks className="w-4 h-4 mr-2" />
            Meal Prep
          </Button>
        </div>
      </StickyActions>

      <BottomNav />
      
      <NutritionGoalsModal 
        open={showGoalsModal} 
        onOpenChange={setShowGoalsModal} 
      />
    </div>
  );
}
