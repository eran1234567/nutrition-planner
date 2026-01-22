import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Calculator, ArrowLeft, Utensils, Flame, Scale, TrendingUp, Zap, Activity, User, HelpCircle } from 'lucide-react';

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
type Step = 'input' | 'body-composition' | 'distribution' | 'dietary' | 'result';

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

const dietOptions: { value: DietType; label: string; description: string }[] = [
  { value: 'none', label: 'No Restrictions', description: 'Standard balanced macros' },
  { value: 'vegetarian', label: 'Vegetarian', description: 'No meat, includes dairy & eggs' },
  { value: 'vegan', label: 'Vegan', description: 'Plant-based only' },
  { value: 'pescatarian', label: 'Pescatarian', description: 'Fish & seafood, no meat' },
  { value: 'keto', label: 'Keto', description: 'Very low carb, high fat' },
  { value: 'paleo', label: 'Paleo', description: 'Whole foods, no processed' },
  { value: 'mediterranean', label: 'Mediterranean', description: 'Olive oil, fish, whole grains' },
];

export function MacroCalculator({ open, onOpenChange, onApply }: MacroCalculatorProps) {
  const { t } = useTranslation();
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

  // When diet type changes, update defaults
  useEffect(() => {
    if (dietType === 'keto') {
      setProteinPerLb(0.8);
      setCarbsPercent(5); // Very low carbs for keto
      setFatPercent(70);
      setLastAdjusted('carbs'); // In keto, fat is usually manually set
    } else if (dietType === 'paleo' || dietType === 'vegan' || dietType === 'none') {
      setProteinPerLb(1.2);
      setCarbsPercent(50);
      setFatPercent(25);
      setLastAdjusted('fat');
    } else {
      setProteinPerLb(1.0);
      setCarbsPercent(50);
      setFatPercent(25);
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

  const handleContinueToDietary = () => {
    setStep('dietary');
  };

  const handleContinueToResult = () => {
    const macros = calculateFinalMacros();
    setCalculatedMacros(macros);
    setStep('result');
  };

  const handleApply = () => {
    onApply(calculatedMacros);
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
    else if (step === 'dietary') setStep('distribution');
    else if (step === 'result') setStep('dietary');
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
      case 'dietary':
        return (
          <>
            <Utensils className="w-5 h-5" />
            Dietary Style
          </>
        );
      case 'result':
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
          <div className="space-y-5 pt-2 overflow-y-auto max-h-[70vh]">
            <p className="text-sm text-muted-foreground">
              {t('macroCalculator.description', 'Enter your details to calculate your recommended daily macros.')}
            </p>

            {/* Unit Toggle + Sex - combined row */}
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Units</label>
                <div className="flex gap-1.5">
                  {(['imperial', 'metric'] as const).map((unit) => (
                    <button
                      key={unit}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, unit }))}
                      className={`flex-1 h-8 rounded-md border text-xs font-medium transition-all ${
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
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Sex</label>
                <div className="flex gap-1.5">
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
                        className={`flex-1 h-8 rounded-md border text-xs font-medium capitalize transition-all ${
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

            {/* Age, Weight, Height */}
            <div className={`grid gap-3 ${formData.unit === 'imperial' ? 'grid-cols-4' : 'grid-cols-3'}`}>
              <div>
                <label className="text-sm font-medium mb-2 block">Age</label>
                <input
                  type="number"
                  value={formData.age}
                  onChange={(e) => setFormData(prev => ({ ...prev, age: e.target.value }))}
                  placeholder="25"
                  className="w-full h-10 px-3 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Weight ({formData.unit === 'metric' ? 'kg' : 'lb'})
                </label>
                <input
                  type="number"
                  value={formData.weight}
                  onChange={(e) => setFormData(prev => ({ ...prev, weight: e.target.value }))}
                  placeholder={formData.unit === 'metric' ? '70' : '154'}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
              </div>
              {formData.unit === 'imperial' ? (
                <>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Height (ft)</label>
                    <input
                      type="number"
                      value={formData.heightFt}
                      onChange={(e) => setFormData(prev => ({ ...prev, heightFt: e.target.value }))}
                      placeholder="5"
                      className="w-full h-10 px-3 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Height (in)</label>
                    <input
                      type="number"
                      value={formData.heightIn}
                      onChange={(e) => setFormData(prev => ({ ...prev, heightIn: e.target.value }))}
                      placeholder="9"
                      className="w-full h-10 px-3 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="text-sm font-medium mb-2 block">Height (cm)</label>
                  <input
                    type="number"
                    value={formData.height}
                    onChange={(e) => setFormData(prev => ({ ...prev, height: e.target.value }))}
                    placeholder="175"
                    className="w-full h-10 px-3 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                </div>
              )}
            </div>

            {/* Activity Level */}
            <div>
              <label className="text-sm font-medium mb-2 block">Activity Level</label>
              <select
                value={formData.activityLevel}
                onChange={(e) => setFormData(prev => ({ ...prev, activityLevel: e.target.value as ActivityLevel }))}
                className="w-full h-10 px-3 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                <option value="sedentary">Sedentary (little or no exercise)</option>
                <option value="light">Light (1-3 days/week)</option>
                <option value="moderate">Moderate (3-5 days/week)</option>
                <option value="active">Active (6-7 days/week)</option>
                <option value="veryActive">Very Active (intense daily)</option>
              </select>
            </div>

            {/* Body Fat % */}
            <div>
              <label className="text-sm font-medium mb-2 block">Body Fat %</label>
              
              {/* Direct entry option */}
              <div 
                className={`flex items-center gap-3 min-w-0 p-2.5 rounded-lg border cursor-pointer transition-all mb-2 ${
                  formData.bodyFatMethod === 'direct' 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:bg-muted/50'
                }`}
                onClick={() => setFormData(prev => ({ ...prev, bodyFatMethod: 'direct' }))}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  formData.bodyFatMethod === 'direct' ? 'border-primary' : 'border-muted-foreground'
                }`}>
                  {formData.bodyFatMethod === 'direct' && (
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  )}
                </div>
                <span className="font-medium text-sm flex-shrink-0">Enter directly</span>
                {formData.bodyFatMethod === 'direct' && (
                  <input
                    type="number"
                    value={formData.bodyFatPercent}
                    onChange={(e) => setFormData(prev => ({ ...prev, bodyFatPercent: e.target.value }))}
                    placeholder="25"
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 min-w-0 h-8 px-2 rounded border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                )}
              </div>
              
              {/* US Navy method option */}
              <div 
                className={`flex items-center gap-3 min-w-0 p-2.5 rounded-lg border cursor-pointer transition-all mb-2 ${
                  formData.bodyFatMethod === 'navy' 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:bg-muted/50'
                }`}
                onClick={() => setFormData(prev => ({ ...prev, bodyFatMethod: 'navy' }))}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  formData.bodyFatMethod === 'navy' ? 'border-primary' : 'border-muted-foreground'
                }`}>
                  {formData.bodyFatMethod === 'navy' && (
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  )}
                </div>

                <span className="font-medium text-sm flex-shrink-0">US Navy</span>
                <span className="text-xs text-muted-foreground flex-shrink-0">({formData.unit === 'metric' ? 'cm' : 'in'})</span>

                {formData.bodyFatMethod === 'navy' && (
                  <div className="flex items-center gap-2 flex-1 min-w-0 justify-end" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="number"
                      value={formData.waist}
                      onChange={(e) => setFormData(prev => ({ ...prev, waist: e.target.value }))}
                      placeholder="Waist"
                      className="w-28 sm:w-32 h-8 px-2 rounded border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    />
                    <input
                      type="number"
                      value={formData.neck}
                      onChange={(e) => setFormData(prev => ({ ...prev, neck: e.target.value }))}
                      placeholder="Neck"
                      className="w-28 sm:w-32 h-8 px-2 rounded border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    />
                    {formData.sex === 'female' && (
                      <input
                        type="number"
                        value={formData.hip}
                        onChange={(e) => setFormData(prev => ({ ...prev, hip: e.target.value }))}
                        placeholder="Hip"
                        className="w-28 sm:w-32 h-8 px-2 rounded border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Goal */}
            <div>
              <label className="text-sm font-medium mb-2 block">Goal</label>
              <div className="flex gap-2 min-w-0">
                {([
                  { value: 'lose', label: 'Lose Weight' },
                  { value: 'maintain', label: 'Maintain' },
                  { value: 'gain', label: 'Gain Weight' },
                ] as const).map((goal) => (
                  <button
                    key={goal.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, goal: goal.value }))}
                    className={`flex-1 min-w-0 h-10 rounded-lg border-2 text-sm font-medium transition-all ${
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
              className="w-full" 
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
            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 rounded-xl border border-border bg-card">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Scale className="w-4 h-4 text-destructive" />
                  <span className="text-xs font-medium uppercase tracking-wide">Body Fat %</span>
                </div>
                <p className="text-3xl font-bold">{Math.round(bodyFatCalculated)}%</p>
              </div>
              
              <div className="p-4 rounded-xl border border-border bg-card">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <TrendingUp className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-medium uppercase tracking-wide">Fat Mass</span>
                </div>
                <p className="text-3xl font-bold">{fatMass.toFixed(1)} <span className="text-lg font-normal">lb</span></p>
                <p className="text-sm text-muted-foreground">({getWeightInKg(fatMass)} kg)</p>
              </div>
              
              <div className="p-4 rounded-xl border border-border bg-card">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Zap className="w-4 h-4 text-primary" />
                  <span className="text-xs font-medium uppercase tracking-wide">Lean Body Mass</span>
                </div>
                <p className="text-3xl font-bold">{leanBodyMass.toFixed(1)} <span className="text-lg font-normal">lb</span></p>
                <p className="text-sm text-muted-foreground">({getWeightInKg(leanBodyMass)} kg)</p>
              </div>
            </div>

            {/* Body Composition Cards - Row 2 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl border border-border bg-card">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Activity className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-medium uppercase tracking-wide">BMR</span>
                </div>
                <p className="text-3xl font-bold">{bmr} <span className="text-lg font-normal">cal/day</span></p>
                <p className="text-sm text-muted-foreground">Base metabolic rate</p>
              </div>
              
              <div className="p-4 rounded-xl border border-primary/30 bg-primary/5">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Flame className="w-4 h-4 text-primary" />
                  <span className="text-xs font-medium uppercase tracking-wide">TDEE</span>
                </div>
                <p className="text-3xl font-bold text-primary">{Math.round(tdee)} <span className="text-lg font-normal">cal/day</span></p>
                <p className="text-sm text-muted-foreground">Total daily energy expenditure</p>
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
            {/* Calorie Deficit Section - Dropdown Style */}
            <div className="p-3 rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-sm whitespace-nowrap">Calorie Deficit</h3>
                <div className="flex items-center gap-2 flex-1 justify-end">
                  <select
                    value={deficitType}
                    onChange={(e) => setDeficitType(e.target.value as DeficitType)}
                    className="h-7 px-2 rounded border border-border bg-background text-xs flex-1 max-w-[160px]"
                  >
                    <option value="standard">Standard (20%)</option>
                    <option value="custom_percent">Custom %</option>
                    <option value="custom_deficit_calories">Custom cal deficit</option>
                    <option value="custom_calories">Set calories</option>
                  </select>
                  {deficitType === 'custom_percent' && (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={customDeficitPercent}
                        onChange={(e) => setCustomDeficitPercent(Math.min(50, Math.max(5, parseInt(e.target.value) || 0)))}
                        className="w-12 h-7 px-1.5 rounded border border-border bg-background text-xs text-center"
                        min={5}
                        max={50}
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                  )}
                  {deficitType === 'custom_deficit_calories' && (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={customDeficitCalories}
                        onChange={(e) => setCustomDeficitCalories(e.target.value)}
                        placeholder="500"
                        className="w-14 h-7 px-1.5 rounded border border-border bg-background text-xs text-center"
                      />
                      <span className="text-xs text-muted-foreground">cal</span>
                    </div>
                  )}
                  {deficitType === 'custom_calories' && (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={customCalories}
                        onChange={(e) => setCustomCalories(e.target.value)}
                        placeholder={String(getTargetCalories())}
                        className="w-16 h-7 px-1.5 rounded border border-border bg-background text-xs text-center"
                      />
                      <span className="text-xs text-muted-foreground">cal</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Macro Distribution Section - Compact with Carbs bar */}
            <div className="p-3 rounded-xl border border-border bg-card">
              <h3 className="font-semibold text-sm mb-2">Macro Distribution</h3>
              
              {/* Protein Slider */}
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
                  className="w-full"
                />
              </div>

              {/* Carbs Slider - Adjustable */}
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
                  className="w-full"
                />
              </div>

              {/* Fat Slider - Adjustable */}
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
                  className="w-full"
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
              <Button size="sm" className="flex-1" onClick={handleContinueToDietary} disabled={!!warning}>
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === 'dietary' && (
          <div className="space-y-4 pt-2 overflow-y-auto max-h-[70vh]">
            <p className="text-sm text-muted-foreground">Diet Type</p>
            
            <div className="grid grid-cols-2 gap-2">
              {dietOptions.map((diet) => (
                <button
                  key={diet.value}
                  type="button"
                  onClick={() => setDietType(diet.value)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    dietType === diet.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/50'
                  } ${diet.value === 'mediterranean' ? 'col-span-1' : ''}`}
                >
                  <p className="font-semibold text-sm">{diet.label}</p>
                  <p className="text-xs text-muted-foreground">{diet.description}</p>
                </button>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button className="flex-1" onClick={handleContinueToResult}>
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === 'result' && (() => {
          const proteinCals = calculatedMacros.protein * 4;
          const carbsCals = calculatedMacros.carbs * 4;
          const fatCals = calculatedMacros.fat * 9;
          const totalCals = calculatedMacros.calories;
          
          const proteinPct = Math.round((proteinCals / totalCals) * 100);
          const carbsPct = Math.round((carbsCals / totalCals) * 100);
          const fatPct = 100 - proteinPct - carbsPct;
          
          const dailyDeficit = Math.round(tdee - totalCals);
          const weeklyDeficit = dailyDeficit * 7;
          const expectedLossPerWeek = (weeklyDeficit / 3500).toFixed(2); // 3500 cal = 1 lb
          
          return (
            <div className="space-y-4 pt-2 overflow-y-auto max-h-[85vh]">
              {/* Daily Targets Header */}
              <div className="bg-primary/5 rounded-2xl p-4">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <Flame className="w-5 h-5 text-primary" />
                  <span className="font-semibold text-foreground">Your Daily Targets</span>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-primary">
                    {totalCals.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground">calories per day</div>
                </div>
              </div>

              <h3 className="font-semibold text-lg">Macro Breakdown</h3>
              
              {/* Macro percentage bar */}
              <div className="flex h-8 rounded-full overflow-hidden">
                <div 
                  className="flex items-center justify-center text-white text-xs font-semibold"
                  style={{ width: `${proteinPct}%`, backgroundColor: '#3B82F6' }}
                >
                  {proteinPct}%
                </div>
                <div 
                  className="flex items-center justify-center text-white text-xs font-semibold"
                  style={{ width: `${carbsPct}%`, backgroundColor: '#F59E0B' }}
                >
                  {carbsPct}%
                </div>
                <div 
                  className="flex items-center justify-center text-white text-xs font-semibold"
                  style={{ width: `${fatPct}%`, backgroundColor: '#EC4899' }}
                >
                  {fatPct}%
                </div>
              </div>

              {/* Macro cards */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="h-1" style={{ backgroundColor: '#3B82F6' }} />
                  <div className="p-3 text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Protein</p>
                    <p className="text-xl font-bold">{calculatedMacros.protein}g</p>
                    <p className="text-xs text-muted-foreground">{proteinCals} cal</p>
                    <p className="text-xs font-medium" style={{ color: '#3B82F6' }}>{proteinPct}%</p>
                  </div>
                </div>
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="h-1" style={{ backgroundColor: '#F59E0B' }} />
                  <div className="p-3 text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Carbs</p>
                    <p className="text-xl font-bold">{calculatedMacros.carbs}g</p>
                    <p className="text-xs text-muted-foreground">{carbsCals} cal</p>
                    <p className="text-xs font-medium" style={{ color: '#F59E0B' }}>{carbsPct}%</p>
                  </div>
                </div>
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="h-1" style={{ backgroundColor: '#EC4899' }} />
                  <div className="p-3 text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Fat</p>
                    <p className="text-xl font-bold">{calculatedMacros.fat}g</p>
                    <p className="text-xs text-muted-foreground">{fatCals} cal</p>
                    <p className="text-xs font-medium" style={{ color: '#EC4899' }}>{fatPct}%</p>
                  </div>
                </div>
              </div>

              {/* Deficit cards */}
              {formData.goal !== 'maintain' && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-xl border border-border text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Daily {formData.goal === 'lose' ? 'Deficit' : 'Surplus'}</p>
                    <p className={`text-lg font-bold ${formData.goal === 'lose' ? 'text-destructive' : 'text-primary'}`}>
                      {formData.goal === 'lose' ? '-' : '+'}{Math.abs(dailyDeficit).toLocaleString()} cal
                    </p>
                  </div>
                  <div className="p-3 rounded-xl border border-border text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Weekly {formData.goal === 'lose' ? 'Deficit' : 'Surplus'}</p>
                    <p className={`text-lg font-bold ${formData.goal === 'lose' ? 'text-destructive' : 'text-primary'}`}>
                      {formData.goal === 'lose' ? '-' : '+'}{Math.abs(weeklyDeficit).toLocaleString()} cal
                    </p>
                  </div>
                </div>
              )}

              {/* Expected weight change */}
              {formData.goal !== 'maintain' && (
                <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center gap-2">
                  <span className="text-lg">📉</span>
                  <span className="text-sm font-medium">
                    Expected {formData.goal === 'lose' ? 'loss' : 'gain'}: <span className={formData.goal === 'lose' ? 'text-destructive' : 'text-primary'}>{formData.goal === 'lose' ? '-' : '+'}{Math.abs(parseFloat(expectedLossPerWeek))} lb/week</span>
                  </span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={handleBack}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button 
                  className="flex-1" 
                  onClick={handleApply}
                >
                  Apply These
                </Button>
              </div>
            </div>
          );
        })()}
      </DialogContent>
    </Dialog>
  );
}
