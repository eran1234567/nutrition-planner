import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Calculator, Check, ArrowLeft, AlertTriangle, ArrowRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUserData } from '@/hooks/useUserData';
import { useMealPlanStore } from '@/stores/mealPlanStore';
import { MacroCalculator } from './MacroCalculator';
import { toast } from 'sonner';
import type { MealSlot, MealSlotId, DailyTargets } from '@/types/mealPlan';
import { MEAL_SLOT_DEFINITIONS, getDefaultPercentsForSlots } from '@/types/mealPlan';
import { useNavigate } from 'react-router-dom';

interface NutritionGoalsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: () => void;
}

type MealOption = {
  id: MealSlotId;
  label: string;
  type: 'breakfast' | 'snack' | 'lunch' | 'dinner';
};

const MEAL_OPTIONS: MealOption[] = [
  { id: 'breakfast', label: 'Breakfast', type: 'breakfast' },
  { id: 'snack-1', label: 'Morning Snack', type: 'snack' },
  { id: 'lunch', label: 'Lunch', type: 'lunch' },
  { id: 'snack-2', label: 'Afternoon Snack', type: 'snack' },
  { id: 'dinner', label: 'Dinner', type: 'dinner' },
  { id: 'snack-3', label: 'Evening Snack', type: 'snack' },
];

const PLAN_DURATION_OPTIONS = [
  { value: 5, label: '5 Days' },
  { value: 7, label: '7 Days' },
];

type Step = 'macros' | 'meals' | 'distribution';

