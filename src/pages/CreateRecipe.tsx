import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Plus, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { BottomNav } from '@/components/layout/BottomNav';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface IngredientInput {
  name: string;
  quantity: string;
  unit: string;
}

interface StepInput {
  instruction: string;
}

export default function CreateRecipe() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [cookTime, setCookTime] = useState('');
  const [servings, setServings] = useState('4');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [ingredients, setIngredients] = useState<IngredientInput[]>([
    { name: '', quantity: '', unit: '' }
  ]);
  const [steps, setSteps] = useState<StepInput[]>([{ instruction: '' }]);

  const addIngredient = () => {
    setIngredients([...ingredients, { name: '', quantity: '', unit: '' }]);
  };

  const removeIngredient = (index: number) => {
    if (ingredients.length > 1) {
      setIngredients(ingredients.filter((_, i) => i !== index));
    }
  };

  const updateIngredient = (index: number, field: keyof IngredientInput, value: string) => {
    const updated = [...ingredients];
    updated[index][field] = value;
    setIngredients(updated);
  };

  const addStep = () => {
    setSteps([...steps, { instruction: '' }]);
  };

  const removeStep = (index: number) => {
    if (steps.length > 1) {
      setSteps(steps.filter((_, i) => i !== index));
    }
  };

  const updateStep = (index: number, value: string) => {
    const updated = [...steps];
    updated[index].instruction = value;
    setSteps(updated);
  };

  const handleSave = async () => {
    if (!user) {
      toast.error(t('common.loginRequired', 'Please log in'));
      return;
    }

    if (!title.trim()) {
      toast.error(t('recipes.titleRequired', 'Recipe title is required'));
      return;
    }

    const validIngredients = ingredients.filter(i => i.name.trim());
    const validSteps = steps.filter(s => s.instruction.trim());

    if (validIngredients.length === 0) {
      toast.error(t('recipes.ingredientsRequired', 'At least one ingredient is required'));
      return;
    }

    setIsSaving(true);

    try {
      // Create recipe
      const totalTime = (parseInt(prepTime) || 0) + (parseInt(cookTime) || 0);
      const { data: recipe, error: recipeError } = await supabase
        .from('recipes')
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          prep_time: parseInt(prepTime) || null,
          cook_time: parseInt(cookTime) || null,
          total_time: totalTime || null,
          servings: parseInt(servings) || 4,
          owner_user_id: user.id,
          scope: 'private',
        })
        .select()
        .single();

      if (recipeError) throw recipeError;

      // Add nutrition if provided
      if (calories || protein || carbs || fat) {
        await supabase.from('recipe_nutrition').insert({
          recipe_id: recipe.id,
          calories: parseFloat(calories) || null,
          protein_g: parseFloat(protein) || null,
          carbs_g: parseFloat(carbs) || null,
          fat_g: parseFloat(fat) || null,
        });
      }

      // Add ingredients
      const ingredientRows = validIngredients.map((ing, index) => ({
        recipe_id: recipe.id,
        name: ing.name.trim(),
        quantity: parseFloat(ing.quantity) || null,
        unit: ing.unit.trim() || null,
        order_index: index,
      }));
      await supabase.from('recipe_ingredients').insert(ingredientRows);

      // Add steps
      const stepRows = validSteps.map((step, index) => ({
        recipe_id: recipe.id,
        step_number: index + 1,
        instruction: step.instruction.trim(),
      }));
      await supabase.from('recipe_steps').insert(stepRows);

      toast.success(t('recipes.createSuccess', 'Recipe created!'));
      navigate(`/recipe/${recipe.id}`);
    } catch (error) {
      console.error('Failed to create recipe:', error);
      toast.error(t('recipes.createError', 'Failed to create recipe'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="page-container py-4 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">{t('recipes.createRecipe', 'Create Recipe')}</h1>
          <Button onClick={handleSave} disabled={isSaving} size="sm">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : t('common.save', 'Save')}
          </Button>
        </div>
      </div>

      <div className="page-container py-6 space-y-6">
        {/* Basic Info */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="title">{t('recipes.title', 'Title')} *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('recipes.titlePlaceholder', 'e.g., Grilled Chicken Salad')}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="description">{t('recipes.description', 'Description')}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('recipes.descriptionPlaceholder', 'Brief description of your recipe...')}
              className="mt-1"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="prepTime">{t('recipes.prepTime', 'Prep (min)')}</Label>
              <Input
                id="prepTime"
                type="number"
                value={prepTime}
                onChange={(e) => setPrepTime(e.target.value)}
                placeholder="15"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="cookTime">{t('recipes.cookTime', 'Cook (min)')}</Label>
              <Input
                id="cookTime"
                type="number"
                value={cookTime}
                onChange={(e) => setCookTime(e.target.value)}
                placeholder="30"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="servings">{t('recipes.servings', 'Servings')}</Label>
              <Input
                id="servings"
                type="number"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
                placeholder="4"
                className="mt-1"
              />
            </div>
          </div>
        </div>

        {/* Nutrition */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm">{t('recipes.nutritionPerServing', 'Nutrition per serving')}</h3>
          <div className="grid grid-cols-4 gap-2">
            <div>
              <Label htmlFor="calories" className="text-xs">{t('recipes.calories', 'Calories')}</Label>
              <Input
                id="calories"
                type="number"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                placeholder="350"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="protein" className="text-xs">{t('recipes.protein', 'Protein (g)')}</Label>
              <Input
                id="protein"
                type="number"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
                placeholder="25"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="carbs" className="text-xs">{t('recipes.carbs', 'Carbs (g)')}</Label>
              <Input
                id="carbs"
                type="number"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
                placeholder="30"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="fat" className="text-xs">{t('recipes.fat', 'Fat (g)')}</Label>
              <Input
                id="fat"
                type="number"
                value={fat}
                onChange={(e) => setFat(e.target.value)}
                placeholder="15"
                className="mt-1"
              />
            </div>
          </div>
        </div>

        {/* Ingredients */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">{t('recipes.ingredients', 'Ingredients')} *</h3>
            <Button variant="ghost" size="sm" onClick={addIngredient}>
              <Plus className="w-4 h-4 mr-1" />
              {t('common.add', 'Add')}
            </Button>
          </div>
          <div className="space-y-2">
            {ingredients.map((ing, index) => (
              <div key={index} className="flex gap-2 items-start">
                <Input
                  value={ing.quantity}
                  onChange={(e) => updateIngredient(index, 'quantity', e.target.value)}
                  placeholder="1"
                  className="w-16"
                />
                <Input
                  value={ing.unit}
                  onChange={(e) => updateIngredient(index, 'unit', e.target.value)}
                  placeholder="cup"
                  className="w-20"
                />
                <Input
                  value={ing.name}
                  onChange={(e) => updateIngredient(index, 'name', e.target.value)}
                  placeholder={t('recipes.ingredientName', 'Ingredient name')}
                  className="flex-1"
                />
                {ingredients.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeIngredient(index)}
                    className="shrink-0"
                  >
                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">{t('recipes.instructions', 'Instructions')}</h3>
            <Button variant="ghost" size="sm" onClick={addStep}>
              <Plus className="w-4 h-4 mr-1" />
              {t('common.add', 'Add')}
            </Button>
          </div>
          <div className="space-y-3">
            {steps.map((step, index) => (
              <div key={index} className="flex gap-3 items-start">
                <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">
                  {index + 1}
                </div>
                <Textarea
                  value={step.instruction}
                  onChange={(e) => updateStep(index, e.target.value)}
                  placeholder={t('recipes.stepPlaceholder', 'Describe this step...')}
                  className="flex-1"
                  rows={2}
                />
                {steps.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeStep(index)}
                    className="shrink-0"
                  >
                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
