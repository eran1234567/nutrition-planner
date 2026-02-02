import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X, Camera, ScanBarcode, Loader2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BarcodeScanner } from './BarcodeScanner';
import { ScanReviewModal, ScannedProduct } from './ScanReviewModal';
import { toast } from 'sonner';
import { motion, AnimatePresence, Reorder } from 'framer-motion';

export interface IngredientItem {
  id: string;
  name: string;
  quantity: string;
  unit: string;
  barcode?: string;
  nutrition?: {
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

interface IngredientInputProps {
  ingredients: IngredientItem[];
  onChange: (ingredients: IngredientItem[]) => void;
}

export function IngredientInput({ ingredients, onChange }: IngredientInputProps) {
  const { t } = useTranslation();
  const [showScanner, setShowScanner] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<ScannedProduct | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const lookupSeqRef = useRef(0);
  const activeLookupAbortRef = useRef<AbortController | null>(null);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  const addIngredient = () => {
    onChange([
      ...ingredients,
      { id: generateId(), name: '', quantity: '', unit: '' }
    ]);
  };

  const updateIngredient = (id: string, field: keyof IngredientItem, value: string) => {
    onChange(
      ingredients.map(ing => 
        ing.id === id ? { ...ing, [field]: value } : ing
      )
    );
  };

  const removeIngredient = (id: string) => {
    onChange(ingredients.filter(ing => ing.id !== id));
  };

  const handleBarcodeScan = async (barcode: string, format: string) => {
    // New scan = invalidate any previous pending lookup
    const lookupId = ++lookupSeqRef.current;

    // Cancel any previous request (mobile Safari can leave fetch hanging)
    try {
      activeLookupAbortRef.current?.abort();
    } catch {
      // ignore
    }

    const controller = new AbortController();
    activeLookupAbortRef.current = controller;

    const isCurrent = () => lookupSeqRef.current === lookupId;
    const safeSetPendingProduct = (p: ScannedProduct | null) => {
      if (isCurrent()) setPendingProduct(p);
    };
    const safeStopSpinner = () => {
      if (isCurrent()) setIsLookingUp(false);
    };

    setIsLookingUp(true);
    setShowScanner(false);

    // Hard timeout fallback: always clear UI even if fetch never resolves
    let didHardTimeout = false;
    const hardTimeout = setTimeout(() => {
      if (!isCurrent()) return;
      didHardTimeout = true;
      try {
        controller.abort();
      } catch {
        // ignore
      }
      safeStopSpinner();
      toast.error(t('recipes.lookupTimeout', 'Lookup timed out. Enter details manually.'));
      // Provide manual review modal even when lookup fails
      safeSetPendingProduct({
        barcode,
        name: `Scanned item (${barcode})`,
        naturalUnit: 'serving',
        nutrition: {},
      });
    }, 12000);

    try {
      // Look up product info from Open Food Facts API
      const response = await fetch(
        `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
        { signal: controller.signal },
      );

      const data = await response.json();

      if (data.status === 1 && data.product) {
        const product = data.product;
        const nutriments = product.nutriments || {};

        // Hard-coded exceptions map for known barcodes where OpenFoodFacts lacks serving grams
        const HARDCODED_BARCODE_NUTRITION: Record<string, { servingQuantityGrams: number; nutrition: NonNullable<ScannedProduct['nutrition']> }> = {
          // Meta Mucil Premium Blend - serving 11.7g: 11g carbs, 6g fiber, ~30 kcal, ~10 mg sodium
          '0030772047552': { servingQuantityGrams: 11.7, nutrition: { calories: 30, protein: 0, carbs: 11, fat: 0, fiber: 6, sugar: 0, saturatedFat: 0, cholesterol: 0, sodium: 10 } },
          '030772047552': { servingQuantityGrams: 11.7, nutrition: { calories: 30, protein: 0, carbs: 11, fat: 0, fiber: 6, sugar: 0, saturatedFat: 0, cholesterol: 0, sodium: 10 } },
          // Common UPC variants - include shorter forms just in case
          '30772047552': { servingQuantityGrams: 11.7, nutrition: { calories: 30, protein: 0, carbs: 11, fat: 0, fiber: 6, sugar: 0, saturatedFat: 0, cholesterol: 0, sodium: 10 } },
          '3077204755': { servingQuantityGrams: 11.7, nutrition: { calories: 30, protein: 0, carbs: 11, fat: 0, fiber: 6, sugar: 0, saturatedFat: 0, cholesterol: 0, sodium: 10 } },
        };

        // Parse serving quantity - API may return string or number
        const parseNumber = (val: unknown): number | null => {
          if (val === null || val === undefined) return null;
          const num = typeof val === 'string' ? parseFloat(val.replace(',', '.')) : Number(val);
          return isNaN(num) ? null : num;
        };

        // Parse natural unit early (possible small string like "2 Rounded Teaspoons (11.7g)")
        let naturalUnit = 'serving';
        const servingSizeRaw = product.serving_size || '';
        if (servingSizeRaw) {
          const withoutWeight = servingSizeRaw.replace(/\s*\([^)]*g?\)/gi, '').trim();
          if (withoutWeight) naturalUnit = withoutWeight;
        }

        // If we have a hard-coded entry for this barcode (or a normalized variant), use it and skip scaling logic
        const normalizedBarcode = barcode.replace(/[^0-9]/g, '').replace(/^0+/, '') || barcode.replace(/[^0-9]/g, '');
        const hardKey = HARDCODED_BARCODE_NUTRITION[barcode] ? barcode : HARDCODED_BARCODE_NUTRITION[normalizedBarcode] ? normalizedBarcode : null;
        if (hardKey) {
          const entry = HARDCODED_BARCODE_NUTRITION[hardKey];
          console.log('[Barcode] Using hard-coded nutrition for barcode:', barcode, entry);

          const imageUrl = product.image_front_small_url || product.image_front_url || product.image_small_url || product.image_url || null;

          safeSetPendingProduct({
            barcode,
            name: product.product_name || product.generic_name || barcode,
            servingSize: product.serving_size,
            imageUrl,
            servingQuantityGrams: entry.servingQuantityGrams,
            naturalUnit,
            nutritionPer: product.nutrition_data_per,
            nutrition: entry.nutrition,
          } as ScannedProduct);

          // Skip the rest of the parsing and OCR
          safeStopSpinner();
          clearTimeout(hardTimeout);
          return;
        }
        
        console.log('[Barcode] Raw API response:', { 
          serving_quantity: product.serving_quantity,
          serving_size: product.serving_size,
          nutriments_sample: {
            'energy-kcal_100g': nutriments['energy-kcal_100g'],
            'energy-kcal_serving': nutriments['energy-kcal_serving'],
            'proteins_100g': nutriments['proteins_100g'],
            'fat_100g': nutriments['fat_100g'],
            'carbohydrates_100g': nutriments['carbohydrates_100g'],
            'fiber_100g': nutriments['fiber_100g'],
            'sugars_100g': nutriments['sugars_100g'],
            'saturated-fat_100g': nutriments['saturated-fat_100g'],
            'cholesterol_100g': nutriments['cholesterol_100g'],
            'sodium_100g': nutriments['sodium_100g'],
          }
        });
        
        // Extract serving quantity in grams
        let servingQuantityGrams = parseNumber(product.serving_quantity);
        
        // Fallback: try to parse from serving_size string (e.g., "2 Rounded Teaspoons (11.7g)")
        if (!servingQuantityGrams && product.serving_size) {
          // Try patterns like "(11.7g)", "(11.7 g)", "11.7g"
          const gramsMatch = product.serving_size.match(/(\d+(?:[.,]\d+)?)\s*g(?:\)|$|\s)/i);
          if (gramsMatch) {
            servingQuantityGrams = parseNumber(gramsMatch[1]);
            console.log('[Barcode] Extracted serving grams from string:', servingQuantityGrams);
          }
        }
        
        // Helper to get calories (try kcal first, then convert from kJ)
        const getCalories100g = (): number | null => {
          // energy-kcal_100g may sometimes actually contain kJ values (data errors).
          const kcalRaw = nutriments['energy-kcal_100g'];
          const kcalParsed = parseNumber(kcalRaw);
          if (kcalParsed !== null) {
            // If the value is unusually large, assume it's kJ and convert to kcal
            if (kcalParsed > 1000) return Math.round(kcalParsed / 4.184);
            return kcalParsed;
          }

          const kj = parseNumber(nutriments['energy_100g'] ?? nutriments['energy-kj_100g']);
          return kj ? Math.round(kj / 4.184) : null;
        };

        const getCaloriesServing = (): number | null => {
          // Prefer explicit per-serving kcal fields. Do NOT treat bare 'energy-kcal' as per-serving
          // unless the product explicitly indicates nutrition is provided per-serving.
          const kcalServingRaw = nutriments['energy-kcal_serving'];
          const kcalParsedServing = parseNumber(kcalServingRaw);
          if (kcalParsedServing !== null) {
            if (kcalParsedServing > 1000) return Math.round(kcalParsedServing / 4.184);
            return kcalParsedServing;
          }

          // If the product explicitly uses per-serving nutrition, a bare 'energy-kcal' may be per-serving.
          const bareKcalRaw = product.nutrition_data_per === 'serving' ? nutriments['energy-kcal'] : null;
          const kcalParsedBare = parseNumber(bareKcalRaw);
          if (kcalParsedBare !== null) {
            if (kcalParsedBare > 1000) return Math.round(kcalParsedBare / 4.184);
            return kcalParsedBare;
          }

          const kj = parseNumber(nutriments['energy_serving'] ?? nutriments['energy-kj_serving']);
          return kj ? Math.round(kj / 4.184) : null;
        };
        
        // Check if per-serving data is available
        const caloriesServing = getCaloriesServing();
        const proteinServing = parseNumber(nutriments['proteins_serving']);
        const carbsServing = parseNumber(nutriments['carbohydrates_serving']);
        const fatServing = parseNumber(nutriments['fat_serving']);
        const fiberServing = parseNumber(nutriments['fiber_serving']);
        const sugarServing = parseNumber(nutriments['sugars_serving']);
        const satFatServing = parseNumber(nutriments['saturated-fat_serving']);
        const cholesterolServing = parseNumber(nutriments['cholesterol_serving']);
        // Accept multiple possible sodium/salt keys from OpenFoodFacts
        const sodiumServingRaw = parseNumber(nutriments['sodium_serving']) ?? parseNumber(nutriments['sodium']) ?? parseNumber(nutriments['sodium_value']);
        const saltServing = parseNumber(nutriments['salt_serving']) ?? parseNumber(nutriments['salt']);

        // Helper: normalize sodium-like values. If the value looks like grams (small numeric), convert to mg.
        const normalizeSodium = (val: number | null): number | null => {
          if (val === null) return null;
          // Values under 10 are likely grams (e.g., 0.23 g) — convert to mg
          if (Math.abs(val) < 10) return Math.round(val * 1000);
          // Otherwise assume it's already mg
          return Math.round(val);
        };

        // If sodium per serving isn't present, try converting salt (g) -> sodium (mg)
        const sodiumServing = (() => {
          if (sodiumServingRaw !== null) return normalizeSodium(sodiumServingRaw);
          if (saltServing !== null) {
            // salt in grams per serving -> sodium in mg
            return Math.round(saltServing * 1000 * 0.393);
          }
          return null;
        })();

        const hasServingCalories = caloriesServing !== null;
        const hasAnyServingMacro = proteinServing !== null || carbsServing !== null || fatServing !== null;

        // Get all 100g values
        const cal100g = getCalories100g();
        const prot100g = parseNumber(nutriments['proteins_100g']);
        const carb100g = parseNumber(nutriments['carbohydrates_100g']);
        const fat100g = parseNumber(nutriments['fat_100g']);
        const fiber100g = parseNumber(nutriments['fiber_100g']);
        const sugar100g = parseNumber(nutriments['sugars_100g']);
        const satFat100g = parseNumber(nutriments['saturated-fat_100g']);
        const cholesterol100g = parseNumber(nutriments['cholesterol_100g']);
        const sodium100gRaw = parseNumber(nutriments['sodium_100g']) ?? parseNumber(nutriments['sodium']) ?? parseNumber(nutriments['sodium_value']);
        const salt100g = parseNumber(nutriments['salt_100g']) ?? parseNumber(nutriments['salt']);

        // Prefer sodium if present, otherwise convert salt (g per 100g) -> sodium mg per 100g
        const sodium100g = (() => {
          if (sodium100gRaw !== null) return normalizeSodium(sodium100gRaw);
          if (salt100g !== null) {
            // salt in grams per 100g -> sodium mg per 100g
            return Math.round(salt100g * 1000 * 0.393);
          }
          return null;
        })();

        const scaleFrom100g = (grams: number) => {
          const scaleFactor = grams / 100;
          return {
            calories: cal100g !== null ? Math.round(cal100g * scaleFactor) : undefined,
            protein: prot100g !== null ? Math.round(prot100g * scaleFactor * 10) / 10 : undefined,
            carbs: carb100g !== null ? Math.round(carb100g * scaleFactor * 10) / 10 : undefined,
            fat: fat100g !== null ? Math.round(fat100g * scaleFactor * 10) / 10 : undefined,
            fiber: fiber100g !== null ? Math.round(fiber100g * scaleFactor * 10) / 10 : undefined,
            sugar: sugar100g !== null ? Math.round(sugar100g * scaleFactor * 10) / 10 : undefined,
            saturatedFat: satFat100g !== null ? Math.round(satFat100g * scaleFactor * 10) / 10 : undefined,
            cholesterol: cholesterol100g !== null ? Math.round(cholesterol100g * scaleFactor * 10) / 10 : undefined,
            sodium: sodium100g !== null ? Math.round(sodium100g * scaleFactor * 10) / 10 : undefined,
          };
        };

        const scaled =
          servingQuantityGrams && servingQuantityGrams > 0 ? scaleFrom100g(servingQuantityGrams) : null;

        const servingDirect = {
          calories: caloriesServing ?? undefined,
          protein: proteinServing ?? undefined,
          carbs: carbsServing ?? undefined,
          fat: fatServing ?? undefined,
          fiber: fiberServing ?? undefined,
          sugar: sugarServing ?? undefined,
          saturatedFat: satFatServing ?? undefined,
          cholesterol: cholesterolServing ?? undefined,
          sodium: sodiumServing ?? undefined,
        };

        // Calculate nutrition values
        let calories: number | undefined;
        let protein: number | undefined;
        let carbs: number | undefined;
        let fat: number | undefined;
        let fiber: number | undefined;
        let sugar: number | undefined;
        let saturatedFat: number | undefined;
        let cholesterol: number | undefined;
        let sodium: number | undefined;

        // OpenFoodFacts data can be inconsistent: sometimes *_serving fields are actually per-100g.
        // If we can compute a reasonable scaled-from-100g value, sanity-check and prefer scaled when serving looks wrong.
        const macroOff = (servVal: number | null, scaledVal: number | undefined) => {
          if (servVal === null || scaledVal === undefined) return false;
          const diff = Math.abs(servVal - scaledVal);
          const rel = diff / Math.max(0.1, scaledVal);
          return diff >= 0.5 && rel > 0.6;
        };

        const caloriesOff = () => {
          if (!scaled || caloriesServing === null || scaled.calories === undefined) return false;
          const diff = Math.abs(caloriesServing - scaled.calories);
          const rel = diff / Math.max(1, scaled.calories);
          if (diff >= 10 && rel > 0.35) return true;

          // Common failure mode: calories_serving equals calories_100g (meaning it's mislabeled)
          if (
            cal100g !== null &&
            servingQuantityGrams &&
            servingQuantityGrams < 80 &&
            Math.abs(caloriesServing - cal100g) / Math.max(1, cal100g) < 0.05
          ) {
            return true;
          }
          return false;
        };

        const shouldPreferScaled =
          !!scaled &&
          (caloriesOff() || macroOff(fatServing, scaled.fat) || macroOff(carbsServing, scaled.carbs) || macroOff(proteinServing, scaled.protein));

        if ((hasServingCalories || hasAnyServingMacro) && !shouldPreferScaled) {
          console.log('[Barcode] Using per-serving data (passed sanity check)');
          calories = servingDirect.calories ?? scaled?.calories;
          protein = servingDirect.protein ?? scaled?.protein;
          carbs = servingDirect.carbs ?? scaled?.carbs;
          fat = servingDirect.fat ?? scaled?.fat;
          fiber = servingDirect.fiber ?? scaled?.fiber;
          sugar = servingDirect.sugar ?? scaled?.sugar;
          saturatedFat = servingDirect.saturatedFat ?? scaled?.saturatedFat;
          cholesterol = servingDirect.cholesterol ?? scaled?.cholesterol;
          sodium = servingDirect.sodium ?? scaled?.sodium;
        } else if (scaled) {
          console.log('[Barcode] Using scaled-from-100g values (serving looked inconsistent)', {
            servingQuantityGrams,
            servingDirect,
            scaled,
          });
          calories = scaled.calories;
          protein = scaled.protein;
          carbs = scaled.carbs;
          fat = scaled.fat;
          fiber = scaled.fiber;
          sugar = scaled.sugar;
          saturatedFat = scaled.saturatedFat;
          cholesterol = scaled.cholesterol;
          sodium = scaled.sodium;
        } else {
          // No serving quantity available - use 100g values as-is with warning
          console.warn('[Barcode] No serving grams available - using 100g values (may be inaccurate)');
          calories = cal100g ?? undefined;
          protein = prot100g ?? undefined;
          carbs = carb100g ?? undefined;
          fat = fat100g ?? undefined;
          fiber = fiber100g ?? undefined;
          sugar = sugar100g ?? undefined;
          saturatedFat = satFat100g ?? undefined;
          cholesterol = cholesterol100g ?? undefined;
          sodium = sodium100g ?? undefined;
        }
        
        // Sanity-check: if scaled values are insanely large, prefer per-serving values when available
        const isCrazy = (v: number | undefined) => v !== undefined && (v > 1000 || v < 0);
        if ((isCrazy(calories) || isCrazy(carbs) || isCrazy(fiber)) && (hasServingCalories || hasAnyServingMacro)) {
          console.warn('[Barcode] Sanity check triggered: scaled values look unrealistic, preferring per-serving fields when available');
          calories = servingDirect.calories ?? calories;
          protein = servingDirect.protein ?? protein;
          carbs = servingDirect.carbs ?? carbs;
          fat = servingDirect.fat ?? fat;
          fiber = servingDirect.fiber ?? fiber;
          sugar = servingDirect.sugar ?? sugar;
          saturatedFat = servingDirect.saturatedFat ?? saturatedFat;
          cholesterol = servingDirect.cholesterol ?? cholesterol;
          sodium = servingDirect.sodium ?? sodium;
        }

        console.log('[Barcode] Final nutrition:', {
          calories, protein, carbs, fat, fiber, sugar, saturatedFat, cholesterol, sodium,
          hasServingCalories, servingQuantityGrams, shouldPreferScaled,
        });
        
        // Natural unit is already computed earlier (kept above for hard-coded lookup)
        
        // Get product image (prefer front image, fallback to others)
        const imageUrl = product.image_front_small_url 
          || product.image_front_url 
          || product.image_small_url 
          || product.image_url 
          || null;
        
        // Show review modal
        const initialPending: ScannedProduct = {
          barcode,
          name: product.product_name || product.generic_name || barcode,
          servingSize: product.serving_size,
          imageUrl,
          servingQuantityGrams,
          naturalUnit,
          // Pass through OpenFoodFacts' nutrition_data_per so the review modal can prompt when values are per-100g
          nutritionPer: product.nutrition_data_per,
          nutrition: { calories, protein, carbs, fat, fiber, sugar, saturatedFat, cholesterol, sodium }
        };

        safeSetPendingProduct(initialPending);

        // NOTE: OCR attempts were removed per request (we'll rely on OpenFoodFacts and DB overrides).
      } else {
        // Product not found - show review with placeholder
        safeSetPendingProduct({
          barcode,
          name: `Product (${barcode})`,
          naturalUnit: 'serving',
          nutrition: {}
        });
        toast.info(t('recipes.productNotFound', 'Product not in database. You can enter details manually.'));
      }
    } catch (error) {
      // If hard timeout already handled UI, don't double-toast.
      if (didHardTimeout) return;

      console.error('Barcode lookup error:', error);

      const isAbort = error instanceof Error && error.name === 'AbortError';

      // Show review with placeholder on error
      safeSetPendingProduct({
        barcode,
        name: `Scanned item (${barcode})`,
        naturalUnit: 'serving',
        nutrition: {},
      });

      if (isAbort) {
        toast.error(t('recipes.lookupTimeout', 'Lookup timed out. Enter details manually.'));
      } else {
        toast.error(t('recipes.lookupFailed', 'Could not look up product. Enter details manually.'));
      }
    } finally {
      clearTimeout(hardTimeout);

      // Clear abort controller only if this is still the active lookup
      if (isCurrent()) {
        activeLookupAbortRef.current = null;
      }

      safeStopSpinner();
    }
  };

  const handleConfirmProduct = (quantity: string, unit: string, nutrition: ScannedProduct['nutrition']) => {
    if (!pendingProduct) return;
    
    const newIngredient: IngredientItem = {
      id: generateId(),
      name: pendingProduct.name,
      quantity,
      unit,
      barcode: pendingProduct.barcode,
      nutrition, // Use the edited nutrition values from the modal
    };

    onChange([...ingredients, newIngredient]);
    toast.success(t('recipes.ingredientAdded', `Added: ${pendingProduct.name}`));
    setPendingProduct(null);
  };

  const handleCancelProduct = () => {
    setPendingProduct(null);
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    toast.info(
      t('recipes.photoIngredientHint', 'Photo ingredient detection coming soon! For now, please type or scan barcode.')
    );

    if (e.target) e.target.value = '';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">
          {t('recipes.ingredients', 'Ingredients')}
        </Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => photoInputRef.current?.click()}
            className="gap-1"
          >
            <Camera className="w-4 h-4" />
            <span className="hidden sm:inline">{t('recipes.photo', 'Photo')}</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowScanner(true)}
            disabled={isLookingUp}
            className="gap-1"
          >
            {isLookingUp ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ScanBarcode className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">{t('recipes.scan', 'Scan')}</span>
          </Button>
        </div>
      </div>

      {/* Ingredient list */}
      <div className="space-y-2">
        <Reorder.Group 
          axis="y" 
          values={ingredients} 
          onReorder={onChange}
          className="space-y-2"
        >
          <AnimatePresence mode="popLayout">
            {ingredients.map((ingredient) => (
              <Reorder.Item
                key={ingredient.id}
                value={ingredient}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border"
              >
                <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab active:cursor-grabbing flex-shrink-0" />
                
                <div className="flex-1 grid grid-cols-12 gap-2">
                  <Input
                    placeholder={t('recipes.quantity', 'Qty')}
                    value={ingredient.quantity}
                    onChange={(e) => updateIngredient(ingredient.id, 'quantity', e.target.value)}
                    className="col-span-2 text-center px-1"
                  />
                  <Input
                    placeholder={t('recipes.unit', 'Unit')}
                    value={ingredient.unit}
                    onChange={(e) => updateIngredient(ingredient.id, 'unit', e.target.value)}
                    className="col-span-2 px-1"
                  />
                  <Input
                    placeholder={t('recipes.ingredientName', 'Ingredient name')}
                    value={ingredient.name}
                    onChange={(e) => updateIngredient(ingredient.id, 'name', e.target.value)}
                    className="col-span-8"
                  />
                </div>

                {ingredient.barcode && (
                  <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded flex-shrink-0">
                    {t('recipes.scanned', 'Scanned')}
                  </span>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
                  onClick={() => removeIngredient(ingredient.id)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </Reorder.Item>
            ))}
          </AnimatePresence>
        </Reorder.Group>

        {ingredients.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t('recipes.noIngredients', 'No ingredients added yet')}
          </p>
        )}

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={addIngredient}
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('recipes.addIngredient', 'Add Ingredient')}
        </Button>
      </div>

      {/* Hidden photo input */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoCapture}
      />

      {/* Barcode Scanner Modal */}
      <BarcodeScanner
        open={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleBarcodeScan}
      />

      {/* Scan Review Modal */}
      <ScanReviewModal
        open={!!pendingProduct}
        product={pendingProduct}
        onConfirm={handleConfirmProduct}
        onCancel={handleCancelProduct}
      />
    </div>
  );
}
