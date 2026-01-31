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
    setIsLookingUp(true);
    
    try {
      // Look up product info from Open Food Facts API
      const response = await fetch(
        `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`
      );
      const data = await response.json();

      if (data.status === 1 && data.product) {
        const product = data.product;
        const nutriments = product.nutriments || {};
        
        console.log('[Barcode] Raw API response:', { 
          serving_quantity: product.serving_quantity,
          serving_size: product.serving_size,
          nutriments_keys: Object.keys(nutriments).filter(k => k.includes('serving') || k.includes('100g'))
        });
        
        // Parse serving quantity - API may return string or number
        const parseNumber = (val: unknown): number | null => {
          if (val === null || val === undefined) return null;
          const num = typeof val === 'string' ? parseFloat(val.replace(',', '.')) : Number(val);
          return isNaN(num) ? null : num;
        };
        
        // Extract serving quantity in grams
        let servingQuantityGrams = parseNumber(product.serving_quantity);
        
        // Fallback: try to parse from serving_size string (e.g., "2 Rounded Teaspoons (11.7g)")
        if (!servingQuantityGrams && product.serving_size) {
          const gramsMatch = product.serving_size.match(/\((\d+(?:[.,]\d+)?)\s*g\)/i);
          if (gramsMatch) {
            servingQuantityGrams = parseNumber(gramsMatch[1]);
          }
        }
        
        // Helper to get calories (try kcal first, then convert from kJ)
        const getCalories100g = (): number | null => {
          if (nutriments['energy-kcal_100g'] !== undefined) {
            return parseNumber(nutriments['energy-kcal_100g']);
          }
          if (nutriments['energy_100g'] !== undefined) {
            // energy_100g is typically in kJ, convert to kcal (1 kcal = 4.184 kJ)
            const kj = parseNumber(nutriments['energy_100g']);
            return kj ? Math.round(kj / 4.184) : null;
          }
          if (nutriments['energy-kj_100g'] !== undefined) {
            const kj = parseNumber(nutriments['energy-kj_100g']);
            return kj ? Math.round(kj / 4.184) : null;
          }
          return null;
        };
        
        const getCaloriesServing = (): number | null => {
          if (nutriments['energy-kcal_serving'] !== undefined) {
            return parseNumber(nutriments['energy-kcal_serving']);
          }
          if (nutriments['energy_serving'] !== undefined) {
            const kj = parseNumber(nutriments['energy_serving']);
            return kj ? Math.round(kj / 4.184) : null;
          }
          if (nutriments['energy-kj_serving'] !== undefined) {
            const kj = parseNumber(nutriments['energy-kj_serving']);
            return kj ? Math.round(kj / 4.184) : null;
          }
          return null;
        };
        
        // Check if per-serving data is available
        const caloriesServing = getCaloriesServing();
        const hasServingData = caloriesServing !== null;
        
        // Calculate nutrition values
        let calories: number | undefined;
        let protein: number | undefined;
        let carbs: number | undefined;
        let fat: number | undefined;
        
        if (hasServingData) {
          // Use per-serving values directly
          console.log('[Barcode] Using per-serving data');
          calories = caloriesServing ?? undefined;
          protein = parseNumber(nutriments.proteins_serving) ?? undefined;
          carbs = parseNumber(nutriments.carbohydrates_serving) ?? undefined;
          fat = parseNumber(nutriments.fat_serving) ?? undefined;
        } else if (servingQuantityGrams && servingQuantityGrams > 0) {
          // Scale 100g values to serving size: (value_per_100g / 100) * serving_grams
          const scaleFactor = servingQuantityGrams / 100;
          console.log('[Barcode] Scaling from 100g, factor:', scaleFactor, 'grams:', servingQuantityGrams);
          
          const cal100g = getCalories100g();
          const prot100g = parseNumber(nutriments.proteins_100g);
          const carb100g = parseNumber(nutriments.carbohydrates_100g);
          const fat100g = parseNumber(nutriments.fat_100g);
          
          calories = cal100g !== null ? Math.round(cal100g * scaleFactor) : undefined;
          protein = prot100g !== null ? Math.round(prot100g * scaleFactor * 10) / 10 : undefined;
          carbs = carb100g !== null ? Math.round(carb100g * scaleFactor * 10) / 10 : undefined;
          fat = fat100g !== null ? Math.round(fat100g * scaleFactor * 10) / 10 : undefined;
        } else {
          // No serving quantity available - use 100g values as-is (user can edit)
          console.log('[Barcode] No serving data, using 100g values');
          calories = getCalories100g() ?? undefined;
          protein = parseNumber(nutriments.proteins_100g) ?? undefined;
          carbs = parseNumber(nutriments.carbohydrates_100g) ?? undefined;
          fat = parseNumber(nutriments.fat_100g) ?? undefined;
        }
        
        console.log('[Barcode] Final nutrition:', { calories, protein, carbs, fat });
        
        // Parse serving size to extract natural unit
        let naturalUnit = 'serving';
        const servingSizeRaw = product.serving_size || '';
        if (servingSizeRaw) {
          // Remove weight in parentheses: "2 Rounded Teaspoons (11.7g)" -> "2 Rounded Teaspoons"
          const withoutWeight = servingSizeRaw.replace(/\s*\([^)]*g?\)/gi, '').trim();
          if (withoutWeight) {
            naturalUnit = withoutWeight;
          }
        }
        
        // Get product image (prefer front image, fallback to others)
        const imageUrl = product.image_front_small_url 
          || product.image_front_url 
          || product.image_small_url 
          || product.image_url 
          || null;
        
        // Show review modal
        setPendingProduct({
          barcode,
          name: product.product_name || product.generic_name || barcode,
          servingSize: product.serving_size,
          imageUrl,
          servingQuantityGrams,
          naturalUnit,
          nutrition: { calories, protein, carbs, fat }
        });
      } else {
        // Product not found - show review with placeholder
        setPendingProduct({
          barcode,
          name: `Product (${barcode})`,
          naturalUnit: 'serving',
          nutrition: {}
        });
        toast.info(t('recipes.productNotFound', 'Product not in database. You can enter details manually.'));
      }
    } catch (error) {
      console.error('Barcode lookup error:', error);
      // Show review with placeholder on error
      setPendingProduct({
        barcode,
        name: `Scanned item (${barcode})`,
        naturalUnit: 'serving',
        nutrition: {}
      });
      toast.error(t('recipes.lookupFailed', 'Could not look up product. Enter details manually.'));
    } finally {
      setIsLookingUp(false);
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
