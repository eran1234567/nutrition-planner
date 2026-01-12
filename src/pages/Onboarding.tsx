import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ChevronLeft, ChevronRight, Check, Globe, Ruler, User, Utensils, Target, Heart, ChefHat, Plus } from 'lucide-react';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/input';
import i18n from '@/lib/i18n';
import { useAuth } from '@/hooks/useAuth';
import { useUserData } from '@/hooks/useUserData';
import { toast } from 'sonner';

const STEPS = [
  { id: 'locale', icon: Globe, titleKey: 'onboarding.settings.title' },
  { id: 'profile', icon: User, titleKey: 'onboarding.profile.title' },
  { id: 'diet', icon: Utensils, titleKey: 'onboarding.diet.title' },
  { id: 'goals', icon: Target, titleKey: 'onboarding.macros.title' },
  { id: 'medical', icon: Heart, titleKey: 'onboarding.medical.title' },
  { id: 'cuisine', icon: ChefHat, titleKey: 'onboarding.cuisine.title' },
];

const Onboarding = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const { profile, preferences, saveProfile, savePreferences, loading } = useUserData();
  
  // Get edit mode and step from navigation state
  const editMode = location.state?.editMode || false;
  const startStep = location.state?.startStep ?? 0;
  
  const [currentStep, setCurrentStep] = useState(startStep);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState(() => ({
    units: 'imperial' as 'imperial' | 'metric',
    language: i18n.language || 'en',
    displayName: '',
    age: '',
    dietType: 'none',
    allergies: [] as string[],
    dislikes: [] as string[],
    calorieTarget: '',
    proteinTarget: '',
    carbsTarget: '',
    fatTarget: '',
    mealsPerDay: 3,
    medicalDisclaimer: false,
    diabetesFriendly: false,
    kidneyFriendly: false,
    heartHealthy: false,
    lowSodium: false,
    cuisines: [] as string[],
    budgetLevel: 'medium',
    maxCookTime: 45,
  }));

  // Load existing data when available
  useEffect(() => {
    if (profile || preferences) {
      setFormData(prev => ({
        ...prev,
        units: profile?.units || 'imperial',
        language: profile?.locale?.split('-')[0] || i18n.language || 'en',
        displayName: profile?.display_name || '',
        age: profile?.age?.toString() || '',
        dietType: preferences?.diet_type || 'none',
        allergies: preferences?.allergies || [],
        dislikes: preferences?.dislikes || [],
        calorieTarget: preferences?.calorie_target?.toString() || '',
        proteinTarget: preferences?.protein_target?.toString() || '',
        carbsTarget: preferences?.carbs_target?.toString() || '',
        fatTarget: preferences?.fat_target?.toString() || '',
        mealsPerDay: preferences?.meals_per_day || 3,
        medicalDisclaimer: preferences?.medical_disclaimer_accepted || false,
        diabetesFriendly: preferences?.medical_diabetes_friendly || false,
        kidneyFriendly: preferences?.medical_kidney_friendly || false,
        heartHealthy: preferences?.medical_heart_healthy || false,
        lowSodium: preferences?.medical_low_sodium || false,
        cuisines: preferences?.cuisines_preferred || [],
        budgetLevel: preferences?.budget_level || 'medium',
        maxCookTime: preferences?.max_cook_time || 45,
      }));
    }
  }, [profile, preferences]);

  // Custom input state
  const [customAllergy, setCustomAllergy] = useState('');
  const [customDislike, setCustomDislike] = useState('');

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const handleSave = async () => {
    if (!isAuthenticated) {
      // Navigate to discover without saving if not authenticated
      navigate('/discover');
      return;
    }

    setIsSaving(true);
    try {
      // Save profile data
      await saveProfile({
        display_name: formData.displayName || null,
        age: formData.age ? parseInt(formData.age) : null,
        units: formData.units,
        locale: formData.language,
        onboarding_completed: true,
      });

      // Save preferences
      await savePreferences({
        diet_type: formData.dietType as any,
        allergies: formData.allergies,
        dislikes: formData.dislikes,
        calorie_target: formData.calorieTarget ? parseInt(formData.calorieTarget) : null,
        protein_target: formData.proteinTarget ? parseInt(formData.proteinTarget) : null,
        carbs_target: formData.carbsTarget ? parseInt(formData.carbsTarget) : null,
        fat_target: formData.fatTarget ? parseInt(formData.fatTarget) : null,
        meals_per_day: formData.mealsPerDay,
        medical_disclaimer_accepted: formData.medicalDisclaimer,
        medical_diabetes_friendly: formData.diabetesFriendly,
        medical_kidney_friendly: formData.kidneyFriendly,
        medical_heart_healthy: formData.heartHealthy,
        medical_low_sodium: formData.lowSodium,
        cuisines_preferred: formData.cuisines,
        budget_level: formData.budgetLevel,
        max_cook_time: formData.maxCookTime,
      });

      toast.success(t('common.saved', 'Settings saved!'));
    } catch (error) {
      console.error('Error saving:', error);
      toast.error(t('common.error', 'Failed to save'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleNext = async () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Complete onboarding
      await handleSave();
      if (editMode) {
        navigate('/settings');
      } else {
        navigate('/discover');
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else if (editMode) {
      navigate('/settings');
    }
  };

  const toggleArrayItem = (key: 'allergies' | 'dislikes' | 'cuisines', item: string) => {
    setFormData(prev => ({
      ...prev,
      [key]: prev[key].includes(item)
        ? prev[key].filter(i => i !== item)
        : [...prev[key], item]
    }));
  };

  const addCustomItem = (key: 'allergies' | 'dislikes', value: string, setValue: (v: string) => void) => {
    const trimmed = value.trim();
    if (trimmed && !formData[key].includes(trimmed)) {
      setFormData(prev => ({
        ...prev,
        [key]: [...prev[key], trimmed]
      }));
    }
    setValue('');
  };

  const removeCustomItem = (key: 'allergies' | 'dislikes', item: string) => {
    setFormData(prev => ({
      ...prev,
      [key]: prev[key].filter(i => i !== item)
    }));
  };

  const renderStep = () => {
    switch (STEPS[currentStep].id) {
      case 'locale':
        return (
          <div className="space-y-6">
            <div>
              <label className="text-sm font-medium text-foreground mb-3 block">{t('onboarding.settings.units', 'Units')}</label>
              <div className="grid grid-cols-2 gap-3">
                {(['imperial', 'metric'] as const).map(unit => (
                  <button
                    key={unit}
                    onClick={() => setFormData(prev => ({ ...prev, units: unit }))}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      formData.units === unit
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-card'
                    }`}
                  >
                    <Ruler className={`w-6 h-6 mx-auto mb-2 ${formData.units === unit ? 'text-primary' : 'text-muted-foreground'}`} />
                    <p className="font-medium capitalize">{unit}</p>
                    <p className="text-xs text-muted-foreground">
                      {unit === 'imperial' ? 'oz, cups, °F' : 'g, ml, °C'}
                    </p>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-3 block">{t('onboarding.settings.language', 'Language')}</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { code: 'en', label: 'English', flag: '🇺🇸' },
                  { code: 'es', label: 'Español', flag: '🇪🇸' },
                  { code: 'he', label: 'עברית', flag: '🇮🇱' },
                  { code: 'pt', label: 'Português', flag: '🇧🇷' },
                ].map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      setFormData(prev => ({ ...prev, language: lang.code }));
                      window.localStorage.setItem('i18nextLng', lang.code);
                      i18n.changeLanguage(lang.code);
                    }}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      formData.language === lang.code
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-card'
                    }`}
                  >
                    <span className="text-2xl mb-2 block">{lang.flag}</span>
                    <p className="font-medium">{lang.label}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 'profile':
        return (
          <div className="space-y-6">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">{t('onboarding.profile.name', 'Your Name')}</label>
              <input
                type="text"
                value={formData.displayName}
                onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                placeholder={t('onboarding.profile.namePlaceholder', 'Enter your name')}
                className="w-full h-14 px-4 rounded-xl border border-border bg-card text-foreground text-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">{t('onboarding.profile.age', 'Age')} ({t('common.optional', 'optional')})</label>
              <input
                type="number"
                value={formData.age}
                onChange={(e) => setFormData(prev => ({ ...prev, age: e.target.value }))}
                placeholder={t('onboarding.profile.agePlaceholder', 'Your age')}
                className="w-full h-14 px-4 rounded-xl border border-border bg-card text-foreground text-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        );

      case 'diet':
        return (
          <div className="space-y-6">
            <div>
              <label className="text-sm font-medium text-foreground mb-3 block">{t('onboarding.diet.dietType', 'Diet Type')}</label>
              <div className="grid grid-cols-2 gap-2">
                {['none', 'vegetarian', 'vegan', 'pescatarian', 'keto', 'paleo', 'mediterranean'].map(diet => (
                  <button
                    key={diet}
                    onClick={() => setFormData(prev => ({ ...prev, dietType: diet }))}
                    className={`p-3 rounded-xl border-2 transition-all capitalize ${
                      formData.dietType === diet
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-card'
                    }`}
                  >
                    {diet === 'none' ? t('onboarding.diet.noRestrictions', 'No restrictions') : t(`diet.${diet}`, diet)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-3 block">{t('onboarding.diet.allergies', 'Allergies')}</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {['Dairy', 'Eggs', 'Gluten', 'Nuts', 'Peanuts', 'Shellfish', 'Soy', 'Fish', 'Beef', 'Chicken', 'Veal', 'Pork', 'Seafood'].map(allergy => (
                  <Chip
                    key={allergy}
                    selected={formData.allergies.includes(allergy)}
                    onClick={() => toggleArrayItem('allergies', allergy)}
                  >
                    {t(`allergies.${allergy.toLowerCase()}`, allergy)}
                  </Chip>
                ))}
                {formData.allergies
                  .filter(a => !['Dairy', 'Eggs', 'Gluten', 'Nuts', 'Peanuts', 'Shellfish', 'Soy', 'Fish', 'Beef', 'Chicken', 'Veal', 'Pork', 'Seafood'].includes(a))
                  .map(custom => (
                    <Chip
                      key={custom}
                      selected
                      onRemove={() => removeCustomItem('allergies', custom)}
                    >
                      {custom}
                    </Chip>
                  ))}
              </div>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={customAllergy}
                  onChange={(e) => setCustomAllergy(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomItem('allergies', customAllergy, setCustomAllergy);
                    }
                  }}
                  placeholder={t('onboarding.diet.addCustomAllergy', 'Add custom allergy...')}
                  className="flex-1 h-11"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-11"
                  onClick={() => addCustomItem('allergies', customAllergy, setCustomAllergy)}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-3 block">{t('onboarding.diet.dislikes', 'Dislikes')}</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {['Spicy', 'Cilantro', 'Mushrooms', 'Onions', 'Olives', 'Tomatoes', 'Beef', 'Chicken', 'Veal', 'Pork', 'Seafood', 'Eggs', 'Dairy'].map(dislike => (
                  <Chip
                    key={dislike}
                    selected={formData.dislikes.includes(dislike)}
                    onClick={() => toggleArrayItem('dislikes', dislike)}
                  >
                    {t(`dislikes.${dislike.toLowerCase()}`, dislike)}
                  </Chip>
                ))}
                {formData.dislikes
                  .filter(d => !['Spicy', 'Cilantro', 'Mushrooms', 'Onions', 'Olives', 'Tomatoes', 'Beef', 'Chicken', 'Veal', 'Pork', 'Seafood', 'Eggs', 'Dairy'].includes(d))
                  .map(custom => (
                    <Chip
                      key={custom}
                      selected
                      onRemove={() => removeCustomItem('dislikes', custom)}
                    >
                      {custom}
                    </Chip>
                  ))}
              </div>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={customDislike}
                  onChange={(e) => setCustomDislike(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomItem('dislikes', customDislike, setCustomDislike);
                    }
                  }}
                  placeholder={t('onboarding.diet.addCustomDislike', 'Add custom dislike...')}
                  className="flex-1 h-11"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-11"
                  onClick={() => addCustomItem('dislikes', customDislike, setCustomDislike)}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        );

      case 'goals':
        return (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              {t('onboarding.macros.hint', 'Optional: Set daily macro targets. Leave blank for balanced recommendations.')}
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">{t('onboarding.macros.calories', 'Calories')}</label>
                <input
                  type="number"
                  value={formData.calorieTarget}
                  onChange={(e) => setFormData(prev => ({ ...prev, calorieTarget: e.target.value }))}
                  placeholder="e.g. 2000"
                  className="w-full h-12 px-3 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">{t('onboarding.macros.protein', 'Protein')} (g)</label>
                <input
                  type="number"
                  value={formData.proteinTarget}
                  onChange={(e) => setFormData(prev => ({ ...prev, proteinTarget: e.target.value }))}
                  placeholder="e.g. 120"
                  className="w-full h-12 px-3 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">{t('onboarding.macros.carbs', 'Carbs')} (g)</label>
                <input
                  type="number"
                  value={formData.carbsTarget}
                  onChange={(e) => setFormData(prev => ({ ...prev, carbsTarget: e.target.value }))}
                  placeholder="e.g. 250"
                  className="w-full h-12 px-3 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">{t('onboarding.macros.fat', 'Fat')} (g)</label>
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
              <label className="text-sm font-medium text-foreground mb-3 block">{t('onboarding.macros.mealsPerDay', 'Meals per Day')}</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5, 6].map(num => (
                  <button
                    key={num}
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
          </div>
        );

      case 'medical':
        return (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-warning/10 border border-warning/20">
              <p className="text-sm text-warning-foreground">
                ⚠️ {t('onboarding.medical.disclaimer', 'This is general nutrition planning, not medical advice. Always consult your healthcare provider.')}
              </p>
            </div>
            <div>
              <label className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card">
                <input
                  type="checkbox"
                  checked={formData.medicalDisclaimer}
                  onChange={(e) => setFormData(prev => ({ ...prev, medicalDisclaimer: e.target.checked }))}
                  className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-sm">{t('onboarding.medical.understand', 'I understand this is not medical advice')}</span>
              </label>
            </div>
            {formData.medicalDisclaimer && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-3"
              >
                <p className="text-sm font-medium text-foreground">{t('onboarding.medical.options', 'Health-conscious options')}:</p>
                {[
                  { key: 'diabetesFriendly', labelKey: 'onboarding.medical.diabetes', descKey: 'onboarding.medical.diabetesDesc' },
                  { key: 'kidneyFriendly', labelKey: 'onboarding.medical.kidney', descKey: 'onboarding.medical.kidneyDesc' },
                  { key: 'heartHealthy', labelKey: 'onboarding.medical.heart', descKey: 'onboarding.medical.heartDesc' },
                  { key: 'lowSodium', labelKey: 'onboarding.medical.sodium', descKey: 'onboarding.medical.sodiumDesc' },
                ].map(option => (
                  <label
                    key={option.key}
                    className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card"
                  >
                    <input
                      type="checkbox"
                      checked={formData[option.key as keyof typeof formData] as boolean}
                      onChange={(e) => setFormData(prev => ({ ...prev, [option.key]: e.target.checked }))}
                      className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
                    />
                    <div>
                      <p className="font-medium">{t(option.labelKey, option.key)}</p>
                      <p className="text-xs text-muted-foreground">{t(option.descKey, '')}</p>
                    </div>
                  </label>
                ))}
              </motion.div>
            )}
          </div>
        );

      case 'cuisine':
        return (
          <div className="space-y-6">
            <div>
              <label className="text-sm font-medium text-foreground mb-3 block">{t('onboarding.cuisine.preferred', 'Preferred Cuisines')}</label>
              <div className="flex flex-wrap gap-2">
                {['American', 'Italian', 'Mexican', 'Asian', 'Mediterranean', 'Indian', 'Japanese', 'Thai', 'French', 'Greek'].map(cuisine => (
                  <Chip
                    key={cuisine}
                    selected={formData.cuisines.includes(cuisine)}
                    onClick={() => toggleArrayItem('cuisines', cuisine)}
                  >
                    {t(`cuisines.${cuisine.toLowerCase()}`, cuisine)}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-3 block">{t('onboarding.cuisine.budget', 'Budget Level')}</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'budget', labelKey: 'onboarding.cuisine.budgetLow', icon: '$' },
                  { value: 'medium', labelKey: 'onboarding.cuisine.budgetMedium', icon: '$$' },
                  { value: 'premium', labelKey: 'onboarding.cuisine.budgetHigh', icon: '$$$' },
                ].map(budget => (
                  <button
                    key={budget.value}
                    onClick={() => setFormData(prev => ({ ...prev, budgetLevel: budget.value }))}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      formData.budgetLevel === budget.value
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-card'
                    }`}
                  >
                    <span className="text-lg font-bold block">{budget.icon}</span>
                    <span className="text-sm">{t(budget.labelKey, budget.value)}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-3 block">
                {t('onboarding.cuisine.maxCookTime', 'Max Cook Time')}: {formData.maxCookTime} {t('common.min', 'min')}
              </label>
              <input
                type="range"
                min={15}
                max={120}
                step={15}
                value={formData.maxCookTime}
                onChange={(e) => setFormData(prev => ({ ...prev, maxCookTime: parseInt(e.target.value) }))}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>15 {t('common.min', 'min')}</span>
                <span>2 {t('common.hours', 'hours')}</span>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (loading && isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={handleBack}
              disabled={currentStep === 0 && !editMode}
              className="p-2 -ml-2 text-muted-foreground disabled:opacity-30"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <span className="text-sm text-muted-foreground">
              {editMode ? t('settings.editing', 'Editing') : t('onboarding.step', {
                current: currentStep + 1,
                total: STEPS.length,
                defaultValue: `Step ${currentStep + 1} of ${STEPS.length}`,
              })}
            </span>
            <button
              onClick={() => editMode ? navigate('/settings') : navigate('/discover')}
              className="text-sm text-muted-foreground"
            >
              {editMode ? t('common.cancel', 'Cancel') : t('common.skip', 'Skip')}
            </button>
          </div>
          {!editMode && <Progress value={progress} className="h-1" />}
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6 pb-28">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center gap-3 mb-6">
              {(() => {
                const StepIcon = STEPS[currentStep].icon;
                return (
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <StepIcon className="w-6 h-6 text-primary" />
                  </div>
                );
              })()}
               <h1 className="text-2xl font-bold text-foreground">
                 {t(STEPS[currentStep].titleKey)}
               </h1>
            </div>
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Action */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t border-border">
        <Button
          onClick={handleNext}
          disabled={isSaving}
          className="w-full h-14 text-lg font-semibold gradient-primary"
          size="lg"
        >
          {isSaving ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              {t('common.saving', 'Saving...')}
            </span>
          ) : editMode ? (
            <>
              <Check className="w-5 h-5 mr-2" />
              {t('common.save', 'Save')}
            </>
          ) : currentStep === STEPS.length - 1 ? (
            <>
              <Check className="w-5 h-5 mr-2" />
              {t('onboarding.complete.startPlanning', 'Complete Setup')}
            </>
          ) : (
            <>
              {t('common.continue', 'Continue')}
              <ChevronRight className="w-5 h-5 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default Onboarding;
