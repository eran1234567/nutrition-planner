import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Check, Trash2, WifiOff, ShoppingCart, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/PageHeader';
import { BottomNav } from '@/components/layout/BottomNav';
import { useAppStore } from '@/stores/appStore';
import { useGroceryList, GroceryItem } from '@/hooks/useGroceryList';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export default function Grocery() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isOnline } = useAppStore();
  const { groceryList, totalItems, hasPlan, isLoading, numberOfDays } = useGroceryList();
  
  // Local checked state (not persisted for now)
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  const toggleItem = (itemId: string) => {
    setCheckedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const clearChecked = () => {
    setCheckedItems(new Set());
  };

  const checkedCount = checkedItems.size;
  const progressPercent = totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0;

  // Memoize the grocery list with checked state applied
  const groceriesWithChecked = useMemo(() => 
    groceryList.map(aisle => ({
      ...aisle,
      items: aisle.items.map(item => ({
        ...item,
        checked: checkedItems.has(item.id),
      })),
    })),
    [groceryList, checkedItems]
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="page-container">
          <PageHeader
            title={t('grocery.title')}
            subtitle={t('grocery.loading', 'Loading grocery list...')}
          />
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ))}
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (!hasPlan) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="page-container">
          <PageHeader
            title={t('grocery.title')}
            subtitle={t('grocery.noplan', 'No meal plan found')}
          />
          
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <ShoppingCart className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              {t('grocery.noPlanTitle', 'No Grocery List Yet')}
            </h3>
            <p className="text-muted-foreground mb-6 max-w-sm">
              {t('grocery.noPlanDescription', 'Generate a meal plan first to see your grocery list with all the ingredients you need.')}
            </p>
            <Button onClick={() => navigate('/plan')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('grocery.goToPlan', 'Go to Meal Plan')}
            </Button>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="page-container">
        <PageHeader
          title={t('grocery.title')}
          subtitle={t('grocery.itemsForDays', '{{count}} items for {{days}} days', { 
            count: totalItems, 
            days: numberOfDays 
          })}
        />

        {/* Offline indicator */}
        {!isOnline && (
          <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-warning/10 text-warning">
            <WifiOff className="w-4 h-4" />
            <span className="text-sm">{t('grocery.offlineMode')}</span>
          </div>
        )}

        {/* Progress */}
        {totalItems > 0 && (
          <div className="mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">
                {t('grocery.checkedOff', { count: checkedCount })}
              </span>
              <span className="font-medium">{progressPercent}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Grocery list by aisle */}
        <div className="space-y-6">
          {groceriesWithChecked.map((aisle) => (
            <div key={aisle.aisle}>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {aisle.aisle}
              </h3>
              <div className="space-y-1">
                {aisle.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => toggleItem(item.id)}
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
                      {item.quantity > 0 && (
                        <>
                          {item.quantity}
                          {item.unit && ` ${item.unit}`}
                        </>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Clear checked */}
        {checkedCount > 0 && (
          <Button 
            variant="ghost" 
            className="w-full mt-6 text-destructive hover:text-destructive"
            onClick={clearChecked}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {t('grocery.clearChecked')}
          </Button>
        )}

        {/* Empty state when plan exists but no ingredients */}
        {totalItems === 0 && hasPlan && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <ShoppingCart className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              {t('grocery.noIngredients', 'No Ingredients Found')}
            </h3>
            <p className="text-muted-foreground max-w-sm">
              {t('grocery.noIngredientsDesc', 'The recipes in your meal plan don\'t have ingredient data yet.')}
            </p>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
