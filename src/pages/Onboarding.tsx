import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ChevronLeft, ChevronRight, Check, User, Utensils, Plus } from 'lucide-react';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/input';
import i18n from '@/lib/i18n';
import { useAuth } from '@/hooks/useAuth';
import { useUserData } from '@/hooks/useUserData';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';

const STEPS = [
  { id: 'profile', icon: User, titleKey: 'onboarding.profile.title' },
  { id: 'diet', icon: Utensils, titleKey: 'onboarding.diet.title' },
];

const Onboarding = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const { profile, preferences, saveProfile, savePreferences, loading, refetch } = useUserData();
  const setAuthProfile = useAuthStore(state => state.setProfile);
  
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
  }));

  // Track if initial data has been loaded
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);

  // Load existing data when available - only once on initial load
  useEffect(() => {
    if (!initialDataLoaded && !loading && (profile || preferences)) {
      setFormData(prev => {
        const profileDisplayName =
          profile?.display_name && user?.email && profile.display_name === user.email
            ? ''
            : (profile?.display_name ?? prev.displayName);

        return {
          ...prev,
          units: profile?.units ?? prev.units,
          language: profile?.locale?.split('-')[0] ?? prev.language,
          displayName: profileDisplayName,
          age: profile?.age != null ? profile.age.toString() : prev.age,
          dietType: preferences?.diet_type ?? prev.dietType,
          allergies: preferences?.allergies ?? prev.allergies,
          dislikes: preferences?.dislikes ?? prev.dislikes,
          calorieTarget: preferences?.calorie_target != null ? preferences.calorie_target.toString() : prev.calorieTarget,
          proteinTarget: preferences?.protein_target != null ? preferences.protein_target.toString() : prev.proteinTarget,
          carbsTarget: preferences?.carbs_target != null ? preferences.carbs_target.toString() : prev.carbsTarget,
          fatTarget: preferences?.fat_target != null ? preferences.fat_target.toString() : prev.fatTarget,
          mealsPerDay: preferences?.meals_per_day ?? prev.mealsPerDay,
          medicalDisclaimer: preferences?.medical_disclaimer_accepted ?? prev.medicalDisclaimer,
          diabetesFriendly: preferences?.medical_diabetes_friendly ?? prev.diabetesFriendly,
          kidneyFriendly: preferences?.medical_kidney_friendly ?? prev.kidneyFriendly,
          heartHealthy: preferences?.medical_heart_healthy ?? prev.heartHealthy,
          lowSodium: preferences?.medical_low_sodium ?? prev.lowSodium,
        };
      });

      setInitialDataLoaded(true);
    }
  }, [profile, preferences, loading, initialDataLoaded, user?.email]);

  // Custom input state
  const [customAllergy, setCustomAllergy] = useState('');
  const [customDislike, setCustomDislike] = useState('');

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const handleSave = async (): Promise<boolean> => {
    // If user is not authenticated, skip saving to DB but still allow navigation
    if (!user) {
      // Store preferences in localStorage for later sync when user signs up
      localStorage.setItem('pendingOnboarding', JSON.stringify(formData));
      return true;
    }

    setIsSaving(true);
    try {
      const displayName = formData.displayName.trim();

      // Save profile data (avoid overwriting display_name with null/empty)
      const profilePatch: any = {
        age: formData.age ? parseInt(formData.age) : null,
        units: formData.units,
        locale: formData.language,
        onboarding_completed: true,
      };
      if (displayName) profilePatch.display_name = displayName;

      const savedProfile = await saveProfile(profilePatch);

      // Update auth store profile so Settings page shows correct data
      if (savedProfile) {
        setAuthProfile(savedProfile as any);
      }

      // Get the profile ID from saved profile for preferences
      const profileIdForPrefs = (savedProfile as any)?.id;
      if (!profileIdForPrefs) {
        console.error('No profile ID available after saving profile');
        throw new Error('Failed to get profile ID');
      }

      // Save preferences (creates row if missing) - pass explicit profile ID
      await savePreferences(
        {
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
        },
        profileIdForPrefs
      );

      // Refetch to ensure local state is up to date
      await refetch();

      toast.success(t('common.saved', 'Settings saved!'));
      return true;
    } catch (error) {
      console.error('Error saving:', error);
      toast.error(t('common.error', 'Failed to save'));
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleNext = async () => {
    // In edit mode, save immediately and return to settings
    if (editMode) {
      const ok = await handleSave();
      if (ok) navigate('/settings');
      return;
    }

    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
      return;
    }

    // Complete onboarding - save and go to discover
    const ok = await handleSave();
    if (ok) {
      navigate('/discover');
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else if (editMode) {
      navigate('/settings');
    }
  };

  const toggleArrayItem = (key: 'allergies' | 'dislikes', item: string) => {
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
              <div className="flex flex-wrap gap-2">
                {['none', 'vegetarian', 'vegan', 'pescatarian', 'keto', 'paleo', 'mediterranean'].map(diet => (
                  <button
                    key={diet}
                    onClick={() => setFormData(prev => ({ ...prev, dietType: diet }))}
                    className={`px-4 py-2 rounded-full border-2 transition-all text-sm font-medium ${
                      formData.dietType === diet
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-card'
                    }`}
                  >
                    {diet === 'none' ? t('onboarding.diet.noRestrictions', 'None') : t(`diet.${diet}`, diet)}
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
            <div>
              <label className="text-sm font-medium text-foreground mb-3 block">{t('onboarding.medical.options', 'Health Considerations')}</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'diabetesFriendly', label: t('onboarding.medical.diabetes', 'Diabetes-friendly') },
                  { key: 'kidneyFriendly', label: t('onboarding.medical.kidney', 'Kidney-friendly') },
                  { key: 'heartHealthy', label: t('onboarding.medical.heart', 'Heart-healthy') },
                  { key: 'lowSodium', label: t('onboarding.medical.lowSodium', 'Low sodium') },
                ].map(option => (
                  <button
                    key={option.key}
                    onClick={() => setFormData(prev => ({ ...prev, [option.key]: !prev[option.key as keyof typeof prev] }))}
                    className={`px-4 py-2 rounded-full border-2 transition-all text-sm font-medium ${
                      formData[option.key as keyof typeof formData]
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-card'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
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
