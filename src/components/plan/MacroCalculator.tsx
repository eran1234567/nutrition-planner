import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calculator, ArrowLeft } from 'lucide-react';

interface MacroCalculatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (macros: { calories: number; protein: number; carbs: number; fat: number }) => void;
}

type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive';
type Goal = 'lose' | 'maintain' | 'gain';
type BodyFatMethod = 'direct' | 'navy';

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

export function MacroCalculator({ open, onOpenChange, onApply }: MacroCalculatorProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<'input' | 'result'>('input');
  
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
    hip: '', // For females only in Navy method
  });

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

    // Get height based on unit
    if (formData.unit === 'imperial') {
      const ft = parseFloat(formData.heightFt) || 0;
      const inches = parseFloat(formData.heightIn) || 0;
      height = (ft * 12 + inches) * 2.54;
    } else {
      height = parseFloat(formData.height);
    }

    if (!waist || !neck || !height) return null;
    if (formData.sex === 'female' && !hip) return null;

    // Convert to cm if imperial
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

    return Math.max(0, Math.min(60, bodyFat)); // Clamp between 0-60%
  };

  const calculateMacros = () => {
    const age = parseInt(formData.age);
    let weight = parseFloat(formData.weight);
    let height: number;

    // Get height based on unit
    if (formData.unit === 'imperial') {
      const ft = parseFloat(formData.heightFt) || 0;
      const inches = parseFloat(formData.heightIn) || 0;
      height = (ft * 12 + inches) * 2.54; // Convert total inches to cm
      weight = weight * 0.453592; // lbs to kg
    } else {
      height = parseFloat(formData.height);
    }

    // Get body fat percentage
    let bodyFat: number | null = null;
    if (formData.bodyFatMethod === 'direct' && formData.bodyFatPercent) {
      bodyFat = parseFloat(formData.bodyFatPercent);
    } else if (formData.bodyFatMethod === 'navy') {
      bodyFat = calculateNavyBodyFat();
    }

    // Calculate BMR using Katch-McArdle if body fat is available, otherwise Mifflin-St Jeor
    let bmr: number;
    if (bodyFat !== null && bodyFat > 0) {
      // Katch-McArdle formula (more accurate with body fat)
      const leanMass = weight * (1 - bodyFat / 100);
      bmr = 370 + 21.6 * leanMass;
    } else {
      // Mifflin-St Jeor Equation
      if (formData.sex === 'male') {
        bmr = 10 * weight + 6.25 * height - 5 * age + 5;
      } else {
        bmr = 10 * weight + 6.25 * height - 5 * age - 161;
      }
    }

    // Calculate TDEE
    const tdee = bmr * activityMultipliers[formData.activityLevel];
    
    // Apply goal modifier
    const targetCalories = Math.round(tdee * goalMultipliers[formData.goal]);

    // Calculate macros (standard split: 30% protein, 40% carbs, 30% fat)
    const proteinCalories = targetCalories * 0.3;
    const carbCalories = targetCalories * 0.4;
    const fatCalories = targetCalories * 0.3;

    const macros = {
      calories: targetCalories,
      protein: Math.round(proteinCalories / 4), // 4 cal per gram
      carbs: Math.round(carbCalories / 4), // 4 cal per gram
      fat: Math.round(fatCalories / 9), // 9 cal per gram
    };

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

  const isFormValid = formData.age && formData.weight && 
    (formData.unit === 'imperial' ? (formData.heightFt || formData.heightIn) : formData.height);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[95vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            {t('macroCalculator.title', 'Macro Calculator')}
          </DialogTitle>
        </DialogHeader>

        {step === 'input' ? (
          <div className="space-y-5 pt-2">
            <p className="text-sm text-muted-foreground">
              {t('macroCalculator.description', 'Enter your details to calculate your recommended daily macros.')}
            </p>

            {/* Unit Toggle - Imperial first (left), Metric second (right) */}
            <div className="flex gap-2">
              {(['imperial', 'metric'] as const).map((unit) => (
                <button
                  key={unit}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, unit }))}
                  className={`flex-1 h-10 rounded-lg border-2 text-sm font-medium transition-all ${
                    formData.unit === unit
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card hover:bg-muted'
                  }`}
                >
                  {unit === 'imperial' ? 'Imperial (lb/in)' : 'Metric (kg/cm)'}
                </button>
              ))}
            </div>

            {/* Sex */}
            <div>
              <label className="text-sm font-medium mb-2 block">Sex</label>
              <div className="flex gap-2">
                {(['male', 'female'] as const).map((sex) => (
                  <button
                    key={sex}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, sex }))}
                    className={`flex-1 h-10 rounded-lg border-2 text-sm font-medium capitalize transition-all ${
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
                className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all mb-2 ${
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
                    className="flex-1 h-8 px-2 rounded border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                )}
              </div>
              
              {/* US Navy method option */}
              <div 
                className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                  formData.bodyFatMethod === 'navy' 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:bg-muted/50'
                }`}
                onClick={() => setFormData(prev => ({ ...prev, bodyFatMethod: 'navy' }))}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    formData.bodyFatMethod === 'navy' ? 'border-primary' : 'border-muted-foreground'
                  }`}>
                    {formData.bodyFatMethod === 'navy' && (
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <span className="font-medium text-sm flex-shrink-0">US Navy</span>
                  {formData.bodyFatMethod === 'navy' && (
                    <div className="flex-1 flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="number"
                        value={formData.waist}
                        onChange={(e) => setFormData(prev => ({ ...prev, waist: e.target.value }))}
                        placeholder="Waist"
                        className="flex-1 min-w-0 h-8 px-2 rounded border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                      />
                      <input
                        type="number"
                        value={formData.neck}
                        onChange={(e) => setFormData(prev => ({ ...prev, neck: e.target.value }))}
                        placeholder="Neck"
                        className="flex-1 min-w-0 h-8 px-2 rounded border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                      />
                      {formData.sex === 'female' && (
                        <input
                          type="number"
                          value={formData.hip}
                          onChange={(e) => setFormData(prev => ({ ...prev, hip: e.target.value }))}
                          placeholder="Hip"
                          className="flex-1 min-w-0 h-8 px-2 rounded border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                        />
                      )}
                      <span className="text-xs text-muted-foreground self-center flex-shrink-0">({formData.unit === 'metric' ? 'cm' : 'in'})</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Goal */}
            <div>
              <label className="text-sm font-medium mb-2 block">Goal</label>
              <div className="flex gap-2">
                {([
                  { value: 'lose', label: 'Lose Weight' },
                  { value: 'maintain', label: 'Maintain' },
                  { value: 'gain', label: 'Gain Weight' },
                ] as const).map((goal) => (
                  <button
                    key={goal.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, goal: goal.value }))}
                    className={`flex-1 h-10 rounded-lg border-2 text-sm font-medium transition-all ${
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
              onClick={calculateMacros}
              disabled={!isFormValid}
            >
              Calculate
            </Button>
          </div>
        ) : (
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
                onClick={() => setStep('input')}
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
