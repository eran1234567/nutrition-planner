import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calculator, Check, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUserData } from '@/hooks/useUserData';
import { MacroCalculator } from './MacroCalculator';
import { toast } from 'sonner';

interface NutritionGoalsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: () => void;
}

type MealOption = {
  id: string;
  label: string;
  type: 'breakfast' | 'snack' | 'lunch' | 'dinner';
};

const MEAL_OPTIONS: MealOption[] = [
  { id: 'breakfast', label: 'Breakfast', type: 'breakfast' },
  { id: 'snack-1', label: 'Snack', type: 'snack' },
  { id: 'lunch', label: 'Lunch', type: 'lunch' },
  { id: 'snack-2', label: 'Snack', type: 'snack' },
  { id: 'dinner', label: 'Dinner', type: 'dinner' },
  { id: 'snack-3', label: 'Snack', type: 'snack' },
];

const PLAN_DURATION_OPTIONS = [
  { value: 5, label: '5 Days' },
  { value: 7, label: '7 Days' },
];

export function NutritionGoalsModal({ open, onOpenChange, onSave }: NutritionGoalsModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { preferences, savePreferences, profile } = useUserData();
  const [isSaving, setIsSaving] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [step, setStep] = useState<'macros' | 'meals'>('macros');
  const [selectedMeals, setSelectedMeals] = useState<string[]>(['breakfast', 'lunch', 'dinner']);
  const [planDays, setPlanDays] = useState<number>(7);
  
  const [formData, setFormData] = useState({
    calorieTarget: '',
    proteinTarget: '',
    carbsTarget: '',
    fatTarget: '',
  });

  // Load existing preferences
  useEffect(() => {
    if (preferences) {
      setFormData({
        calorieTarget: preferences.calorie_target?.toString() || '',
        proteinTarget: preferences.protein_target?.toString() || '',
        carbsTarget: preferences.carbs_target?.toString() || '',
        fatTarget: preferences.fat_target?.toString() || '',
      });
      // Initialize selected meals based on meals_per_day if available
      const mealsPerDay = preferences.meals_per_day || 3;
      if (mealsPerDay <= 3) {
        setSelectedMeals(['breakfast', 'lunch', 'dinner'].slice(0, mealsPerDay));
      } else {
        // Add snacks for more meals
        const base = ['breakfast', 'lunch', 'dinner'];
        const snacks = ['snack-1', 'snack-2', 'snack-3'].slice(0, mealsPerDay - 3);
        setSelectedMeals([...base, ...snacks]);
      }
    }
  }, [preferences]);

  // Reset step when modal opens
  useEffect(() => {
    if (open) {
      setStep('macros');
    }
  }, [open]);

  const handleApplyCalculatedMacros = (macros: { calories: number; protein: number; carbs: number; fat: number }) => {
    setFormData(prev => ({
      ...prev,
      calorieTarget: macros.calories.toString(),
      proteinTarget: macros.protein.toString(),
      carbsTarget: macros.carbs.toString(),
      fatTarget: macros.fat.toString(),
    }));
  };

  const toggleMeal = (mealId: string) => {
    setSelectedMeals(prev => 
      prev.includes(mealId) 
        ? prev.filter(id => id !== mealId)
        : [...prev, mealId]
    );
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

    setIsSaving(true);
    try {
      await savePreferences({
        calorie_target: formData.calorieTarget ? parseInt(formData.calorieTarget) : null,
        protein_target: formData.proteinTarget ? parseInt(formData.proteinTarget) : null,
        carbs_target: formData.carbsTarget ? parseInt(formData.carbsTarget) : null,
        fat_target: formData.fatTarget ? parseInt(formData.fatTarget) : null,
        meals_per_day: selectedMeals.length,
        plan_duration: planDays,
      }, profile.id);
      
      toast.success(t('common.saved', 'Settings saved!'));
      onSave?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving nutrition goals:', error);
      toast.error(t('common.error', 'Failed to save'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === 'macros' 
              ? t('onboarding.macros.title', 'Nutrition Goals')
              : t('onboarding.meals.title', 'Daily Meals')
            }
          </DialogTitle>
        </DialogHeader>
        
        {step === 'macros' ? (
          <div className="space-y-6 pt-4">
            <div>
              <p className="text-sm text-muted-foreground">
                {t('onboarding.macros.hint', 'Optional: Set daily macro targets. Leave blank for balanced recommendations.')}
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
                  className="w-full h-12 px-3 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
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
            
            <Button 
              className="w-full" 
              onClick={() => setStep('meals')}
            >
              {t('common.next', 'Next')}
            </Button>
          </div>
        ) : (
          <div className="space-y-6 pt-4">
            <div>
              <p className="text-sm font-medium text-foreground mb-2">
                {t('onboarding.meals.planDuration', 'Plan Duration')}
              </p>
              <div className="flex gap-3">
                {PLAN_DURATION_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPlanDays(option.value)}
                    className={`flex-1 p-3 rounded-xl border-2 transition-all ${
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
              <p className="text-sm font-medium text-foreground mb-2">
                {t('onboarding.meals.title', 'Meals Per Day')}
              </p>
              <p className="text-sm text-muted-foreground mb-3">
                {t('onboarding.meals.hint', 'Select which meals you want to plan for each day.')}
              </p>
              <div className="space-y-2">
                {MEAL_OPTIONS.map((meal) => (
                  <button
                    key={meal.id}
                    type="button"
                    onClick={() => toggleMeal(meal.id)}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                      selectedMeals.includes(meal.id)
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-card hover:border-muted-foreground/50'
                    }`}
                  >
                    <span className="font-medium text-foreground">{meal.label}</span>
                    {selectedMeals.includes(meal.id) && (
                      <Check className="w-5 h-5 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex gap-3">
              <Button 
                variant="outline"
                className="flex-1"
                onClick={() => setStep('macros')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t('common.back', 'Back')}
              </Button>
              <Button 
                className="flex-1" 
                onClick={handleSave} 
                disabled={isSaving || selectedMeals.length === 0}
              >
                {isSaving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
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