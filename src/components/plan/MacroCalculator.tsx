import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Calculator, ArrowLeft, Utensils, Flame, Scale, TrendingUp, Zap, Activity, User, HelpCircle } from 'lucide-react';
import { useMealPlanStore, type MacroCalculatorInputs } from '@/stores/mealPlanStore';

interface MacroCalculatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (macros: { calories: number; protein: number; carbs: number; fat: number }) => void;
}

type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive';
type Goal = 'lose' | 'maintain' | 'gain';
type BodyFatMethod = 'direct' | 'navy';
type DietType = 'none' | 'vegetarian' | 'vegan' | 'pescatarian' | 'keto' | 'paleo' | 'mediterranean';
type DeficitType = 'standard' | 'custom_percent' | 'custom_deficit_calories' | 'custom_calories';
type Step = 'input' | 'body-composition' | 'distribution';

const activityMultipliers: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  veryActive: 1.9,
};

const goalMultipliers: Record<Goal, number> = {
  lose: 0.8,
  maintain: 1,
  gain: 1.15,
};

const dietOptions: { value: DietType; label: string }[] = [
  { value: 'none', label: 'No Restrictions' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'pescatarian', label: 'Pescatarian' },
  { value: 'keto', label: 'Keto' },
  { value: 'paleo', label: 'Paleo' },
  { value: 'mediterranean', label: 'Mediterranean' },
];

// Diet-specific macro presets (percentage of calories)
const dietMacroPresets: Record<DietType, { protein: number; carbs: number; fat: number }> = {
  none: { protein: 30, carbs: 40, fat: 30 },
  vegetarian: { protein: 25, carbs: 45, fat: 30 },
  vegan: { protein: 20, carbs: 55, fat: 25 },
  pescatarian: { protein: 30, carbs: 40, fat: 30 },
  keto: { protein: 20, carbs: 5, fat: 75 },
  paleo: { protein: 30, carbs: 25, fat: 45 },
  mediterranean: { protein: 20, carbs: 45, fat: 35 },
};

