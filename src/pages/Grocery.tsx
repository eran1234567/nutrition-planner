import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Check, Trash2, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/layout/PageHeader';
import { BottomNav } from '@/components/layout/BottomNav';
import { useAppStore } from '@/stores/appStore';
import { cn } from '@/lib/utils';

// Mock grocery data organized by aisle
const mockGroceries = [
  { aisle: 'Produce', items: [
    { id: '1', name: 'Avocados', quantity: 3, unit: 'whole', checked: false },
    { id: '2', name: 'Lemons', quantity: 4, unit: 'whole', checked: false },
    { id: '3', name: 'Spinach', quantity: 1, unit: 'bag', checked: true },
  ]},
  { aisle: 'Dairy', items: [
    { id: '4', name: 'Greek yogurt', quantity: 2, unit: 'cups', checked: false },
    { id: '5', name: 'Eggs', quantity: 12, unit: 'large', checked: false },
  ]},
  { aisle: 'Meat & Seafood', items: [
    { id: '6', name: 'Chicken breast', quantity: 1.5, unit: 'lbs', checked: false },
    { id: '7', name: 'Salmon fillet', quantity: 12, unit: 'oz', checked: false },
  ]},
];

export default function Grocery() {
  const { t } = useTranslation();
  const { isOnline } = useAppStore();
  const [groceries, setGroceries] = useState(mockGroceries);
  const [newItem, setNewItem] = useState('');

  const toggleItem = (aisleIdx: number, itemId: string) => {
    setGroceries(prev => prev.map((aisle, idx) => 
      idx === aisleIdx 
        ? {
            ...aisle,
            items: aisle.items.map(item => 
              item.id === itemId ? { ...item, checked: !item.checked } : item
            )
          }
        : aisle
    ));
  };

  const totalItems = groceries.reduce((acc, aisle) => acc + aisle.items.length, 0);
  const checkedItems = groceries.reduce(
    (acc, aisle) => acc + aisle.items.filter(i => i.checked).length, 
    0
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="page-container">
        <PageHeader
          title={t('grocery.title')}
          subtitle={t('grocery.items', { count: totalItems })}
        />

        {/* Offline indicator */}
        {!isOnline && (
          <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-warning/10 text-warning">
            <WifiOff className="w-4 h-4" />
            <span className="text-sm">{t('grocery.offlineMode')}</span>
          </div>
        )}

        {/* Add item */}
        <div className="flex gap-2 mb-6">
          <Input
            placeholder={t('grocery.addItem')}
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            className="flex-1"
          />
          <Button size="icon" disabled={!newItem.trim()}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">{t('grocery.checkedOff', { count: checkedItems })}</span>
            <span className="font-medium">{Math.round((checkedItems / totalItems) * 100)}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${(checkedItems / totalItems) * 100}%` }}
            />
          </div>
        </div>

        {/* Grocery list by aisle */}
        <div className="space-y-6">
          {groceries.map((aisle, aisleIdx) => (
            <div key={aisle.aisle}>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {aisle.aisle}
              </h3>
              <div className="space-y-1">
                {aisle.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => toggleItem(aisleIdx, item.id)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-lg transition-all tap-target',
                      item.checked 
                        ? 'bg-muted/50' 
                        : 'bg-card border border-border hover:bg-muted'
                    )}
                  >
                    <div className={cn(
                      'w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                      item.checked 
                        ? 'bg-primary border-primary' 
                        : 'border-muted-foreground'
                    )}>
                      {item.checked && <Check className="w-4 h-4 text-primary-foreground" />}
                    </div>
                    <div className="flex-1 text-left">
                      <span className={cn(
                        'font-medium',
                        item.checked && 'line-through text-muted-foreground'
                      )}>
                        {item.name}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {item.quantity} {item.unit}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Clear checked */}
        {checkedItems > 0 && (
          <Button variant="ghost" className="w-full mt-6 text-destructive hover:text-destructive">
            <Trash2 className="w-4 h-4 mr-2" />
            {t('grocery.clearChecked')}
          </Button>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
