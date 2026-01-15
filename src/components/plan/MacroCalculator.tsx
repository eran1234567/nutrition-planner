import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Calculator, ArrowLeft, Utensils } from 'lucide-react';

interface MacroCalculatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (macros: { calories: number; protein: number; carbs: number; fat: number }) => void;
}

type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive';
type Goal = 'lose' | 'maintain' | 'gain';
type BodyFatMethod = 'direct' | 'navy';
type DietType = 'none' | 'vegetarian' | 'vegan' | 'pescatarian' | 'keto' | 'paleo' | 'mediterranean';
type DeficitType = 'standard' | 'custom_percent' | 'custom_calories';
type Step = 'input' | 'dietary' | 'distribution' | 'result';

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
  
  // Macro distribution sliders
  const [proteinPerLb, setProteinPerLb] = useState(1.0); // g per lb LBM
  const [fatPercent, setFatPercent] = useState(25); // % of calories

  const [tdee, setTdee] = useState(0);
  const [leanBodyMass, setLeanBodyMass] = useState(0); // in lbs
  
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

    let bmr: number;
    let lbm: number;
    
    if (bodyFat !== null && bodyFat > 0) {
      const leanMassKg = weight * (1 - bodyFat / 100);
      lbm = leanMassKg / 0.453592; // Convert to lbs
      bmr = 370 + 21.6 * leanMassKg;
    } else {
      if (formData.sex === 'male') {
        bmr = 10 * weight + 6.25 * height - 5 * age + 5;
      } else {
        bmr = 10 * weight + 6.25 * height - 5 * age - 161;
      }
      // Estimate LBM if no body fat provided (rough estimate: 75-80% of weight for males, 70-75% for females)
      const estimatedLeanPercent = formData.sex === 'male' ? 0.78 : 0.72;
      lbm = (parseFloat(formData.weight) || 0) * (formData.unit === 'imperial' ? estimatedLeanPercent : estimatedLeanPercent / 0.453592);
    }

    const calculatedTdee = bmr * activityMultipliers[formData.activityLevel];
    
    setTdee(calculatedTdee);
    setLeanBodyMass(lbm);
    
    return { tdee: calculatedTdee, lbm };
  };

  const handleCalculateClick = () => {
    calculateBaseTdee();
    setStep('dietary');
  };

  // When diet type changes, update defaults
  useEffect(() => {
    if (dietType === 'keto') {
      setProteinPerLb(0.8);
      setFatPercent(70);
    } else {
      setProteinPerLb(1.0);
      setFatPercent(25);
    }
  }, [dietType]);

  // Get protein slider range based on diet type
  const getProteinRange = () => {
    if (dietType === 'keto') {
      return { min: 0.6, max: 1.0, step: 0.1 };
    }
    return { min: 0.8, max: 1.4, step: 0.1 };
  };

  // Get fat slider range based on diet type
  const getFatRange = () => {
    if (dietType === 'keto') {
      return { min: 65, max: 80, step: 1 };
    }
    return { min: 20, max: 35, step: 1 };
  };

  // Calculate target calories based on deficit settings
  const getTargetCalories = () => {
    const baseMultiplier = goalMultipliers[formData.goal];
    
    if (deficitType === 'custom_calories' && customCalories) {
      return parseInt(customCalories);
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
    
    // Calculate fat
    const fatCalories = Math.round(targetCalories * (fatPercent / 100));
    const fatGrams = Math.round(fatCalories / 9);
    
    // Remaining goes to carbs
    const remainingCalories = targetCalories - proteinCalories - fatCalories;
    const carbGrams = Math.round(remainingCalories / 4);
    
    return {
      calories: targetCalories,
      protein: proteinGrams,
      carbs: Math.max(0, carbGrams),
      fat: fatGrams,
    };
  };

  // Check if macros are valid (don't exceed calories)
  const getMacroWarning = () => {
    const macros = calculateFinalMacros();
    const actualCalories = macros.protein * 4 + macros.carbs * 4 + macros.fat * 9;
    const targetCalories = getTargetCalories();
    
    if (macros.carbs < 0) {
      return 'Protein and fat exceed target calories. Reduce protein or fat percentage.';
    }
    
    if (dietType === 'keto' && macros.carbs > 50) {
      return `Net carbs (${macros.carbs}g) exceed keto limit. Consider reducing protein or increasing fat.`;
    }
    
    return null;
  };

  const handleContinueToDistribution = () => {
    setStep('distribution');
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
    if (step === 'dietary') setStep('input');
    else if (step === 'distribution') setStep('dietary');
    else if (step === 'result') setStep('distribution');
  };

  const isFormValid = formData.age && formData.weight && 
    (formData.unit === 'imperial' ? (formData.heightFt || formData.heightIn) : formData.height);

  const proteinRange = getProteinRange();
  const fatRange = getFatRange();
  const currentMacros = step === 'distribution' ? calculateFinalMacros() : calculatedMacros;
  const warning = step === 'distribution' ? getMacroWarning() : null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-xl max-h-[95vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 'dietary' ? (
              <>
                <Utensils className="w-5 h-5" />
                Dietary Style
              </>
            ) : (
              <>
                <Calculator className="w-5 h-5" />
                {t('macroCalculator.title', 'Macro Calculator')}
              </>
            )}
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
                  {(['male', 'female'] as const).map((sex) => (
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
                      {sex}
                    </button>
                  ))}
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
              Calculate
            </Button>
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
              <Button className="flex-1" onClick={handleContinueToDistribution}>
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === 'distribution' && (
          <div className="space-y-4 pt-2 overflow-y-auto max-h-[70vh]">
            {/* Calorie Deficit Section */}
            <div className="p-4 rounded-xl border border-border bg-card">
              <h3 className="font-semibold mb-3">Calorie Deficit</h3>
              
              <div className="space-y-2">
                <label 
                  className={`flex items-center gap-2 cursor-pointer ${deficitType === 'standard' ? 'text-foreground' : 'text-muted-foreground'}`}
                  onClick={() => setDeficitType('standard')}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    deficitType === 'standard' ? 'border-primary' : 'border-muted-foreground'
                  }`}>
                    {deficitType === 'standard' && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                  <span className="text-sm">Standard (20% deficit)</span>
                  <span className="text-xs text-muted-foreground">- Recommended</span>
                </label>
                
                <label 
                  className={`flex items-center gap-2 cursor-pointer ${deficitType === 'custom_percent' ? 'text-foreground' : 'text-muted-foreground'}`}
                  onClick={() => setDeficitType('custom_percent')}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    deficitType === 'custom_percent' ? 'border-primary' : 'border-muted-foreground'
                  }`}>
                    {deficitType === 'custom_percent' && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                  <span className="text-sm">Custom % deficit</span>
                  {deficitType === 'custom_percent' && (
                    <input
                      type="number"
                      value={customDeficitPercent}
                      onChange={(e) => setCustomDeficitPercent(parseInt(e.target.value) || 0)}
                      className="w-16 h-7 px-2 rounded border border-border bg-background text-sm"
                      min={5}
                      max={50}
                    />
                  )}
                </label>
                
                <label 
                  className={`flex items-center gap-2 cursor-pointer ${deficitType === 'custom_calories' ? 'text-foreground' : 'text-muted-foreground'}`}
                  onClick={() => setDeficitType('custom_calories')}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    deficitType === 'custom_calories' ? 'border-primary' : 'border-muted-foreground'
                  }`}>
                    {deficitType === 'custom_calories' && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                  <span className="text-sm">Custom daily calories</span>
                  {deficitType === 'custom_calories' && (
                    <input
                      type="number"
                      value={customCalories}
                      onChange={(e) => setCustomCalories(e.target.value)}
                      placeholder={String(getTargetCalories())}
                      className="w-20 h-7 px-2 rounded border border-border bg-background text-sm"
                    />
                  )}
                </label>
              </div>
            </div>

            {/* Macro Distribution Section */}
            <div className="p-4 rounded-xl border border-border bg-card">
              <h3 className="font-semibold mb-4">Macro Distribution</h3>
              
              {/* Protein Slider */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Protein: {proteinPerLb.toFixed(1)} g/lb LBM</span>
                  <span className="text-sm text-muted-foreground">~{currentMacros.protein}g</span>
                </div>
                <Slider
                  value={[proteinPerLb]}
                  onValueChange={([val]) => setProteinPerLb(val)}
                  min={proteinRange.min}
                  max={proteinRange.max}
                  step={proteinRange.step}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>{proteinRange.min} g/lb</span>
                  <span>{proteinRange.max} g/lb</span>
                </div>
              </div>

              {/* Fat Slider */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Fat: {fatPercent}% of calories</span>
                  <span className="text-sm text-muted-foreground">~{currentMacros.fat}g</span>
                </div>
                <Slider
                  value={[fatPercent]}
                  onValueChange={([val]) => setFatPercent(val)}
                  min={fatRange.min}
                  max={fatRange.max}
                  step={fatRange.step}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>{fatRange.min}%</span>
                  <span>{fatRange.max}%</span>
                </div>
              </div>

              {/* Carbs info */}
              <p className="text-sm text-muted-foreground">
                Remaining calories will be allocated to carbohydrates (~{currentMacros.carbs}g, {Math.round((currentMacros.carbs * 4 / currentMacros.calories) * 100)}%)
              </p>

              {/* Keto info */}
              {dietType === 'keto' && (
                <div className="mt-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-sm">
                    <span className="font-semibold">Keto:</span> Carbs are limited to 20-50g net carbs per day. Remaining calories after protein and fat are minimized.
                  </p>
                </div>
              )}

              {/* Warning */}
              {warning && (
                <div className="mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive">{warning}</p>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button className="flex-1" onClick={handleContinueToResult} disabled={!!warning}>
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === 'result' && (
          <div className="space-y-5 pt-2">
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-4">Your recommended daily targets:</p>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                  <p className="text-2xl font-bold text-primary">{calculatedMacros.calories}</p>
                  <p className="text-sm text-muted-foreground">Calories</p>
                </div>
                <div className="p-4 rounded-xl bg-muted border border-border">
                  <p className="text-2xl font-bold">{calculatedMacros.protein}g</p>
                  <p className="text-sm text-muted-foreground">Protein</p>
                </div>
                <div className="p-4 rounded-xl bg-muted border border-border">
                  <p className="text-2xl font-bold">{calculatedMacros.carbs}g</p>
                  <p className="text-sm text-muted-foreground">Carbs</p>
                </div>
                <div className="p-4 rounded-xl bg-muted border border-border">
                  <p className="text-2xl font-bold">{calculatedMacros.fat}g</p>
                  <p className="text-sm text-muted-foreground">Fat</p>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
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
        )}
      </DialogContent>
    </Dialog>
  );
}