export function NutritionGoalsModal({ open, onOpenChange, onSave }: NutritionGoalsModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { preferences, savePreferences, profile } = useUserData();
  const { 
    setDailyTargets, 
    setSelectedMealSlots, 
    setNumberOfDays,
    setIsPlanMode,
    selectedMealSlots: storedSlots,
    numberOfDays: storedDays,
    dailyTargets: storedTargets,
  } = useMealPlanStore();
  
  const [isSaving, setIsSaving] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [step, setStep] = useState<Step>('macros');
  const [selectedMeals, setSelectedMeals] = useState<MealSlotId[]>(['breakfast', 'lunch', 'dinner']);
  const [planDays, setPlanDays] = useState<number>(7);
  const [slotPercents, setSlotPercents] = useState<Record<MealSlotId, number>>({} as Record<MealSlotId, number>);
  
  const [formData, setFormData] = useState({
    calorieTarget: '',
    proteinTarget: '',
    carbsTarget: '',
    fatTarget: '',
  });

  // Load existing preferences and stored plan state
  useEffect(() => {
    if (preferences) {
      setFormData({
        calorieTarget: preferences.calorie_target?.toString() || '',
        proteinTarget: preferences.protein_target?.toString() || '',
        carbsTarget: preferences.carbs_target?.toString() || '',
        fatTarget: preferences.fat_target?.toString() || '',
      });
    } else if (storedTargets) {
      setFormData({
        calorieTarget: storedTargets.calories?.toString() || '',
        proteinTarget: storedTargets.protein?.toString() || '',
        carbsTarget: storedTargets.carbs?.toString() || '',
        fatTarget: storedTargets.fat?.toString() || '',
      });
    }
    
    // Load stored slots
    if (storedSlots.length > 0) {
      setSelectedMeals(storedSlots.map(s => s.id));
      const percents: Record<MealSlotId, number> = {} as Record<MealSlotId, number>;
      storedSlots.forEach(s => {
        percents[s.id] = s.percentOfDay;
      });
      setSlotPercents(percents);
    } else if (preferences?.meals_per_day) {
      // Initialize from preferences meals_per_day
      const mealsPerDay = preferences.meals_per_day;
      if (mealsPerDay <= 3) {
        setSelectedMeals(['breakfast', 'lunch', 'dinner'].slice(0, mealsPerDay) as MealSlotId[]);
      } else {
        const base: MealSlotId[] = ['breakfast', 'lunch', 'dinner'];
        const snacks: MealSlotId[] = ['snack-1', 'snack-2', 'snack-3'].slice(0, mealsPerDay - 3) as MealSlotId[];
        setSelectedMeals([...base, ...snacks]);
      }
    }
    
    // Load plan duration
    if (storedDays) {
      setPlanDays(storedDays);
    } else if (preferences?.plan_duration) {
      setPlanDays(preferences.plan_duration);
    }
  }, [preferences, storedSlots, storedDays, storedTargets]);

  // Reset step when modal opens
  useEffect(() => {
    if (open) {
      setStep('macros');
    }
  }, [open]);

  // Update default percents when selected meals change - always redistribute to 100%
  useEffect(() => {
    // Check if current percents match selected meals and sum to 100
    const currentTotal = selectedMeals.reduce((sum, id) => sum + (slotPercents[id] || 0), 0);
    const allMealsHavePercents = selectedMeals.every(id => id in slotPercents && slotPercents[id] !== undefined);
    const correctMealCount = Object.keys(slotPercents).filter(id => selectedMeals.includes(id as MealSlotId)).length === selectedMeals.length;
    
    // If percents don't sum to 100 or meals changed, redistribute evenly
    if (!allMealsHavePercents || !correctMealCount || currentTotal !== 100) {
      const defaults = getDefaultPercentsForSlots(selectedMeals);
      setSlotPercents(defaults);
    }
  }, [selectedMeals]);

  const handleApplyCalculatedMacros = (macros: { calories: number; protein: number; carbs: number; fat: number }) => {
    setFormData(prev => ({
      ...prev,
      calorieTarget: macros.calories.toString(),
      proteinTarget: macros.protein.toString(),
      carbsTarget: macros.carbs.toString(),
      fatTarget: macros.fat.toString(),
    }));
  };

  const toggleMeal = (mealId: MealSlotId) => {
    setSelectedMeals(prev => 
      prev.includes(mealId) 
        ? prev.filter(id => id !== mealId)
        : [...prev, mealId]
    );
  };

  const totalPercent = useMemo(() => {
    return selectedMeals.reduce((sum, id) => sum + (slotPercents[id] || 0), 0);
  }, [selectedMeals, slotPercents]);

  const isValidPercents = totalPercent === 100;

  const handlePercentChange = (slotId: MealSlotId, value: number) => {
    setSlotPercents(prev => ({
      ...prev,
      [slotId]: value,
    }));
  };

  const autoBalancePercents = () => {
    if (selectedMeals.length === 0) return;
    const defaults = getDefaultPercentsForSlots(selectedMeals);
    setSlotPercents(defaults);
  };

  const handleSave = async () => {
    if (!user || !profile) {
      toast.error('Please sign in to save preferences');
      return;
    }

    if (selectedMeals.length === 0) {
      toast.error('Please select at least one meal');
      return;
    }

    if (!isValidPercents) {
      toast.error('Percentages must total 100%');
      return;
    }

    setIsSaving(true);
    try {
      // Build meal slots with percents
      const mealSlots: MealSlot[] = selectedMeals
        .sort((a, b) => {
          const order: MealSlotId[] = ['breakfast', 'snack-1', 'lunch', 'snack-2', 'dinner', 'snack-3'];
          return order.indexOf(a) - order.indexOf(b);
        })
        .map(id => ({
          id,
          label: MEAL_SLOT_DEFINITIONS[id].label,
          percentOfDay: slotPercents[id] || 0,
          type: MEAL_SLOT_DEFINITIONS[id].type,
        }));

      // Build daily targets
      const dailyTargets: DailyTargets = {
        calories: parseInt(formData.calorieTarget) || 0,
        protein: parseInt(formData.proteinTarget) || 0,
        carbs: parseInt(formData.carbsTarget) || 0,
        fat: parseInt(formData.fatTarget) || 0,
      };

      // Save to meal plan store
      setDailyTargets(dailyTargets);
      setSelectedMealSlots(mealSlots);
      setNumberOfDays(planDays);
      setIsPlanMode(true);

      // Also save to DB preferences
      await savePreferences({
        calorie_target: dailyTargets.calories || null,
        protein_target: dailyTargets.protein || null,
        carbs_target: dailyTargets.carbs || null,
        fat_target: dailyTargets.fat || null,
        meals_per_day: selectedMeals.length,
        plan_duration: planDays,
      }, profile.id);
      
      toast.success(t('common.saved', 'Settings saved!'));
      onSave?.();
      onOpenChange(false);
      
      // Navigate to Discover to select recipes
      navigate('/discover');
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error saving nutrition goals:', error);
      toast.error(t('common.error', 'Failed to save'));
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate calories from macros for validation
  const protein = parseInt(formData.proteinTarget) || 0;
  const carbs = parseInt(formData.carbsTarget) || 0;
  const fat = parseInt(formData.fatTarget) || 0;
  const calories = parseInt(formData.calorieTarget) || 0;
  
  const calculatedCalories = (protein * 4) + (carbs * 4) + (fat * 9);
  const hasMacros = protein > 0 || carbs > 0 || fat > 0;
  const hasCalories = calories > 0;
  const hasMismatch = hasMacros && hasCalories && Math.abs(calculatedCalories - calories) > 50;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg h-[720px] max-h-[92vh] overflow-hidden flex flex-col fixed-dialog-content">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>
            {step === 'macros' 
              ? t('onboarding.macros.title', 'Nutrition Goals')
              : step === 'meals'
              ? t('onboarding.meals.title', 'Select Meals')
              : t('plan.distribution', 'Macro Distribution')
            }
          </DialogTitle>
        </DialogHeader>
        
        {step === 'macros' && (
          <div className="flex-1 overflow-y-auto space-y-6 pt-4 min-h-0">
            <div>
              <p className="text-sm text-muted-foreground">
                {t('onboarding.macros.hint', 'Set your daily calorie and macro targets.')}
              </p>
              <button
                type="button"
                onClick={() => setShowCalculator(true)}
                className="mt-2 text-sm text-primary hover:underline flex items-center gap-1"
              >
                <Calculator className="w-4 h-4" />
                {t('macroCalculator.dontKnow', "Not sure? Calculate your macros")}
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  {t('onboarding.macros.calories', 'Daily Calories')}
                </label>
                <input
                  type="number"
                  value={formData.calorieTarget}
                  onChange={(e) => setFormData(prev => ({ ...prev, calorieTarget: e.target.value }))}
                  placeholder="e.g. 2000"
                  className={`w-full h-12 px-3 rounded-xl border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary ${
                    hasMismatch ? 'border-amber-500' : 'border-border'
                  }`}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  {t('onboarding.macros.protein', 'Protein')} (g)
                </label>
                <input
                  type="number"
                  value={formData.proteinTarget}
                  onChange={(e) => setFormData(prev => ({ ...prev, proteinTarget: e.target.value }))}
                  placeholder="e.g. 120"
                  className="w-full h-12 px-3 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  {t('onboarding.macros.carbs', 'Carbs')} (g)
                </label>
                <input
                  type="number"
                  value={formData.carbsTarget}
                  onChange={(e) => setFormData(prev => ({ ...prev, carbsTarget: e.target.value }))}
                  placeholder="e.g. 250"
                  className="w-full h-12 px-3 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  {t('onboarding.macros.fat', 'Fat')} (g)
                </label>
                <input
                  type="number"
                  value={formData.fatTarget}
                  onChange={(e) => setFormData(prev => ({ ...prev, fatTarget: e.target.value }))}
                  placeholder="e.g. 65"
                  className="w-full h-12 px-3 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Calorie validation message */}
            {hasMacros && (
              <div className={`p-3 rounded-xl text-sm ${
                hasMismatch 
                  ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800' 
                  : 'bg-muted'
              }`}>
                <div className="flex items-start gap-2">
                  {hasMismatch && <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />}
                  <div>
                    <p className={hasMismatch ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}>
                      Macros total: <span className="font-semibold">{calculatedCalories.toLocaleString()} cal</span>
                      <span className="text-xs ml-1">
                        ({protein}g × 4 + {carbs}g × 4 + {fat}g × 9)
                      </span>
                    </p>
                    {hasMismatch && (
                      <p className="text-amber-600 dark:text-amber-500 text-xs mt-1">
                        {calculatedCalories > calories 
                          ? `Macros exceed entered calories by ${(calculatedCalories - calories).toLocaleString()} cal`
                          : `Macros are ${(calories - calculatedCalories).toLocaleString()} cal less than entered calories`
                        }
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            <Button 
              className="w-full" 
              onClick={() => setStep('meals')}
              disabled={hasMismatch}
            >
              {t('common.next', 'Next')}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {step === 'meals' && (
          <div className="flex-1 overflow-y-auto space-y-3 pt-2 min-h-0">
            <div>
              <p className="text-sm font-medium text-foreground mb-1.5">
                {t('onboarding.meals.planDuration', 'Plan Duration')}
              </p>
              <div className="flex gap-2">
                {PLAN_DURATION_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPlanDays(option.value)}
                    className={`flex-1 py-2 px-3 rounded-lg border-2 transition-all text-sm ${
                      planDays === option.value
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-card hover:border-muted-foreground/50'
                    }`}
                  >
                    <span className="font-medium text-foreground">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-foreground mb-1">
                {t('onboarding.meals.title', 'Meals Per Day')}
              </p>
              <p className="text-xs text-muted-foreground mb-2">
                {t('onboarding.meals.hint', 'Select which meals you want to plan for each day.')}
              </p>
              <div className="space-y-1.5">
                {MEAL_OPTIONS.map((meal) => (
                  <button
                    key={meal.id}
                    type="button"
                    onClick={() => toggleMeal(meal.id)}
                    className={`w-full flex items-center justify-between py-2.5 px-3 rounded-lg border-2 transition-all ${
                      selectedMeals.includes(meal.id)
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-card hover:border-muted-foreground/50'
                    }`}
                  >
                    <span className="text-sm font-medium text-foreground">{meal.label}</span>
                    {selectedMeals.includes(meal.id) && (
                      <Check className="w-4 h-4 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex gap-2 pt-1">
              <Button 
                variant="outline"
                className="flex-1 h-9"
                onClick={() => setStep('macros')}
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                {t('common.back', 'Back')}
              </Button>
              <Button 
                className="flex-1 h-9" 
                onClick={() => setStep('distribution')}
                disabled={selectedMeals.length === 0}
              >
                {t('common.next', 'Next')}
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {step === 'distribution' && (
          <div className="flex-1 overflow-y-auto space-y-6 pt-4 min-h-0">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-foreground">
                  {t('plan.calorieDistribution', 'Calorie Distribution')}
                </p>
                <button
                  type="button"
                  onClick={autoBalancePercents}
                  className="text-xs text-primary hover:underline"
                >
                  Auto-balance
                </button>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Set what percentage of daily calories each meal should have.
              </p>

              <div className="space-y-4">
                {selectedMeals
                  .sort((a, b) => {
                    const order: MealSlotId[] = ['breakfast', 'snack-1', 'lunch', 'snack-2', 'dinner', 'snack-3'];
                    return order.indexOf(a) - order.indexOf(b);
                  })
                  .map((slotId) => {
                    const meal = MEAL_OPTIONS.find(m => m.id === slotId);
                    const percent = slotPercents[slotId] || 0;
                    const slotCalories = hasCalories ? Math.round(calories * percent / 100) : 0;

                    return (
                      <div key={slotId} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{meal?.label}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-primary">{percent}%</span>
                            {hasCalories && (
                              <span className="text-xs text-muted-foreground">
                                ({slotCalories} cal)
                              </span>
                            )}
                          </div>
                        </div>
                        <Slider
                          value={[percent]}
                          onValueChange={([value]) => handlePercentChange(slotId, value)}
                          min={0}
                          max={100}
                          step={5}
                          className="w-full"
                        />
                      </div>
                    );
                  })}
              </div>

              {/* Total indicator */}
              <div className={`mt-4 p-3 rounded-xl text-sm ${
                isValidPercents 
                  ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800' 
                  : 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800'
              }`}>
                <div className="flex items-center justify-between">
                  <span className={isValidPercents ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}>
                    Total:
                  </span>
                  <span className={`font-semibold ${isValidPercents ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>
                    {totalPercent}%
                  </span>
                </div>
                {!isValidPercents && (
                  <p className="text-amber-600 dark:text-amber-500 text-xs mt-1">
                    {totalPercent < 100 
                      ? `Add ${100 - totalPercent}% more to reach 100%`
                      : `Remove ${totalPercent - 100}% to reach 100%`
                    }
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex gap-3">
              <Button 
                variant="outline"
                className="flex-1"
                onClick={() => setStep('meals')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t('common.back', 'Back')}
              </Button>
              <Button 
                className="flex-1" 
                onClick={handleSave} 
                disabled={isSaving || !isValidPercents}
              >
                {isSaving ? t('common.saving', 'Saving...') : t('plan.selectRecipes', 'Select Recipes')}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>

      <MacroCalculator
        open={showCalculator}
        onOpenChange={setShowCalculator}
        onApply={handleApplyCalculatedMacros}
      />
    </Dialog>
  );
}
