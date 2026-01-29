import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X, Camera, ScanBarcode, Loader2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BarcodeScanner } from './BarcodeScanner';
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
        
        // Create ingredient from scanned product
        const newIngredient: IngredientItem = {
          id: generateId(),
          name: product.product_name || product.generic_name || barcode,
          quantity: '1',
          unit: product.serving_size ? 'serving' : 'item',
          barcode,
          nutrition: {
            calories: nutriments['energy-kcal_serving'] || nutriments['energy-kcal_100g'],
            protein: nutriments.proteins_serving || nutriments.proteins_100g,
            carbs: nutriments.carbohydrates_serving || nutriments.carbohydrates_100g,
            fat: nutriments.fat_serving || nutriments.fat_100g,
          }
        };

        onChange([...ingredients, newIngredient]);
        toast.success(
          t('recipes.productFound', `Added: ${newIngredient.name}`),
          { description: product.serving_size ? `Serving: ${product.serving_size}` : undefined }
        );
      } else {
        // Product not found - add barcode as placeholder
        const newIngredient: IngredientItem = {
          id: generateId(),
          name: `Product (${barcode})`,
          quantity: '1',
          unit: 'item',
          barcode,
        };
        onChange([...ingredients, newIngredient]);
        toast.info(t('recipes.productNotFound', 'Product not in database. Please enter name manually.'));
      }
    } catch (error) {
      console.error('Barcode lookup error:', error);
      // Add placeholder on error
      const newIngredient: IngredientItem = {
        id: generateId(),
        name: `Scanned item (${barcode})`,
        quantity: '1',
        unit: 'item',
        barcode,
      };
      onChange([...ingredients, newIngredient]);
      toast.error(t('recipes.lookupFailed', 'Could not look up product. Enter details manually.'));
    } finally {
      setIsLookingUp(false);
    }
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // For now, we just notify user that photo ingredient detection is coming
    // This could integrate with AI vision in the future
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
                <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab active:cursor-grabbing" />
                
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
                  <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                    {t('recipes.scanned', 'Scanned')}
                  </span>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
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
    </div>
  );
}
