import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Package, Flame, Drumstick, Droplet, Wheat, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface ScannedProduct {
  barcode: string;
  name: string;
  servingSize?: string;
  nutrition: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  };
}

interface ScanReviewModalProps {
  open: boolean;
  product: ScannedProduct | null;
  onConfirm: (quantity: string, unit: string) => void;
  onCancel: () => void;
}

export function ScanReviewModal({ open, product, onConfirm, onCancel }: ScanReviewModalProps) {
  const { t } = useTranslation();
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('serving');

  if (!open || !product) return null;

  const handleConfirm = () => {
    onConfirm(quantity, unit);
    // Reset for next scan
    setQuantity('1');
    setUnit('serving');
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

  const qtyNum = parseFloat(quantity) || 1;
  const { nutrition } = product;

  const macros = [
    { icon: Flame, label: 'Cal', value: (nutrition.calories || 0) * qtyNum, color: 'text-orange-500' },
    { icon: Drumstick, label: 'Protein', value: (nutrition.protein || 0) * qtyNum, suffix: 'g', color: 'text-red-500' },
    { icon: Droplet, label: 'Fat', value: (nutrition.fat || 0) * qtyNum, suffix: 'g', color: 'text-yellow-500' },
    { icon: Wheat, label: 'Carbs', value: (nutrition.carbs || 0) * qtyNum, suffix: 'g', color: 'text-blue-500' },
  ];

  return (
    <AnimatePresence>
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
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Package className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('recipes.productFound', 'Product Found')}</p>
                <h3 className="font-semibold text-lg leading-tight line-clamp-2">{product.name}</h3>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Serving info */}
          {product.servingSize && (
            <p className="text-sm text-muted-foreground">
              {t('recipes.servingSize', 'Serving size')}: {product.servingSize}
            </p>
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

          {/* Live nutrition preview */}
          <div className="grid grid-cols-4 gap-2 p-3 rounded-xl bg-muted/50">
            {macros.map(({ icon: Icon, label, value, suffix = '', color }) => (
              <div key={label} className="text-center">
                <Icon className={`w-4 h-4 mx-auto mb-1 ${color}`} />
                <p className={`text-sm font-bold ${color}`}>
                  {Math.round(value)}{suffix}
                </p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </div>
            ))}
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
    </AnimatePresence>
  );
}
