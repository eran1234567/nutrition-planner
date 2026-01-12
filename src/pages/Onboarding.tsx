import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ChevronLeft, ChevronRight, Check, Globe, Ruler, User, Utensils, Target, Heart, ChefHat } from 'lucide-react';
import { Chip } from '@/components/ui/Chip';

const STEPS = [
  { id: 'locale', icon: Globe, title: 'Language & Units' },
  { id: 'profile', icon: User, title: 'Your Profile' },
  { id: 'diet', icon: Utensils, title: 'Diet Preferences' },
  { id: 'goals', icon: Target, title: 'Your Goals' },
  { id: 'medical', icon: Heart, title: 'Health Considerations' },
  { id: 'cuisine', icon: ChefHat, title: 'Cuisine & Budget' },
];

const Onboarding = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);
  
  // Form state
  const [formData, setFormData] = useState({
    units: 'imperial' as 'imperial' | 'metric',
    language: 'en',
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
  });

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Complete onboarding
      navigate('/discover');
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
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

  const renderStep = () => {
    switch (STEPS[currentStep].id) {
      case 'locale':
        return (
          <div className="space-y-6">
            <div>
              <label className="text-sm font-medium text-foreground mb-3 block">Units</label>
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
              <label className="text-sm font-medium text-foreground mb-3 block">Language</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { code: 'en', label: 'English', flag: '🇺🇸' },
                  { code: 'es', label: 'Español', flag: '🇪🇸' },
                ].map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => setFormData(prev => ({ ...prev, language: lang.code }))}
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
              <label className="text-sm font-medium text-foreground mb-2 block">Your Name</label>
              <input
                type="text"
                value={formData.displayName}
                onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                placeholder="Enter your name"
                className="w-full h-14 px-4 rounded-xl border border-border bg-card text-foreground text-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Age (optional)</label>
              <input
                type="number"
                value={formData.age}
                onChange={(e) => setFormData(prev => ({ ...prev, age: e.target.value }))}
                placeholder="Your age"
                className="w-full h-14 px-4 rounded-xl border border-border bg-card text-foreground text-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        );

      case 'diet':
        return (
          <div className="space-y-6">
            <div>
              <label className="text-sm font-medium text-foreground mb-3 block">Diet Type</label>
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
                    {diet === 'none' ? 'No restrictions' : diet}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-3 block">Allergies</label>
              <div className="flex flex-wrap gap-2">
                {['Dairy', 'Eggs', 'Gluten', 'Nuts', 'Peanuts', 'Shellfish', 'Soy', 'Fish'].map(allergy => (
                  <Chip
                    key={allergy}
                    selected={formData.allergies.includes(allergy)}
                    onClick={() => toggleArrayItem('allergies', allergy)}
                  >
                    {allergy}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-3 block">Dislikes</label>
              <div className="flex flex-wrap gap-2">
                {['Spicy', 'Cilantro', 'Mushrooms', 'Onions', 'Olives', 'Tomatoes', 'Seafood'].map(dislike => (
                  <Chip
                    key={dislike}
                    selected={formData.dislikes.includes(dislike)}
                    onClick={() => toggleArrayItem('dislikes', dislike)}
                  >
                    {dislike}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        );

      case 'goals':
        return (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Optional: Set daily macro targets. Leave blank for balanced recommendations.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Calories</label>
                <input
                  type="number"
                  value={formData.calorieTarget}
                  onChange={(e) => setFormData(prev => ({ ...prev, calorieTarget: e.target.value }))}
                  placeholder="e.g. 2000"
                  className="w-full h-12 px-3 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Protein (g)</label>
                <input
                  type="number"
                  value={formData.proteinTarget}
                  onChange={(e) => setFormData(prev => ({ ...prev, proteinTarget: e.target.value }))}
                  placeholder="e.g. 120"
                  className="w-full h-12 px-3 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Carbs (g)</label>
                <input
                  type="number"
                  value={formData.carbsTarget}
                  onChange={(e) => setFormData(prev => ({ ...prev, carbsTarget: e.target.value }))}
                  placeholder="e.g. 250"
                  className="w-full h-12 px-3 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Fat (g)</label>
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
              <label className="text-sm font-medium text-foreground mb-3 block">Meals per Day</label>
              <div className="flex gap-2">
                {[2, 3, 4, 5].map(num => (
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
                ⚠️ This is general nutrition planning, not medical advice. Always consult your healthcare provider.
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
                <span className="text-sm">I understand this is not medical advice</span>
              </label>
            </div>
            {formData.medicalDisclaimer && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-3"
              >
                <p className="text-sm font-medium text-foreground">Health-conscious options:</p>
                {[
                  { key: 'diabetesFriendly', label: 'Diabetes-friendly', desc: 'Lower sugar, higher fiber' },
                  { key: 'kidneyFriendly', label: 'Kidney-friendly', desc: 'Conservative sodium' },
                  { key: 'heartHealthy', label: 'Heart-healthy', desc: 'Unsaturated fats, high fiber' },
                  { key: 'lowSodium', label: 'Low sodium', desc: 'Reduced salt intake' },
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
                      <p className="font-medium">{option.label}</p>
                      <p className="text-xs text-muted-foreground">{option.desc}</p>
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
              <label className="text-sm font-medium text-foreground mb-3 block">Preferred Cuisines</label>
              <div className="flex flex-wrap gap-2">
                {['American', 'Italian', 'Mexican', 'Asian', 'Mediterranean', 'Indian', 'Japanese', 'Thai', 'French', 'Greek'].map(cuisine => (
                  <Chip
                    key={cuisine}
                    selected={formData.cuisines.includes(cuisine)}
                    onClick={() => toggleArrayItem('cuisines', cuisine)}
                  >
                    {cuisine}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-3 block">Budget Level</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'budget', label: 'Budget', icon: '$' },
                  { value: 'medium', label: 'Medium', icon: '$$' },
                  { value: 'premium', label: 'Premium', icon: '$$$' },
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
                    <span className="text-sm">{budget.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-3 block">
                Max Cook Time: {formData.maxCookTime} min
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
                <span>15 min</span>
                <span>2 hours</span>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={handleBack}
              disabled={currentStep === 0}
              className="p-2 -ml-2 text-muted-foreground disabled:opacity-30"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <span className="text-sm text-muted-foreground">
              Step {currentStep + 1} of {STEPS.length}
            </span>
            <button
              onClick={() => navigate('/discover')}
              className="text-sm text-muted-foreground"
            >
              Skip
            </button>
          </div>
          <Progress value={progress} className="h-1" />
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6">
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
                {STEPS[currentStep].title}
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
          className="w-full h-14 text-lg font-semibold gradient-primary"
          size="lg"
        >
          {currentStep === STEPS.length - 1 ? (
            <>
              <Check className="w-5 h-5 mr-2" />
              Complete Setup
            </>
          ) : (
            <>
              Continue
              <ChevronRight className="w-5 h-5 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default Onboarding;
