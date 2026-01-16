import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/Chip';
import { Plus, Check, Calendar, AlertTriangle } from 'lucide-react';
import { useMealPlanStore } from '@/stores/mealPlanStore';
import { useGlobalRecipes } from '@/hooks/useGlobalRecipes';
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
    exactAssignments,
  } = useMealPlanStore();
  const { data: globalRecipes = [] } = useGlobalRecipes();
  
  const [selectedSlot, setSelectedSlot] = useState<MealSlotId | null>(defaultSlot || null);
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>('pool');
  const [selectedDays, setSelectedDays] = useState<number[]>([0]);
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);
  const [conflictingDays, setConflictingDays] = useState<{ dayIndex: number; existingRecipeName: string }[]>([]);

  // Initialize slot on open
  useMemo(() => {
    if (open && !selectedSlot && selectedMealSlots.length > 0) {
      setSelectedSlot(defaultSlot || selectedMealSlots[0].id);
    }
  }, [open, defaultSlot, selectedMealSlots]);

  const isAlreadyInPool = selectedSlot 
    ? (recipePoolsBySlot[selectedSlot] || []).includes(recipeId) 
    : false;

  const toggleDay = (dayIndex: number) => {
    setSelectedDays(prev => 
      prev.includes(dayIndex) 
        ? prev.filter(d => d !== dayIndex)
        : [...prev, dayIndex].sort((a, b) => a - b)
    );
  };

  // Helper to get recipe name by ID
  const getRecipeName = (recipeId: string) => {
    const recipe = globalRecipes.find(r => r.id === recipeId);
    return recipe?.title || 'Unknown Recipe';
  };

  // Check for conflicting assignments
  const checkForConflicts = () => {
    if (!selectedSlot || assignmentMode !== 'exact') return [];
    
    const conflicts: { dayIndex: number; existingRecipeName: string }[] = [];
    
    selectedDays.forEach(dayIndex => {
      const dayAssignments = exactAssignments[dayIndex];
      if (dayAssignments && dayAssignments[selectedSlot]) {
        const existingRecipeId = dayAssignments[selectedSlot].recipeId;
        if (existingRecipeId !== recipeId) {
          conflicts.push({
            dayIndex,
            existingRecipeName: getRecipeName(existingRecipeId),
          });
        }
      }
    });
    
    return conflicts;
  };

  const performAdd = () => {
    if (!selectedSlot) return;

    if (assignmentMode === 'pool') {
      addToPool(selectedSlot, recipeId);
    } else {
      // Add to all selected days
      selectedDays.forEach(dayIndex => {
        setExactAssignment(dayIndex, selectedSlot, recipeId);
      });
    }

    onOpenChange(false);
  };

  const handleAdd = () => {
    if (!selectedSlot) return;

    if (assignmentMode === 'exact') {
      const conflicts = checkForConflicts();
      if (conflicts.length > 0) {
        setConflictingDays(conflicts);
        setShowReplaceConfirm(true);
        return;
      }
    }

    performAdd();
  };

  const handleConfirmReplace = () => {
    setShowReplaceConfirm(false);
    performAdd();
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

  const slotLabel = selectedMealSlots.find(s => s.id === selectedSlot)?.label || '';

  return (
    <>
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
                <p className="text-xs text-muted-foreground mb-2">
                  Select one or more days
                </p>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: numberOfDays }, (_, i) => (
                    <Chip
                      key={i}
                      selected={selectedDays.includes(i)}
                      onClick={() => toggleDay(i)}
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
              disabled={!selectedSlot || (assignmentMode === 'pool' && isAlreadyInPool) || (assignmentMode === 'exact' && selectedDays.length === 0)}
            >
              <Check className="w-4 h-4 mr-2" />
              {assignmentMode === 'pool' 
                ? 'Add to Pool' 
                : selectedDays.length === 1 
                  ? `Add to Day ${selectedDays[0] + 1}`
                  : `Add to ${selectedDays.length} Days`
              }
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Replace confirmation dialog */}
      <AlertDialog open={showReplaceConfirm} onOpenChange={setShowReplaceConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Replace Existing Meal?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                {conflictingDays.length === 1 
                  ? `Day ${conflictingDays[0].dayIndex + 1}'s ${slotLabel} already has "${conflictingDays[0].existingRecipeName}" assigned.`
                  : `${conflictingDays.length} days already have meals assigned for ${slotLabel}:`
                }
              </p>
              {conflictingDays.length > 1 && (
                <ul className="list-disc list-inside text-sm space-y-1 mt-2">
                  {conflictingDays.map(conflict => (
                    <li key={conflict.dayIndex}>
                      Day {conflict.dayIndex + 1}: {conflict.existingRecipeName}
                    </li>
                  ))}
                </ul>
              )}
              <p className="pt-2">
                Do you want to replace {conflictingDays.length === 1 ? 'it' : 'them'} with "{recipeName}"?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Existing</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReplace}>
              Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
