import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Plus, ShoppingCart, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/PageHeader';
import { BottomNav } from '@/components/layout/BottomNav';
import { StickyActions } from '@/components/ui/StickyActions';
import { useAppStore } from '@/stores/appStore';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { format, addDays, startOfWeek } from 'date-fns';

const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

export default function Plan() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { selectedMeals } = useAppStore();
  const [selectedDay, setSelectedDay] = useState(0);

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Simple mock plan based on selected meals
  const getMealsForDay = (dayIndex: number) => {
    if (selectedMeals.length === 0) return [];
    return selectedMeals.slice(0, 3).map((meal, i) => ({
      ...meal,
      mealType: mealTypes[i % 4],
    }));
  };

  const currentDayMeals = getMealsForDay(selectedDay);

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
            {currentDayMeals.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {currentDayMeals.reduce((acc, m) => acc + (m.nutrition?.calories || 0), 0)} cal
              </span>
            )}
          </div>

          {currentDayMeals.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground mb-4">{t('plan.noMeals')}</p>
              <Button variant="outline" onClick={() => navigate('/discover')}>
                <Plus className="w-4 h-4 mr-2" />
                Add meals
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {mealTypes.map((mealType) => {
                const meal = currentDayMeals.find(m => m.mealType === mealType);
                return (
                  <div
                    key={mealType}
                    className={cn(
                      'p-3 rounded-xl border',
                      `meal-${mealType} border`
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium capitalize">{t(`mealTypes.${mealType}`)}</span>
                      {!meal && (
                        <Button variant="ghost" size="sm">
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
