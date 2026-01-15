import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calculator } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUserData } from '@/hooks/useUserData';
import { MacroCalculator } from './MacroCalculator';
import { toast } from 'sonner';

interface NutritionGoalsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NutritionGoalsModal({ open, onOpenChange }: NutritionGoalsModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { preferences, savePreferences, profile } = useUserData();
  const [isSaving, setIsSaving] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  
  const [formData, setFormData] = useState({
    calorieTarget: '',
    proteinTarget: '',
    carbsTarget: '',
    fatTarget: '',
    mealsPerDay: 3,
  });

  // Load existing preferences
  useEffect(() => {
    if (preferences) {
      setFormData({
        calorieTarget: preferences.calorie_target?.toString() || '',
        proteinTarget: preferences.protein_target?.toString() || '',
        carbsTarget: preferences.carbs_target?.toString() || '',
        fatTarget: preferences.fat_target?.toString() || '',
        mealsPerDay: preferences.meals_per_day || 3,
      });
    }
  }, [preferences]);

  const handleApplyCalculatedMacros = (macros: { calories: number; protein: number; carbs: number; fat: number }) => {
    setFormData(prev => ({
      ...prev,
      calorieTarget: macros.calories.toString(),
      proteinTarget: macros.protein.toString(),
      carbsTarget: macros.carbs.toString(),
      fatTarget: macros.fat.toString(),
    }));
  };

  const handleSave = async () => {
    if (!user || !profile) {
      toast.error('Please sign in to save preferences');
      return;
    }

    setIsSaving(true);
    try {
      await savePreferences({
        calorie_target: formData.calorieTarget ? parseInt(formData.calorieTarget) : null,
        protein_target: formData.proteinTarget ? parseInt(formData.proteinTarget) : null,
        carbs_target: formData.carbsTarget ? parseInt(formData.carbsTarget) : null,
        fat_target: formData.fatTarget ? parseInt(formData.fatTarget) : null,
        meals_per_day: formData.mealsPerDay,
      }, profile.id);
      
      toast.success(t('common.saved', 'Settings saved!'));
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
          <DialogTitle>{t('onboarding.macros.title', 'Nutrition Goals')}</DialogTitle>
        </DialogHeader>
        
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
          
          <div>
            <label className="text-sm font-medium text-foreground mb-3 block">
              {t('onboarding.macros.mealsPerDay', 'Meals per Day')}
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5, 6].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, mealsPerDay: num }))}
                  className={`flex-1 h-12 rounded-xl border-2 font-semibold transition-all ${
                    formData.mealsPerDay === num
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
          
          <Button 
            className="w-full" 
            onClick={handleSave} 
            disabled={isSaving}
          >
            {isSaving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
          </Button>
        </div>
      </DialogContent>

      <MacroCalculator
        open={showCalculator}
        onOpenChange={setShowCalculator}
        onApply={handleApplyCalculatedMacros}
      />
    </Dialog>
  );
}
