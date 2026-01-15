import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/Chip';
import { Plus, Check, Calendar } from 'lucide-react';
import { useMealPlanStore } from '@/stores/mealPlanStore';
import type { MealSlotId } from '@/types/mealPlan';

interface AddToPlanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipeId: string;
  recipeName: string;
  defaultSlot?: MealSlotId | null;
}

type AssignmentMode = 'pool' | 'exact';

export function AddToPlanModal({ 
  open, 
  onOpenChange, 
  recipeId, 
  recipeName,
  defaultSlot 
}: AddToPlanModalProps) {
  const { t } = useTranslation();
  const { 
    selectedMealSlots, 
    numberOfDays, 
    addToPool, 
    setExactAssignment,
    recipePoolsBySlot,
  } = useMealPlanStore();
  
  const [selectedSlot, setSelectedSlot] = useState<MealSlotId | null>(defaultSlot || null);
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>('pool');
  const [selectedDay, setSelectedDay] = useState<number>(0);

  // Initialize slot on open
  useMemo(() => {
    if (open && !selectedSlot && selectedMealSlots.length > 0) {
      setSelectedSlot(defaultSlot || selectedMealSlots[0].id);
    }
  }, [open, defaultSlot, selectedMealSlots]);

  const isAlreadyInPool = selectedSlot 
    ? (recipePoolsBySlot[selectedSlot] || []).includes(recipeId) 
    : false;

  const handleAdd = () => {
    if (!selectedSlot) return;

    if (assignmentMode === 'pool') {
      addToPool(selectedSlot, recipeId);
    } else {
      setExactAssignment(selectedDay, selectedSlot, recipeId);
    }

    onOpenChange(false);
  };

  if (selectedMealSlots.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add to Plan</DialogTitle>
          </DialogHeader>
          <div className="py-6 text-center">
            <p className="text-muted-foreground">
              Please set up your meal plan first by configuring your nutrition goals.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Add to Plan
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-5 pt-2">
          {/* Recipe name */}
          <p className="text-sm text-muted-foreground line-clamp-2">
            {recipeName}
          </p>

          {/* Slot selection */}
          <div>
            <p className="text-sm font-medium mb-2">Which meal?</p>
            <div className="flex flex-wrap gap-2">
              {selectedMealSlots.map(slot => (
                <Chip
                  key={slot.id}
                  selected={selectedSlot === slot.id}
                  onClick={() => setSelectedSlot(slot.id)}
                  variant="outline"
                >
                  {slot.label}
                </Chip>
              ))}
            </div>
          </div>

          {/* Assignment mode */}
          <div>
            <p className="text-sm font-medium mb-2">How to assign?</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAssignmentMode('pool')}
                className={`p-3 rounded-xl border-2 transition-all text-left ${
                  assignmentMode === 'pool'
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-card hover:border-muted-foreground/50'
                }`}
              >
                <p className="font-medium text-sm">Pool</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Rotate through multiple recipes
                </p>
              </button>
              <button
                type="button"
                onClick={() => setAssignmentMode('exact')}
                className={`p-3 rounded-xl border-2 transition-all text-left ${
                  assignmentMode === 'exact'
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-card hover:border-muted-foreground/50'
                }`}
              >
                <p className="font-medium text-sm">Specific Day</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Assign to one day
                </p>
              </button>
            </div>
          </div>

          {/* Day selection for exact mode */}
          {assignmentMode === 'exact' && (
            <div>
              <p className="text-sm font-medium mb-2 flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                Which day?
              </p>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: numberOfDays }, (_, i) => (
                  <Chip
                    key={i}
                    selected={selectedDay === i}
                    onClick={() => setSelectedDay(i)}
                    variant="outline"
                  >
                    Day {i + 1}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {/* Already in pool warning */}
          {assignmentMode === 'pool' && isAlreadyInPool && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                This recipe is already in the pool for this meal slot.
              </p>
            </div>
          )}

          {/* Add button */}
          <Button 
            className="w-full" 
            onClick={handleAdd}
            disabled={!selectedSlot || (assignmentMode === 'pool' && isAlreadyInPool)}
          >
            <Check className="w-4 h-4 mr-2" />
            {assignmentMode === 'pool' ? 'Add to Pool' : `Add to Day ${selectedDay + 1}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
