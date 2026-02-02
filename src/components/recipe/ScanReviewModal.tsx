import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Package, Flame, Drumstick, Droplet, Wheat, Minus, Plus, Pencil, Leaf, Cookie, Beef, Heart, FlaskConical, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export interface ScannedProduct {
  barcode?: string | null;
  name: string;
  servingSize?: string;
  servingQuantityGrams?: number | null;
  naturalUnit?: string;
  imageUrl?: string;
  // When true, imageUrl is an object URL that should be revoked when no longer needed
  imageObjectUrl?: boolean;
  nutritionPer?: string;
  fromPhoto?: boolean;
  nutrition: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    fiber?: number;
    sugar?: number;
    saturatedFat?: number;
    cholesterol?: number;
    sodium?: number;
  };
}

interface ScanReviewModalProps {
  open: boolean;
  product: ScannedProduct | null;
  onConfirm: (quantity: string, unit: string, nutrition: ScannedProduct['nutrition']) => void;
  onCancel: () => void;
}

export function ScanReviewModal({ open, product, onConfirm, onCancel }: ScanReviewModalProps) {
  const { t } = useTranslation();
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('serving');
  const [editableNutrition, setEditableNutrition] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
    saturatedFat: 0,
    cholesterol: 0,
    sodium: 0,
  });
  const [isEditingMacros, setIsEditingMacros] = useState(false);
  // When product lacks serving grams but has per-100g nutrition we will treat '1 serving' as the base unit.
  // If critical macros (carbs/fiber) are missing, require the user to fill them and persist that as an override.
  const [servingGramsInput, setServingGramsInput] = useState('');
  const [basePer100g, setBasePer100g] = useState<null | typeof editableNutrition>(null);
  const [requireManualMacros, setRequireManualMacros] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  // On-demand scanning state
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [lastParsed, setLastParsed] = useState<null | { calories?: number | null; carbs?: number | null; fiber?: number | null; sodium?: number | null; servingGrams?: number | null; rawText?: string | null }>(null);

  // Reset state when product changes
  useEffect(() => {
    if (product) {
      setQuantity('1');
      // If the product lacks serving grams, treat '1 serving' as the base unit (do not auto-scale from 100g)
      const hasGramServing = !!product.servingQuantityGrams;
      setUnit(product.naturalUnit || (hasGramServing ? 'serving' : 'serving'));

      const isPer100gNoServings = product.nutritionPer === '100g' && !product.servingQuantityGrams;

      const baseValues = isPer100gNoServings ? {
        calories: product.nutrition.calories || 0,
        protein: product.nutrition.protein || 0,
        carbs: product.nutrition.carbs || 0,
        fat: product.nutrition.fat || 0,
        fiber: product.nutrition.fiber || 0,
        sugar: product.nutrition.sugar || 0,
        saturatedFat: product.nutrition.saturatedFat || 0,
        cholesterol: product.nutrition.cholesterol || 0,
        sodium: product.nutrition.sodium || 0,
      } : null;

      setBasePer100g(baseValues);

      // Initialize editable nutrition. If the product had per-100g values and no serving grams, DO NOT auto-convert — treat them as "per serving" values and require manual confirmation if critical fields missing.
      setEditableNutrition({
        calories: isPer100gNoServings ? (baseValues?.calories ?? 0) : (product.nutrition.calories || 0),
        protein: isPer100gNoServings ? (baseValues?.protein ?? 0) : (product.nutrition.protein || 0),
        carbs: isPer100gNoServings ? (baseValues?.carbs ?? 0) : ((product as any).nutrition?.carbohydrates ?? product.nutrition.carbs ?? 0),
        fat: isPer100gNoServings ? (baseValues?.fat ?? 0) : (product.nutrition.fat || 0),
        fiber: isPer100gNoServings ? (baseValues?.fiber ?? 0) : (product.nutrition.fiber || 0),
        sugar: isPer100gNoServings ? (baseValues?.sugar ?? 0) : ((product as any).nutrition?.sugars ?? product.nutrition.sugar ?? 0),
        saturatedFat: isPer100gNoServings ? (baseValues?.saturatedFat ?? 0) : (product.nutrition['saturated-fat'] || 0),
        cholesterol: isPer100gNoServings ? (baseValues?.cholesterol ?? 0) : (product.nutrition.cholesterol || 0),
        sodium: isPer100gNoServings ? (baseValues?.sodium ?? 0) : (product.nutrition.sodium || 0),
      });

      // If critical macros are missing and there is no serving grams, require manual entry before confirming
      const carbsMissing = !(product.nutrition.carbs ?? (product as any).nutrition?.carbohydrates);
      if (!hasGramServing && (carbsMissing || !product.nutrition.fiber)) {
        setRequireManualMacros(true);
      } else {
        setRequireManualMacros(false);
      }

      setServingGramsInput('');
      setIsEditingMacros(false);
    }

    // Revoke object URL for previous product on change/unmount to free memory
    return () => {
      try {
        if (product?.imageObjectUrl && product.imageUrl) {
          URL.revokeObjectURL(product.imageUrl);
        }
      } catch (err) {
        // ignore
      }
    };
  }, [product]);



  if (!open || !product) return null;

  const handleConfirm = async () => {
    // If manual macros are required (no serving grams & missing carbs/fiber), validate inputs
    if (requireManualMacros) {
      if (!editableNutrition.carbs || !editableNutrition.fiber) {
        setManualError(t('recipes.missingMacrosError', 'Carbs and fiber are required for this product.'));
        return;
      }
    }

    // Note: barcode overrides feature removed - nutrition is now persisted via recipe_nutrition table

    onConfirm(quantity, unit, editableNutrition);
    // Reset for next scan
    setQuantity('1');
    setUnit('serving');
    setIsEditingMacros(false);
    setManualError(null);
  };

  const incrementQuantity = () => {
    const current = parseFloat(quantity) || 0;
    setQuantity(String(current + 1));
  };

  const decrementQuantity = () => {
    const current = parseFloat(quantity) || 0;
    if (current > 1) {
      setQuantity(String(current - 1));
    }
  };

  // On-demand scan of the product image (light/timed OCR)
  const scanImageText = async () => {
    if (!product?.imageUrl) return;
    setIsScanning(true);
    setScanError(null);
    setLastParsed(null);
    try {
      const { parseNutritionFromNutritionImage } = await import('@/lib/labelParser');
      const parsed = await parseNutritionFromNutritionImage(product.imageUrl, 4000);

      if (!parsed) {
        setScanError(t('recipes.scanEmpty', 'No text found on the image.'));
        toast(t('recipes.scanFailed', 'Could not extract numbers from the image.'));
        setIsScanning(false);
        return;
      }

      // Keep the raw parsed result for visibility and debugging
      setLastParsed(parsed as any);

      // If OCR found text but no numeric macros, surface that to the user instead of giving a false "success"
      const hasNumber = [parsed.calories, parsed.carbs, parsed.fiber, parsed.sodium, parsed.servingGrams].some(v => v !== null && v !== undefined);
      if (!hasNumber) {
        setScanError(t('recipes.scanNoNumbers', 'OCR found text on the image but no numeric values.'));
        toast(t('recipes.scanNoNumbers', 'OCR found text but no numbers. You can edit manually.'));
        setIsScanning(false);
        return;
      }

      // Merge parsed numeric values into the editable nutrition
      setEditableNutrition(prev => ({
        ...prev,
        calories: parsed.calories ?? prev.calories,
        carbs: parsed.carbs ?? prev.carbs,
        fiber: parsed.fiber ?? prev.fiber,
        sodium: parsed.sodium ?? prev.sodium,
      }));

      // Update serving grams if found
      if (parsed.servingGrams != null) {
        setServingGramsInput(String(parsed.servingGrams));
      }

      if (parsed.carbs != null && parsed.fiber != null) setRequireManualMacros(false);
      toast(t('recipes.scanSuccess', 'Extracted nutrition from image'));
    } catch (err) {
      setScanError(t('recipes.scanFailed', 'Could not extract numbers from the image.'));
      toast(t('recipes.scanFailed', 'Could not extract numbers from the image.'));
    } finally {
      setIsScanning(false);
    }
  };

  const updateNutritionField = (field: keyof typeof editableNutrition, value: string) => {
    const numValue = parseFloat(value) || 0;
    setEditableNutrition(prev => ({ ...prev, [field]: numValue }));
  };

  const qtyNum = parseFloat(quantity) || 1;

  const formatMacro = (field: keyof typeof editableNutrition, value: number) => {
    if (!Number.isFinite(value)) return '0';
    if (field === 'calories') return String(Math.round(value));
    // mg fields (cholesterol, sodium) - show as integers
    if (field === 'cholesterol' || field === 'sodium') return String(Math.round(value));
    // Avoid “rounding up” small values into 1g (e.g. 0.6g -> 1g)
    const rounded = Math.round(value * 10) / 10;
    const normalized = rounded < 0.05 ? 0 : rounded;
    return normalized % 1 === 0 ? normalized.toFixed(0) : normalized.toFixed(1);
  };

  // Primary macros (always visible)
  const primaryMacros = [
    { 
      icon: Flame, 
      label: 'Cal', 
      field: 'calories' as const, 
      value: editableNutrition.calories * qtyNum, 
      baseValue: editableNutrition.calories,
      color: 'text-orange-500' 
    },
    { 
      icon: Drumstick, 
      label: 'Protein', 
      field: 'protein' as const, 
      value: editableNutrition.protein * qtyNum, 
      baseValue: editableNutrition.protein,
      suffix: 'g', 
      color: 'text-red-500' 
    },
    { 
      icon: Droplet, 
      label: 'Fat', 
      field: 'fat' as const, 
      value: editableNutrition.fat * qtyNum, 
      baseValue: editableNutrition.fat,
      suffix: 'g', 
      color: 'text-yellow-500' 
    },
    { 
      icon: Wheat, 
      label: 'Carbs', 
      field: 'carbs' as const, 
      value: editableNutrition.carbs * qtyNum, 
      baseValue: editableNutrition.carbs,
      suffix: 'g', 
      color: 'text-blue-500' 
    },
  ];

  // Secondary nutrients (fiber, sugar, sat fat, cholesterol, sodium)
  const secondaryMacros = [
    { 
      icon: Leaf, 
      label: 'Fiber', 
      field: 'fiber' as const, 
      value: editableNutrition.fiber * qtyNum, 
      baseValue: editableNutrition.fiber,
      suffix: 'g', 
      color: 'text-green-500' 
    },
    { 
      icon: Cookie, 
      label: 'Sugar', 
      field: 'sugar' as const, 
      value: editableNutrition.sugar * qtyNum, 
      baseValue: editableNutrition.sugar,
      suffix: 'g', 
      color: 'text-pink-500' 
    },
    { 
      icon: Beef, 
      label: 'Sat Fat', 
      field: 'saturatedFat' as const, 
      value: editableNutrition.saturatedFat * qtyNum, 
      baseValue: editableNutrition.saturatedFat,
      suffix: 'g', 
      color: 'text-amber-600' 
    },
    { 
      icon: Heart, 
      label: 'Chol', 
      field: 'cholesterol' as const, 
      value: editableNutrition.cholesterol * qtyNum, 
      baseValue: editableNutrition.cholesterol,
      suffix: 'mg', 
      color: 'text-rose-500' 
    },
    { 
      icon: FlaskConical, 
      label: 'Sodium', 
      field: 'sodium' as const, 
      value: editableNutrition.sodium * qtyNum, 
      baseValue: editableNutrition.sodium,
      suffix: 'mg', 
      color: 'text-purple-500' 
    },
  ];

  // Show net carbs in keto context
  const netCarbs = Math.max(0, editableNutrition.carbs - editableNutrition.fiber) * qtyNum;

  return (
    <>


      <AnimatePresence>
        {open && product && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
            onClick={onCancel}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-md bg-background rounded-t-2xl p-6 space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Product thumbnail */}
                  <div className="w-16 h-16 rounded-xl bg-muted/50 border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
                    <Package className="w-7 h-7 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">{t('recipes.productFound', 'Product Found')}</p>
                    <h3 className="font-semibold text-lg leading-tight line-clamp-2">{product.name}</h3>
                  </div>
                </div>
                <button
                  onClick={onCancel}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Serving info */}
              {product.servingSize && (
                <p className="text-sm text-muted-foreground">
                  {t('recipes.servingSize', 'Serving size')}: {product.servingSize}
                  {product.servingQuantityGrams && (
                    <span className="text-xs ml-1">({product.servingQuantityGrams}g)</span>
                  )}
                </p>
              )}

              {/* If nutrition is only available per 100g and no serving grams are present, we treat 1 serving as the base unit.
                  We no longer auto-convert; if critical macros (carbs/fiber) are missing, require manual entry and persist as an override. */}
              {basePer100g && !product.servingQuantityGrams && (
                <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
                  <p className="font-medium">{t('recipes.nutritionNoServing', 'Nutrition is provided per 100g and no serving weight was found. We assume 1 serving as the base unit.')}</p>
                  <p className="text-xs mt-1">{t('recipes.nutritionNoServingHint', 'If critical fields like carbs or fiber are missing, please enter them below. We will remember them for future scans of this barcode.')}</p>

                  {requireManualMacros && (
                    <div className="mt-3 space-y-2">
                      <p className="text-sm font-medium text-rose-700">{t('recipes.enterMissingMacros', 'Please enter missing carbs and fiber (per serving)')}</p>
                      <div className="flex gap-2 items-center">
                        <Input
                          type="number"
                          value={String(editableNutrition.carbs)}
                          onChange={(e) => updateNutritionField('carbs', e.target.value)}
                          placeholder={t('recipes.carbsPlaceholder', 'Carbs (g)')}
                          className="w-24"
                          min="0"
                          step="0.1"
                        />
                        <Input
                          type="number"
                          value={String(editableNutrition.fiber)}
                          onChange={(e) => updateNutritionField('fiber', e.target.value)}
                          placeholder={t('recipes.fiberPlaceholder', 'Fiber (g)')}
                          className="w-24"
                          min="0"
                          step="0.1"
                        />
                        <div className="text-sm text-rose-700">{manualError}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Quantity selector */}
              <div className="space-y-2">
                <Label className="text-sm">{t('recipes.quantity', 'Quantity')}</Label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={decrementQuantity}
                    className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <Input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-20 text-center text-lg font-semibold"
                    min="0.5"
                    step="0.5"
                  />
                  <button
                    type="button"
                    onClick={incrementQuantity}
                    className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <Input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="serving"
                    className="flex-1"
                  />
                </div>
              </div>

              {/* Live nutrition preview - Editable */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">{basePer100g && unit === '100g' ? t('recipes.nutritionPer100g', 'Nutrition per 100g') : t('recipes.nutritionPerServing', 'Nutrition per serving')}</Label>
                  <button
                    type="button"
                    onClick={() => setIsEditingMacros(!isEditingMacros)}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    <Pencil className="w-3 h-3" />
                    {isEditingMacros ? t('common.done', 'Done') : t('common.edit', 'Edit')}
                  </button>
                </div>
                
                {/* Primary macros row */}
                <div className="grid grid-cols-4 gap-2 p-3 rounded-xl bg-muted/50">
                  {primaryMacros.map(({ icon: Icon, label, field, value, baseValue, suffix = '', color }) => (
                    <div key={label} className="text-center">
                      <Icon className={`w-4 h-4 mx-auto mb-1 ${color}`} />
                      {isEditingMacros ? (
                        <Input
                          type="number"
                          value={baseValue}
                          onChange={(e) => updateNutritionField(field, e.target.value)}
                          className="h-7 text-xs text-center px-1 font-bold"
                          min="0"
                          step="0.1"
                        />
                      ) : (
                        <p className={`text-sm font-bold ${color}`}>
                          {formatMacro(field, value)}{suffix}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Net carbs hint for keto */}
                {editableNutrition.fiber > 0 && !isEditingMacros && (
                  <p className="text-xs text-center text-green-600 font-medium">
                    {t('recipes.netCarbs', 'Net Carbs')}: {formatMacro('carbs', netCarbs)}g
                  </p>
                )}
                
                {/* Secondary nutrients row */}
                <div className="grid grid-cols-5 gap-1.5 p-2 rounded-lg bg-muted/30">
                  {secondaryMacros.map(({ icon: Icon, label, field, value, baseValue, suffix = '', color }) => (
                    <div key={label} className="text-center">
                      <Icon className={`w-3 h-3 mx-auto mb-0.5 ${color}`} />
                      {isEditingMacros ? (
                        <Input
                          type="number"
                          value={baseValue}
                          onChange={(e) => updateNutritionField(field, e.target.value)}
                          className="h-6 text-[10px] text-center px-0.5 font-bold"
                          min="0"
                          step="0.1"
                        />
                      ) : (
                        <p className={`text-[10px] font-bold ${color}`}>
                          {formatMacro(field, value)}{suffix}
                        </p>
                      )}
                      <p className="text-[8px] text-muted-foreground truncate">{label}</p>
                    </div>
                  ))}
                </div>
                
                {qtyNum > 1 && !isEditingMacros && (
                  <p className="text-xs text-center text-muted-foreground">
                    {t('recipes.totalFor', 'Total for')} {qtyNum} {unit}
                  </p>
                )}

                {/* Show OCR result / raw text for debugging and user visibility */}
                {lastParsed && (
                  <div className="mt-3 rounded-lg bg-muted/40 p-3 text-sm">
                    {!lastParsed.calories && !lastParsed.carbs && !lastParsed.fiber && !lastParsed.sodium ? (
                      <>
                        <p className="font-medium">{t('recipes.ocrResultTitle', 'Scanned text')}</p>
                        <p className="text-xs text-muted-foreground mt-1">{t('recipes.scanNoNumbersHint', 'Text was found but no numeric values could be parsed. Below is the raw OCR text.')}</p>
                        <pre className="mt-2 text-[11px] whitespace-pre-wrap text-muted-foreground">{String(lastParsed.rawText || '').trim()}</pre>
                      </>
                    ) : (
                      <p className="text-xs text-success font-medium">{t('recipes.scanFoundNumbers', '✓ Scanned and populated nutrition values')}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={onCancel}
                >
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button
                  className="flex-1 gradient-primary gap-2"
                  onClick={handleConfirm}
                >
                  <Check className="w-4 h-4" />
                  {t('recipes.addToRecipe', 'Add to Recipe')}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