export function MacroCalculator({ open, onOpenChange, onApply }: MacroCalculatorProps) {
  const { t } = useTranslation();
  const { macroCalculatorInputs, setMacroCalculatorInputs } = useMealPlanStore();
  const [step, setStep] = useState<Step>('input');
  
  const [formData, setFormData] = useState({
    age: '',
    weight: '',
    height: '',
    heightFt: '',
    heightIn: '',
    sex: 'male' as 'male' | 'female',
    activityLevel: 'moderate' as ActivityLevel,
    goal: 'maintain' as Goal,
    unit: 'imperial' as 'metric' | 'imperial',
    bodyFatMethod: 'direct' as BodyFatMethod,
    bodyFatPercent: '',
    waist: '',
    neck: '',
    hip: '',
  });

  const [dietType, setDietType] = useState<DietType>('none');
  const [deficitType, setDeficitType] = useState<DeficitType>('standard');
  const [customDeficitPercent, setCustomDeficitPercent] = useState(20);
  const [customCalories, setCustomCalories] = useState('');
  const [customDeficitCalories, setCustomDeficitCalories] = useState('');
  
  // Macro distribution sliders - all adjustable
  const [proteinPerLb, setProteinPerLb] = useState(1.0); // g per lb LBM
  const [carbsPercent, setCarbsPercent] = useState(50); // % of calories
  const [fatPercent, setFatPercent] = useState(30); // % of calories
  const [lastAdjusted, setLastAdjusted] = useState<'carbs' | 'fat'>('fat'); // tracks which to auto-calc
  const [bmr, setBmr] = useState(0);
  const [tdee, setTdee] = useState(0);
  const [bodyFatCalculated, setBodyFatCalculated] = useState(0);
  const [leanBodyMass, setLeanBodyMass] = useState(0); // in lbs
  const [fatMass, setFatMass] = useState(0); // in lbs
  
  const [calculatedMacros, setCalculatedMacros] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });

  // Load saved inputs when dialog opens
  useEffect(() => {
    if (open && macroCalculatorInputs) {
      setFormData({
        age: macroCalculatorInputs.age,
        weight: macroCalculatorInputs.weight,
        height: macroCalculatorInputs.height,
        heightFt: macroCalculatorInputs.heightFt,
        heightIn: macroCalculatorInputs.heightIn,
        sex: macroCalculatorInputs.sex,
        activityLevel: macroCalculatorInputs.activityLevel,
        goal: macroCalculatorInputs.goal,
        unit: macroCalculatorInputs.unit,
        bodyFatMethod: macroCalculatorInputs.bodyFatMethod,
        bodyFatPercent: macroCalculatorInputs.bodyFatPercent,
        waist: macroCalculatorInputs.waist,
        neck: macroCalculatorInputs.neck,
        hip: macroCalculatorInputs.hip,
      });
      setDietType(macroCalculatorInputs.dietType);
      setDeficitType(macroCalculatorInputs.deficitType);
      setCustomDeficitPercent(macroCalculatorInputs.customDeficitPercent);
      setCustomCalories(macroCalculatorInputs.customCalories);
      setCustomDeficitCalories(macroCalculatorInputs.customDeficitCalories);
      setProteinPerLb(macroCalculatorInputs.proteinPerLb);
      setCarbsPercent(macroCalculatorInputs.carbsPercent);
      setFatPercent(macroCalculatorInputs.fatPercent);
    }
  }, [open, macroCalculatorInputs]);

  // Calculate body fat using US Navy method
  const calculateNavyBodyFat = (): number | null => {
    let waist = parseFloat(formData.waist);
    let neck = parseFloat(formData.neck);
    let height: number;
    let hip = parseFloat(formData.hip);

    if (formData.unit === 'imperial') {
      const ft = parseFloat(formData.heightFt) || 0;
      const inches = parseFloat(formData.heightIn) || 0;
      height = (ft * 12 + inches) * 2.54;
    } else {
      height = parseFloat(formData.height);
    }

    if (!waist || !neck || !height) return null;
    if (formData.sex === 'female' && !hip) return null;

    if (formData.unit === 'imperial') {
      waist = waist * 2.54;
      neck = neck * 2.54;
      hip = hip * 2.54;
    }

    let bodyFat: number;
    if (formData.sex === 'male') {
      bodyFat = 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(height)) - 450;
    } else {
      bodyFat = 495 / (1.29579 - 0.35004 * Math.log10(waist + hip - neck) + 0.22100 * Math.log10(height)) - 450;
    }

    return Math.max(0, Math.min(60, bodyFat));
  };

  const calculateBaseTdee = () => {
    const age = parseInt(formData.age);
    let weight = parseFloat(formData.weight);
    let height: number;
    const weightLbs = formData.unit === 'imperial' ? parseFloat(formData.weight) : parseFloat(formData.weight) * 2.20462;

    if (formData.unit === 'imperial') {
      const ft = parseFloat(formData.heightFt) || 0;
      const inches = parseFloat(formData.heightIn) || 0;
      height = (ft * 12 + inches) * 2.54;
      weight = weight * 0.453592;
    } else {
      height = parseFloat(formData.height);
    }

    let bodyFat: number | null = null;
    if (formData.bodyFatMethod === 'direct' && formData.bodyFatPercent) {
      bodyFat = parseFloat(formData.bodyFatPercent);
    } else if (formData.bodyFatMethod === 'navy') {
      bodyFat = calculateNavyBodyFat();
    }

    let calculatedBmr: number;
    let lbm: number;
    let fm: number;
    
    if (bodyFat !== null && bodyFat > 0) {
      const leanMassKg = weight * (1 - bodyFat / 100);
      lbm = leanMassKg / 0.453592; // Convert to lbs
      fm = weightLbs - lbm;
      calculatedBmr = 370 + 21.6 * leanMassKg;
      setBodyFatCalculated(bodyFat);
    } else {
      if (formData.sex === 'male') {
        calculatedBmr = 10 * weight + 6.25 * height - 5 * age + 5;
      } else {
        calculatedBmr = 10 * weight + 6.25 * height - 5 * age - 161;
      }
      // Estimate LBM if no body fat provided (rough estimate: 75-80% of weight for males, 70-75% for females)
      const estimatedLeanPercent = formData.sex === 'male' ? 0.78 : 0.72;
      const estimatedBodyFat = formData.sex === 'male' ? 22 : 28;
      lbm = weightLbs * estimatedLeanPercent;
      fm = weightLbs - lbm;
      setBodyFatCalculated(estimatedBodyFat);
    }

    const calculatedTdee = calculatedBmr * activityMultipliers[formData.activityLevel];
    
    setBmr(Math.round(calculatedBmr));
    setTdee(calculatedTdee);
    setLeanBodyMass(lbm);
    setFatMass(fm);
    
    return { tdee: calculatedTdee, lbm };
  };

  const handleCalculateClick = () => {
    calculateBaseTdee();
    setStep('body-composition');
  };

  // When diet type changes, apply preset macro percentages
  useEffect(() => {
    const preset = dietMacroPresets[dietType];
    setCarbsPercent(preset.carbs);
    setFatPercent(preset.fat);
    // For keto, reduce protein per lb since it's already high %
    if (dietType === 'keto') {
      setProteinPerLb(0.8);
      setLastAdjusted('carbs'); // In keto, fat is usually manually set
    } else {
      setProteinPerLb(1.0);
      setLastAdjusted('fat');
    }
  }, [dietType]);

  // Get protein slider range based on diet type
  const getProteinRange = () => {
    if (dietType === 'keto') {
      return { min: 0.6, max: 1.0, step: 0.1 };
    }
    return { min: 0.8, max: 1.4, step: 0.1 };
  };

  // Get carbs slider range based on diet type
  const getCarbsRange = () => {
    if (dietType === 'keto') {
      return { min: 2, max: 10, step: 1 }; // Very low for keto
    }
    return { min: 10, max: 65, step: 1 };
  };

  // Get fat slider range based on diet type
  const getFatRange = () => {
    if (dietType === 'keto') {
      return { min: 60, max: 80, step: 1 }; // High fat for keto
    }
    return { min: 15, max: 50, step: 1 };
  };

  // Calculate protein percent from current settings
  const getProteinPercent = () => {
    const targetCalories = getTargetCalories();
    const proteinGrams = Math.round(leanBodyMass * proteinPerLb);
    const proteinCalories = proteinGrams * 4;
    return Math.round((proteinCalories / targetCalories) * 100);
  };

  // Get the auto-calculated value (whichever was NOT last adjusted)
  const getAutoCarbsPercent = () => {
    const proteinPct = getProteinPercent();
    return Math.max(0, 100 - proteinPct - fatPercent);
  };

  const getAutoFatPercent = () => {
    const proteinPct = getProteinPercent();
    return Math.max(0, 100 - proteinPct - carbsPercent);
  };

  // Handle carbs change - auto-adjust fat
  const handleCarbsChange = (val: number) => {
    setCarbsPercent(val);
    setLastAdjusted('carbs');
    // Auto-calculate fat
    const proteinPct = getProteinPercent();
    const newFat = Math.max(0, 100 - proteinPct - val);
    setFatPercent(newFat);
  };

  // Handle fat change - auto-adjust carbs
  const handleFatChange = (val: number) => {
    setFatPercent(val);
    setLastAdjusted('fat');
    // Auto-calculate carbs
    const proteinPct = getProteinPercent();
    const newCarbs = Math.max(0, 100 - proteinPct - val);
    setCarbsPercent(newCarbs);
  };

  // Calculate target calories based on deficit settings
  const getTargetCalories = () => {
    const baseMultiplier = goalMultipliers[formData.goal];
    
    if (deficitType === 'custom_calories' && customCalories) {
      return parseInt(customCalories);
    }
    
    if (deficitType === 'custom_deficit_calories' && customDeficitCalories) {
      const deficitCals = parseInt(customDeficitCalories);
      if (formData.goal === 'lose') {
        return Math.round(tdee - deficitCals);
      } else if (formData.goal === 'gain') {
        return Math.round(tdee + deficitCals);
      }
      return Math.round(tdee);
    }
    
    if (deficitType === 'custom_percent') {
      const multiplier = formData.goal === 'lose' 
        ? (100 - customDeficitPercent) / 100 
        : formData.goal === 'gain' 
          ? (100 + customDeficitPercent) / 100 
          : 1;
      return Math.round(tdee * multiplier);
    }
    
    return Math.round(tdee * baseMultiplier);
  };

  // Calculate macros from current settings
  const calculateFinalMacros = () => {
    const targetCalories = getTargetCalories();
    
    // Calculate protein
    const proteinGrams = Math.round(leanBodyMass * proteinPerLb);
    const proteinCalories = proteinGrams * 4;
    
    // Use the current values (one is manually set, one is auto-calculated)
    const effectiveCarbsPct = lastAdjusted === 'carbs' ? carbsPercent : getAutoCarbsPercent();
    const effectiveFatPct = lastAdjusted === 'fat' ? fatPercent : getAutoFatPercent();
    
    // Calculate carbs from percentage
    const carbCalories = Math.round(targetCalories * (effectiveCarbsPct / 100));
    const carbGrams = Math.round(carbCalories / 4);
    
    // Calculate fat from percentage
    const fatCalories = Math.round(targetCalories * (effectiveFatPct / 100));
    const fatGrams = Math.round(fatCalories / 9);
    
    return {
      calories: targetCalories,
      protein: proteinGrams,
      carbs: Math.max(0, carbGrams),
      fat: Math.max(0, fatGrams),
    };
  };

  // Check if macros are valid (don't exceed calories)
  const getMacroWarning = (): { title: string; detail: string } | null => {
    const targetCalories = getTargetCalories();
    const proteinPct = getProteinPercent();
    const effectiveCarbsPct = lastAdjusted === 'carbs' ? carbsPercent : getAutoCarbsPercent();
    const effectiveFatPct = lastAdjusted === 'fat' ? fatPercent : getAutoFatPercent();
    
    const totalPercent = proteinPct + effectiveCarbsPct + effectiveFatPct;
    
    if (effectiveFatPct < 10) {
      return {
        title: 'Fat too low',
        detail: `Fat is only ${effectiveFatPct}%. Minimum 10% recommended for health. Reduce carbs or protein.`
      };
    }
    
    if (effectiveCarbsPct < 5) {
      return {
        title: 'Carbs very low',
        detail: `Carbs are only ${effectiveCarbsPct}%. This is fine for keto but review if unintentional.`
      };
    }
    
    // For keto, check if carbs are too high
    const carbGrams = Math.round((targetCalories * (effectiveCarbsPct / 100)) / 4);
    if (dietType === 'keto' && carbGrams > 50) {
      return {
        title: 'Carbs exceed keto limit',
        detail: `Net carbs (${carbGrams}g) exceed the 20-50g keto limit. Reduce carbs percentage.`
      };
    }
    
    return null;
  };

  const handleContinueToDistribution = () => {
    setStep('distribution');
  };

  const handleApply = () => {
    const macros = calculateFinalMacros();
    
    // Save inputs for next time
    setMacroCalculatorInputs({
      age: formData.age,
      weight: formData.weight,
      height: formData.height,
      heightFt: formData.heightFt,
      heightIn: formData.heightIn,
      sex: formData.sex,
      activityLevel: formData.activityLevel,
      goal: formData.goal,
      unit: formData.unit,
      bodyFatMethod: formData.bodyFatMethod,
      bodyFatPercent: formData.bodyFatPercent,
      waist: formData.waist,
      neck: formData.neck,
      hip: formData.hip,
      dietType,
      deficitType,
      customDeficitPercent,
      customCalories,
      customDeficitCalories,
      proteinPerLb,
      carbsPercent,
      fatPercent,
    });
    
    onApply(macros);
    onOpenChange(false);
    setStep('input');
  };

  const handleClose = () => {
    onOpenChange(false);
    setStep('input');
  };

  const handleBack = () => {
    if (step === 'body-composition') setStep('input');
    else if (step === 'distribution') setStep('body-composition');
  };

  const isFormValid = formData.age && formData.weight && 
    (formData.unit === 'imperial' ? (formData.heightFt || formData.heightIn) : formData.height);

  const proteinRange = getProteinRange();
  const carbsRange = getCarbsRange();
  const fatRange = getFatRange();
  const currentMacros = step === 'distribution' ? calculateFinalMacros() : calculatedMacros;
  const effectiveCarbsPct = lastAdjusted === 'carbs' ? carbsPercent : getAutoCarbsPercent();
  const effectiveFatPct = lastAdjusted === 'fat' ? fatPercent : getAutoFatPercent();
  const warning = step === 'distribution' ? getMacroWarning() : null;

  // Get step title
  const getStepTitle = () => {
    switch (step) {
      case 'input':
        return (
          <>
            <Calculator className="w-5 h-5" />
            {t('macroCalculator.title', 'Macro Calculator')}
          </>
        );
      case 'body-composition':
        return (
          <>
            <Scale className="w-5 h-5" />
            Your Body Composition & Metabolism
          </>
        );
      case 'distribution':
        return (
          <>
            <Calculator className="w-5 h-5" />
            {t('macroCalculator.title', 'Macro Calculator')}
          </>
        );
    }
  };

  // Helper to get unit display for body composition
  const getWeightInKg = (lbs: number) => (lbs * 0.453592).toFixed(1);

  const isYouth = parseInt(formData.age) > 0 && parseInt(formData.age) < 18;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-xl max-h-[98vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getStepTitle()}
          </DialogTitle>
        </DialogHeader>

        {step === 'input' && (
          <div className="space-y-3 pt-1">
            <p className="text-xs text-muted-foreground">
              {t('macroCalculator.description', 'Enter your details to calculate your recommended daily macros.')}
            </p>

            {/* Unit Toggle + Sex - combined row */}
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Units</label>
                <div className="flex gap-1">
                  {(['imperial', 'metric'] as const).map((unit) => (
                    <button
                      key={unit}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, unit }))}
                      className={`flex-1 h-7 rounded-md border text-xs font-medium transition-all ${
                        formData.unit === unit
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-card hover:bg-muted'
                      }`}
                    >
                      {unit === 'imperial' ? 'lb/in' : 'kg/cm'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Sex</label>
                <div className="flex gap-1">
                  {(['male', 'female'] as const).map((sex) => {
                    const age = parseInt(formData.age) || 0;
                    const label = age > 0 && age < 18 
                      ? (sex === 'male' ? 'Boy' : 'Girl')
                      : (sex === 'male' ? 'Male' : 'Female');
                    return (
                      <button
                        key={sex}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, sex }))}
                        className={`flex-1 h-7 rounded-md border text-xs font-medium capitalize transition-all ${
                          formData.sex === sex
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-card hover:bg-muted'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Age, Weight, Height - Compact */}
            <div className={`grid gap-2 ${formData.unit === 'imperial' ? 'grid-cols-4' : 'grid-cols-3'}`}>
              <div>
                <label className="text-xs font-medium mb-1 block">Age</label>
                <input
                  type="number"
                  value={formData.age}
                  onChange={(e) => setFormData(prev => ({ ...prev, age: e.target.value }))}
                  placeholder="25"
                  className="w-full h-8 px-2 rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">
                  Weight ({formData.unit === 'metric' ? 'kg' : 'lb'})
                </label>
                <input
                  type="number"
                  value={formData.weight}
                  onChange={(e) => setFormData(prev => ({ ...prev, weight: e.target.value }))}
                  placeholder={formData.unit === 'metric' ? '70' : '154'}
                  className="w-full h-8 px-2 rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
              </div>
              {formData.unit === 'imperial' ? (
                <>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Ht (ft)</label>
                    <input
                      type="number"
                      value={formData.heightFt}
                      onChange={(e) => setFormData(prev => ({ ...prev, heightFt: e.target.value }))}
                      placeholder="5"
                      className="w-full h-8 px-2 rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Ht (in)</label>
                    <input
                      type="number"
                      value={formData.heightIn}
                      onChange={(e) => setFormData(prev => ({ ...prev, heightIn: e.target.value }))}
                      placeholder="9"
                      className="w-full h-8 px-2 rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="text-xs font-medium mb-1 block">Height (cm)</label>
                  <input
                    type="number"
                    value={formData.height}
                    onChange={(e) => setFormData(prev => ({ ...prev, height: e.target.value }))}
                    placeholder="175"
                    className="w-full h-8 px-2 rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                </div>
              )}
            </div>

            {/* Activity Level - Compact */}
            <div>
              <label className="text-xs font-medium mb-1 block">Activity Level</label>
              <select
                value={formData.activityLevel}
                onChange={(e) => setFormData(prev => ({ ...prev, activityLevel: e.target.value as ActivityLevel }))}
                className="w-full h-8 px-2 rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                <option value="sedentary">Sedentary (little or no exercise)</option>
                <option value="light">Light (1-3 days/week)</option>
                <option value="moderate">Moderate (3-5 days/week)</option>
                <option value="active">Active (6-7 days/week)</option>
                <option value="veryActive">Very Active (intense daily)</option>
              </select>
            </div>

            {/* Body Fat % - Compact inline options */}
            <div>
              <label className="text-xs font-medium mb-1 block">Body Fat %</label>
              <div className="flex gap-2">
                {/* Direct entry option */}
                <div 
                  className={`flex items-center gap-2 flex-1 p-2 rounded-md border cursor-pointer transition-all ${
                    formData.bodyFatMethod === 'direct' 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:bg-muted/50'
                  }`}
                  onClick={() => setFormData(prev => ({ ...prev, bodyFatMethod: 'direct' }))}
                >
                  <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    formData.bodyFatMethod === 'direct' ? 'border-primary' : 'border-muted-foreground'
                  }`}>
                    {formData.bodyFatMethod === 'direct' && (
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    )}
                  </div>
                  <span className="text-xs font-medium flex-shrink-0">Direct</span>
                  {formData.bodyFatMethod === 'direct' && (
                    <input
                      type="number"
                      value={formData.bodyFatPercent}
                      onChange={(e) => setFormData(prev => ({ ...prev, bodyFatPercent: e.target.value }))}
                      placeholder="%"
                      onClick={(e) => e.stopPropagation()}
                      className="w-12 h-6 px-1.5 rounded border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-xs text-center"
                    />
                  )}
                </div>
                
                {/* US Navy method option */}
                <div 
                  className={`flex items-center gap-2 flex-1 p-2 rounded-md border cursor-pointer transition-all ${
                    formData.bodyFatMethod === 'navy' 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:bg-muted/50'
                  }`}
                  onClick={() => setFormData(prev => ({ ...prev, bodyFatMethod: 'navy' }))}
                >
                  <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    formData.bodyFatMethod === 'navy' ? 'border-primary' : 'border-muted-foreground'
                  }`}>
                    {formData.bodyFatMethod === 'navy' && (
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    )}
                  </div>
                  <span className="text-xs font-medium">US Navy</span>
                </div>
              </div>
              
              {/* Navy method inputs - show below when selected */}
              {formData.bodyFatMethod === 'navy' && (
                <div className="flex items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="number"
                    value={formData.waist}
                    onChange={(e) => setFormData(prev => ({ ...prev, waist: e.target.value }))}
                    placeholder={`Waist (${formData.unit === 'metric' ? 'cm' : 'in'})`}
                    className="flex-1 h-7 px-2 rounded border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                  />
                  <input
                    type="number"
                    value={formData.neck}
                    onChange={(e) => setFormData(prev => ({ ...prev, neck: e.target.value }))}
                    placeholder={`Neck (${formData.unit === 'metric' ? 'cm' : 'in'})`}
                    className="flex-1 h-7 px-2 rounded border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                  />
                  {formData.sex === 'female' && (
                    <input
                      type="number"
                      value={formData.hip}
                      onChange={(e) => setFormData(prev => ({ ...prev, hip: e.target.value }))}
                      placeholder={`Hip (${formData.unit === 'metric' ? 'cm' : 'in'})`}
                      className="flex-1 h-7 px-2 rounded border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                    />
                  )}
                </div>
              )}
            </div>

            {/* Goal - Compact */}
            <div>
              <label className="text-xs font-medium mb-1 block">Goal</label>
              <div className="flex gap-1.5 min-w-0">
                {([
                  { value: 'lose', label: 'Lose' },
                  { value: 'maintain', label: 'Maintain' },
                  { value: 'gain', label: 'Gain' },
                ] as const).map((goal) => (
                  <button
                    key={goal.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, goal: goal.value }))}
                    className={`flex-1 min-w-0 h-8 rounded-md border-2 text-xs font-medium transition-all ${
                      formData.goal === goal.value
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card hover:bg-muted'
                    }`}
                  >
                    {goal.label}
                  </button>
                ))}
              </div>
            </div>

            <Button 
              className="w-full h-9" 
              onClick={handleCalculateClick}
              disabled={!isFormValid}
            >
              Calculate Body Composition
            </Button>
          </div>
        )}

        {step === 'body-composition' && (
          <div className="space-y-4 pt-2 overflow-y-auto max-h-[70vh]">
            {/* Adult/Youth indicator */}
            <div className="flex justify-end">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-sm text-muted-foreground">
                <User className="w-4 h-4" />
                <span>{isYouth ? 'Youth' : 'Adult'} calculations active</span>
                <HelpCircle className="w-4 h-4" />
              </div>
            </div>

            {/* Body Composition Cards - Row 1 */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 rounded-xl border border-border bg-card">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <Scale className="w-3.5 h-3.5 text-destructive" />
                  <span className="text-[10px] font-medium uppercase tracking-wide">Body Fat %</span>
                </div>
                <p className="text-2xl font-bold">{Math.round(bodyFatCalculated)}%</p>
              </div>
              
              <div className="p-3 rounded-xl border border-border bg-card">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-[10px] font-medium uppercase tracking-wide">Fat Mass</span>
                </div>
                <p className="text-2xl font-bold whitespace-nowrap">{fatMass.toFixed(1)} <span className="text-sm font-normal">lb</span></p>
                <p className="text-xs text-muted-foreground">({getWeightInKg(fatMass)} kg)</p>
              </div>
              
              <div className="p-3 rounded-xl border border-border bg-card">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <Zap className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-medium uppercase tracking-wide">Lean Body Mass</span>
                </div>
                <p className="text-2xl font-bold whitespace-nowrap">{leanBodyMass.toFixed(1)} <span className="text-sm font-normal">lb</span></p>
                <p className="text-xs text-muted-foreground">({getWeightInKg(leanBodyMass)} kg)</p>
              </div>
            </div>

            {/* Body Composition Cards - Row 2 */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-xl border border-border bg-card">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <Activity className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-[10px] font-medium uppercase tracking-wide">BMR</span>
                </div>
                <p className="text-2xl font-bold whitespace-nowrap">{bmr} <span className="text-sm font-normal">cal/day</span></p>
                <p className="text-xs text-muted-foreground">Base metabolic rate</p>
              </div>
              
              <div className="p-3 rounded-xl border border-primary/30 bg-primary/5">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <Flame className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-medium uppercase tracking-wide">TDEE</span>
                </div>
                <p className="text-2xl font-bold text-primary whitespace-nowrap">{Math.round(tdee)} <span className="text-sm font-normal">cal/day</span></p>
                <p className="text-xs text-muted-foreground">Total daily energy expenditure</p>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button className="flex-1" onClick={handleContinueToDistribution}>
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === 'distribution' && (
          <div className="space-y-3 pt-1 overflow-y-auto max-h-[80vh]">
            {/* Dietary Style + Calorie Deficit - Combined Row */}
            <div className="p-3 rounded-xl border border-border bg-card">
              <div className="flex items-center gap-4">
                {/* Dietary Style */}
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-xs font-medium whitespace-nowrap">Diet</span>
                  <select
                    value={dietType}
                    onChange={(e) => setDietType(e.target.value as DietType)}
                    className="h-7 px-2 rounded border border-border bg-background text-xs flex-1"
                  >
                    {dietOptions.map((diet) => (
                      <option key={diet.value} value={diet.value}>
                        {diet.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Divider */}
                <div className="h-6 w-px bg-border" />
                
                {/* Calorie Deficit */}
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-xs font-medium whitespace-nowrap">Deficit</span>
                  <select
                    value={deficitType}
                    onChange={(e) => setDeficitType(e.target.value as DeficitType)}
                    className="h-7 px-2 rounded border border-border bg-background text-xs flex-1"
                  >
                    <option value="standard">20%</option>
                    <option value="custom_percent">Custom %</option>
                    <option value="custom_deficit_calories">Cal deficit</option>
                    <option value="custom_calories">Set cal</option>
                  </select>
                  {deficitType === 'custom_percent' && (
                    <input
                      type="number"
                      value={customDeficitPercent}
                      onChange={(e) => setCustomDeficitPercent(Math.min(50, Math.max(5, parseInt(e.target.value) || 0)))}
                      className="w-10 h-7 px-1 rounded border border-border bg-background text-xs text-center"
                      min={5}
                      max={50}
                    />
                  )}
                  {deficitType === 'custom_deficit_calories' && (
                    <input
                      type="number"
                      value={customDeficitCalories}
                      onChange={(e) => setCustomDeficitCalories(e.target.value)}
                      placeholder="500"
                      className="w-12 h-7 px-1 rounded border border-border bg-background text-xs text-center"
                    />
                  )}
                  {deficitType === 'custom_calories' && (
                    <input
                      type="number"
                      value={customCalories}
                      onChange={(e) => setCustomCalories(e.target.value)}
                      placeholder={String(getTargetCalories())}
                      className="w-14 h-7 px-1 rounded border border-border bg-background text-xs text-center"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Macro Distribution Section - Compact with Carbs bar */}
            <div className="p-3 rounded-xl border border-border bg-card">
              <h3 className="font-semibold text-sm mb-2">Macro Distribution</h3>
              
              {/* Protein Slider - Blue */}
              <div className="mb-2.5">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-medium">Protein: {proteinPerLb.toFixed(1)} g/lb LBM</span>
                  <span className="text-xs text-muted-foreground">{currentMacros.protein}g</span>
                </div>
                <Slider
                  value={[proteinPerLb]}
                  onValueChange={([val]) => setProteinPerLb(val)}
                  min={proteinRange.min}
                  max={proteinRange.max}
                  step={proteinRange.step}
                  className="w-full [&_[data-orientation=horizontal]>.bg-primary]:bg-blue-500 [&_[data-state=active]]:border-blue-500 [&>span>span]:bg-blue-500 [&>span>span>span]:border-blue-500"
                />
              </div>

              {/* Carbs Slider - Amber */}
              <div className="mb-2.5">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-medium">
                    Carbs: {effectiveCarbsPct}% of calories
                    {lastAdjusted === 'fat' && <span className="text-muted-foreground ml-1">(auto)</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">{currentMacros.carbs}g</span>
                </div>
                <Slider
                  value={[effectiveCarbsPct]}
                  onValueChange={([val]) => handleCarbsChange(val)}
                  min={carbsRange.min}
                  max={carbsRange.max}
                  step={carbsRange.step}
                  className="w-full [&_[data-orientation=horizontal]>.bg-primary]:bg-amber-500 [&_[data-state=active]]:border-amber-500 [&>span>span]:bg-amber-500 [&>span>span>span]:border-amber-500"
                />
              </div>

              {/* Fat Slider - Pink */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-medium">
                    Fat: {effectiveFatPct}% of calories
                    {lastAdjusted === 'carbs' && <span className="text-muted-foreground ml-1">(auto)</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">{currentMacros.fat}g</span>
                </div>
                <Slider
                  value={[effectiveFatPct]}
                  onValueChange={([val]) => handleFatChange(val)}
                  min={fatRange.min}
                  max={fatRange.max}
                  step={fatRange.step}
                  className="w-full [&_[data-orientation=horizontal]>.bg-primary]:bg-pink-500 [&_[data-state=active]]:border-pink-500 [&>span>span]:bg-pink-500 [&>span>span>span]:border-pink-500"
                />
              </div>

              {/* Warning - Compact */}
              {warning && (
                <div className="mt-2 p-2 rounded-lg bg-destructive/10 border border-destructive/30">
                  <p className="text-xs text-destructive font-medium">{warning.title}</p>
                </div>
              )}
            </div>

            {/* Live Preview Results - Compact */}
            {(() => {
              const proteinCals = currentMacros.protein * 4;
              const carbsCals = currentMacros.carbs * 4;
              const fatCals = currentMacros.fat * 9;
              const totalCals = currentMacros.calories;
              
              const proteinPct = Math.round((proteinCals / totalCals) * 100);
              const carbsPct = Math.round((carbsCals / totalCals) * 100);
              const fatPct = 100 - proteinPct - carbsPct;
              
              const dailyDeficit = Math.round(tdee - totalCals);
              const weeklyDeficit = dailyDeficit * 7;
              const expectedLossPerWeek = (weeklyDeficit / 3500).toFixed(2);
              
              return (
                <>
                  {/* Daily Targets Header - Compact */}
                  <div className="bg-primary/5 rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Flame className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-sm">Daily Targets</span>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-bold text-primary">{totalCals.toLocaleString()}</span>
                        <span className="text-xs text-muted-foreground ml-1">cal/day</span>
                      </div>
                    </div>
                  </div>

                  {/* Macro percentage bar + cards combined */}
                  <div className="space-y-2">
                    <div className="flex h-6 rounded-full overflow-hidden">
                      <div 
                        className="flex items-center justify-center text-white text-[10px] font-semibold"
                        style={{ width: `${proteinPct}%`, backgroundColor: '#3B82F6' }}
                      >
                        {proteinPct}%
                      </div>
                      <div 
                        className="flex items-center justify-center text-white text-[10px] font-semibold"
                        style={{ width: `${carbsPct}%`, backgroundColor: '#F59E0B' }}
                      >
                        {carbsPct}%
                      </div>
                      <div 
                        className="flex items-center justify-center text-white text-[10px] font-semibold"
                        style={{ width: `${fatPct}%`, backgroundColor: '#EC4899' }}
                      >
                        {fatPct}%
                      </div>
                    </div>

                    {/* Compact Macro cards */}
                    <div className="grid grid-cols-3 gap-1.5">
                      <div className="rounded-lg border border-border overflow-hidden">
                        <div className="h-0.5" style={{ backgroundColor: '#3B82F6' }} />
                        <div className="p-2 text-center">
                          <p className="text-[10px] text-muted-foreground uppercase">Protein</p>
                          <p className="text-base font-bold">{currentMacros.protein}g</p>
                          <p className="text-[10px] text-muted-foreground">{proteinCals} cal</p>
                        </div>
                      </div>
                      <div className="rounded-lg border border-border overflow-hidden">
                        <div className="h-0.5" style={{ backgroundColor: '#F59E0B' }} />
                        <div className="p-2 text-center">
                          <p className="text-[10px] text-muted-foreground uppercase">Carbs</p>
                          <p className="text-base font-bold">{currentMacros.carbs}g</p>
                          <p className="text-[10px] text-muted-foreground">{carbsCals} cal</p>
                        </div>
                      </div>
                      <div className="rounded-lg border border-border overflow-hidden">
                        <div className="h-0.5" style={{ backgroundColor: '#EC4899' }} />
                        <div className="p-2 text-center">
                          <p className="text-[10px] text-muted-foreground uppercase">Fat</p>
                          <p className="text-base font-bold">{currentMacros.fat}g</p>
                          <p className="text-[10px] text-muted-foreground">{fatCals} cal</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Deficit + Expected - Combined single row */}
                  {formData.goal !== 'maintain' && (
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/50 border border-border">
                      <div className="text-center flex-1">
                        <p className="text-[10px] text-muted-foreground uppercase">Daily</p>
                        <p className={`text-sm font-bold ${formData.goal === 'lose' ? 'text-destructive' : 'text-primary'}`}>
                          {formData.goal === 'lose' ? '-' : '+'}{Math.abs(dailyDeficit).toLocaleString()}
                        </p>
                      </div>
                      <div className="h-8 w-px bg-border" />
                      <div className="text-center flex-1">
                        <p className="text-[10px] text-muted-foreground uppercase">Weekly</p>
                        <p className={`text-sm font-bold ${formData.goal === 'lose' ? 'text-destructive' : 'text-primary'}`}>
                          {formData.goal === 'lose' ? '-' : '+'}{Math.abs(weeklyDeficit).toLocaleString()}
                        </p>
                      </div>
                      <div className="h-8 w-px bg-border" />
                      <div className="text-center flex-1">
                        <p className="text-[10px] text-muted-foreground uppercase">Est. {formData.goal === 'lose' ? 'Loss' : 'Gain'}</p>
                        <p className={`text-sm font-bold ${formData.goal === 'lose' ? 'text-destructive' : 'text-primary'}`}>
                          {Math.abs(parseFloat(expectedLossPerWeek))} lb/wk
                        </p>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}

            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" className="flex-1" onClick={handleBack}>
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                Back
              </Button>
              <Button size="sm" className="flex-1" onClick={handleApply} disabled={!!warning}>
                Apply These
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
