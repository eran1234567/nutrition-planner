import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, GripVertical, Save, X, Loader2, Camera, Upload, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Recipe } from '@/types';

interface RecipeEditorProps {
  recipe: Recipe;
  onSave: (updatedRecipe: Recipe) => void;
  onCancel: () => void;
}

interface EditableIngredient {
  id?: string;
  name: string;
  quantity: string;
  unit: string;
  order_index: number;
  isNew?: boolean;
  isDeleted?: boolean;
}

interface EditableStep {
  id?: string;
  step_number: number;
  instruction: string;
  isNew?: boolean;
  isDeleted?: boolean;
}

export function RecipeEditor({ recipe, onSave, onCancel }: RecipeEditorProps) {
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | undefined>(recipe.image_url);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  const [ingredients, setIngredients] = useState<EditableIngredient[]>(
    (recipe.ingredients || []).map((ing, idx) => ({
      id: ing.id,
      name: ing.name,
      quantity: ing.quantity?.toString() || '',
      unit: ing.unit || '',
      order_index: ing.order_index ?? idx,
    }))
  );
  
  const [steps, setSteps] = useState<EditableStep[]>(
    (recipe.steps || []).map(step => ({
      id: step.id,
      step_number: step.step_number,
      instruction: step.instruction,
    }))
  );

  const handleImageUpload = async (file: File) => {
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error(t('recipes.invalidImageType', 'Please select an image file'));
      return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('recipes.imageTooLarge', 'Image must be less than 5MB'));
      return;
    }
    
    setIsUploadingImage(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error(t('auth.notAuthenticated', 'You must be logged in'));
        return;
      }
      
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${recipe.id}-${Date.now()}.${fileExt}`;
      
      // Delete old image if exists and is from our storage
      if (imageUrl && imageUrl.includes('recipe-images')) {
        const oldPath = imageUrl.split('/recipe-images/')[1];
        if (oldPath) {
          await supabase.storage.from('recipe-images').remove([oldPath]);
        }
      }
      
      // Upload new image
      const { data, error } = await supabase.storage
        .from('recipe-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        });
      
      if (error) throw error;
      
      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('recipe-images')
        .getPublicUrl(data.path);
      
      setImageUrl(publicUrlData.publicUrl);
      toast.success(t('recipes.imageUploaded', 'Image uploaded'));
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error uploading image:', error);
      toast.error(t('recipes.imageUploadError', 'Failed to upload image'));
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleDeleteImage = async () => {
    if (!imageUrl) return;
    
    setIsUploadingImage(true);
    
    try {
      // Delete from storage if it's our image
      if (imageUrl.includes('recipe-images')) {
        const path = imageUrl.split('/recipe-images/')[1];
        if (path) {
          await supabase.storage.from('recipe-images').remove([path]);
        }
      }
      
      setImageUrl(undefined);
      toast.success(t('recipes.imageDeleted', 'Image removed'));
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error deleting image:', error);
      toast.error(t('recipes.imageDeleteError', 'Failed to remove image'));
    } finally {
      setIsUploadingImage(false);
    }
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
    // Reset input so the same file can be selected again
    e.target.value = '';
  };

  const addIngredient = () => {
    setIngredients([
      ...ingredients,
      {
        name: '',
        quantity: '',
        unit: '',
        order_index: ingredients.length,
        isNew: true,
      },
    ]);
  };

  const removeIngredient = (index: number) => {
    const ing = ingredients[index];
    if (ing.id) {
      // Mark existing ingredient as deleted
      setIngredients(ingredients.map((i, idx) => 
        idx === index ? { ...i, isDeleted: true } : i
      ));
    } else {
      // Remove new ingredient entirely
      setIngredients(ingredients.filter((_, idx) => idx !== index));
    }
  };

  const updateIngredient = (index: number, field: keyof EditableIngredient, value: string) => {
    setIngredients(ingredients.map((ing, idx) => 
      idx === index ? { ...ing, [field]: value } : ing
    ));
  };

  const addStep = () => {
    const maxStepNumber = Math.max(...steps.map(s => s.step_number), 0);
    setSteps([
      ...steps,
      {
        step_number: maxStepNumber + 1,
        instruction: '',
        isNew: true,
      },
    ]);
  };

  const removeStep = (index: number) => {
    const step = steps[index];
    if (step.id) {
      setSteps(steps.map((s, idx) => 
        idx === index ? { ...s, isDeleted: true } : s
      ));
    } else {
      setSteps(steps.filter((_, idx) => idx !== index));
    }
  };

  const updateStep = (index: number, instruction: string) => {
    setSteps(steps.map((step, idx) => 
      idx === index ? { ...step, instruction } : step
    ));
  };

  const calculateNutrition = async (ingredientsList: EditableIngredient[]) => {
    // Simple estimation based on ingredient count and quantities
    // In a real app, you'd use a nutrition API
    const activeIngredients = ingredientsList.filter(i => !i.isDeleted && i.name.trim());
    const baseCaloriesPerIngredient = 50;
    const baseProteinPerIngredient = 3;
    const baseCarbsPerIngredient = 8;
    const baseFatPerIngredient = 2;
    
    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;
    
    activeIngredients.forEach(ing => {
      const qty = parseFloat(ing.quantity) || 1;
      totalCalories += baseCaloriesPerIngredient * qty;
      totalProtein += baseProteinPerIngredient * qty;
      totalCarbs += baseCarbsPerIngredient * qty;
      totalFat += baseFatPerIngredient * qty;
    });
    
    return {
      calories: Math.round(totalCalories / (recipe.servings || 4)),
      protein_g: Math.round(totalProtein / (recipe.servings || 4)),
      carbs_g: Math.round(totalCarbs / (recipe.servings || 4)),
      fat_g: Math.round(totalFat / (recipe.servings || 4)),
    };
  };

  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      // Filter active ingredients and steps
      const activeIngredients = ingredients.filter(i => !i.isDeleted);
      const activeSteps = steps.filter(s => !s.isDeleted);
      
      // Validate
      if (activeIngredients.filter(i => i.name.trim()).length === 0) {
        toast.error(t('recipes.noIngredients', 'Please add at least one ingredient'));
        setIsSaving(false);
        return;
      }
      
      if (activeSteps.filter(s => s.instruction.trim()).length === 0) {
        toast.error(t('recipes.noSteps', 'Please add at least one instruction'));
        setIsSaving(false);
        return;
      }

      // Delete removed ingredients
      const deletedIngredientIds = ingredients
        .filter(i => i.isDeleted && i.id)
        .map(i => i.id!);
      
      if (deletedIngredientIds.length > 0) {
        await supabase
          .from('recipe_ingredients')
          .delete()
          .in('id', deletedIngredientIds);
      }

      // Delete removed steps
      const deletedStepIds = steps
        .filter(s => s.isDeleted && s.id)
        .map(s => s.id!);
      
      if (deletedStepIds.length > 0) {
        await supabase
          .from('recipe_steps')
          .delete()
          .in('id', deletedStepIds);
      }

      // Upsert ingredients
      const ingredientsToUpsert = activeIngredients
        .filter(i => i.name.trim())
        .map((ing, idx) => ({
          ...(ing.id ? { id: ing.id } : {}),
          recipe_id: recipe.id,
          name: ing.name.trim(),
          quantity: ing.quantity ? parseFloat(ing.quantity) : null,
          unit: ing.unit.trim() || null,
          order_index: idx,
        }));

      for (const ing of ingredientsToUpsert) {
        if (ing.id) {
          await supabase
            .from('recipe_ingredients')
            .update({
              name: ing.name,
              quantity: ing.quantity,
              unit: ing.unit,
              order_index: ing.order_index,
            })
            .eq('id', ing.id);
        } else {
          await supabase
            .from('recipe_ingredients')
            .insert({
              recipe_id: ing.recipe_id,
              name: ing.name,
              quantity: ing.quantity,
              unit: ing.unit,
              order_index: ing.order_index,
            });
        }
      }

      // Upsert steps
      const stepsToUpsert = activeSteps
        .filter(s => s.instruction.trim())
        .map((step, idx) => ({
          ...(step.id ? { id: step.id } : {}),
          recipe_id: recipe.id,
          step_number: idx + 1,
          instruction: step.instruction.trim(),
        }));

      for (const step of stepsToUpsert) {
        if (step.id) {
          await supabase
            .from('recipe_steps')
            .update({
              step_number: step.step_number,
              instruction: step.instruction,
            })
            .eq('id', step.id);
        } else {
          await supabase
            .from('recipe_steps')
            .insert({
              recipe_id: step.recipe_id,
              step_number: step.step_number,
              instruction: step.instruction,
            });
        }
      }

      // Recalculate and update nutrition
      const newNutrition = await calculateNutrition(activeIngredients);
      
      if (recipe.nutrition?.id) {
        await supabase
          .from('recipe_nutrition')
          .update(newNutrition)
          .eq('id', recipe.nutrition.id);
      } else {
        await supabase
          .from('recipe_nutrition')
          .insert({
            recipe_id: recipe.id,
            ...newNutrition,
          });
      }

      // Update recipe image_url if changed
      if (imageUrl !== recipe.image_url) {
        await supabase
          .from('recipes')
          .update({ image_url: imageUrl || null })
          .eq('id', recipe.id);
      }

      // Fetch updated recipe data
      const [recipeRes, ingredientsRes, stepsRes, nutritionRes] = await Promise.all([
        supabase.from('recipes').select('*').eq('id', recipe.id).single(),
        supabase.from('recipe_ingredients').select('*').eq('recipe_id', recipe.id).order('order_index'),
        supabase.from('recipe_steps').select('*').eq('recipe_id', recipe.id).order('step_number'),
        supabase.from('recipe_nutrition').select('*').eq('recipe_id', recipe.id).single(),
      ]);

      const updatedRecipe: Recipe = {
        ...recipe,
        ...(recipeRes.data || {}),
        ingredients: ingredientsRes.data || [],
        steps: stepsRes.data || [],
        nutrition: nutritionRes.data || undefined,
      };

      toast.success(t('recipes.saved', 'Recipe saved successfully'));
      onSave(updatedRecipe);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error saving recipe:', error);
      toast.error(t('recipes.saveError', 'Failed to save recipe'));
    } finally {
      setIsSaving(false);
    }
  };

  const visibleIngredients = ingredients.filter(i => !i.isDeleted);
  const visibleSteps = steps.filter(s => !s.isDeleted);

  return (
    <div className="space-y-6">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileSelect}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFileSelect}
      />

      {/* Photo Section */}
      <div>
        <h3 className="text-sm font-semibold mb-3">{t('recipes.photo', 'Recipe Photo')}</h3>
        <div className="relative">
          {imageUrl ? (
            <div className="relative aspect-video rounded-xl overflow-hidden bg-muted">
              <img
                src={imageUrl}
                alt={recipe.title}
                className="w-full h-full object-cover"
              />
              {isUploadingImage && (
                <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              )}
              <div className="absolute bottom-2 right-2 flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 bg-card/90 backdrop-blur"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingImage}
                >
                  <Upload className="w-4 h-4 mr-1" />
                  {t('recipes.replace', 'Replace')}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-8"
                  onClick={handleDeleteImage}
                  disabled={isUploadingImage}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="aspect-video rounded-xl border-2 border-dashed border-border bg-muted/50 flex flex-col items-center justify-center gap-4">
              {isUploadingImage ? (
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              ) : (
                <>
                  <ImageIcon className="w-12 h-12 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {t('recipes.addPhoto', 'Add a photo of your recipe')}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => cameraInputRef.current?.click()}
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      {t('recipes.takePhoto', 'Camera')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {t('recipes.uploadPhoto', 'Upload')}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Ingredients Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">{t('recipes.ingredients')}</h3>
          <Button variant="ghost" size="sm" onClick={addIngredient}>
            <Plus className="w-4 h-4 mr-1" />
            {t('common.add', 'Add')}
          </Button>
        </div>
        <div className="space-y-2">
          {visibleIngredients.map((ing, idx) => {
            const originalIdx = ingredients.findIndex(i => i === ing);
            return (
              <div key={originalIdx} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <Input
                  placeholder="Qty"
                  value={ing.quantity}
                  onChange={(e) => updateIngredient(originalIdx, 'quantity', e.target.value)}
                  className="w-16 h-9"
                />
                <Input
                  placeholder="Unit"
                  value={ing.unit}
                  onChange={(e) => updateIngredient(originalIdx, 'unit', e.target.value)}
                  className="w-20 h-9"
                />
                <Input
                  placeholder="Ingredient name"
                  value={ing.name}
                  onChange={(e) => updateIngredient(originalIdx, 'name', e.target.value)}
                  className="flex-1 h-9"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-destructive hover:text-destructive"
                  onClick={() => removeIngredient(originalIdx)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            );
          })}
          {visibleIngredients.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t('recipes.noIngredientsYet', 'No ingredients yet. Click Add to add one.')}
            </p>
          )}
        </div>
      </div>

      {/* Steps Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">{t('recipes.instructions')}</h3>
          <Button variant="ghost" size="sm" onClick={addStep}>
            <Plus className="w-4 h-4 mr-1" />
            {t('common.add', 'Add')}
          </Button>
        </div>
        <div className="space-y-3">
          {visibleSteps.map((step, idx) => {
            const originalIdx = steps.findIndex(s => s === step);
            return (
              <div key={originalIdx} className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                  {idx + 1}
                </div>
                <div className="flex-1 flex gap-2">
                  <Textarea
                    placeholder="Instruction..."
                    value={step.instruction}
                    onChange={(e) => updateStep(originalIdx, e.target.value)}
                    className="min-h-[60px]"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-destructive hover:text-destructive flex-shrink-0"
                    onClick={() => removeStep(originalIdx)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
          {visibleSteps.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t('recipes.noStepsYet', 'No instructions yet. Click Add to add one.')}
            </p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t border-border">
        <Button
          variant="outline"
          className="flex-1"
          onClick={onCancel}
          disabled={isSaving}
        >
          <X className="w-4 h-4 mr-2" />
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          className="flex-1 gradient-primary"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {isSaving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
        </Button>
      </div>
    </div>
  );
}
