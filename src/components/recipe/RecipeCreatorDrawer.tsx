import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  ArrowLeft, 
  Loader2, 
  ImagePlus, 
  X, 
  Sparkles,
  ChevronDown,
  ChevronUp,
  Clock,
  Users,
  Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { IngredientInput, IngredientItem } from './IngredientInput';
import { LiveNutritionHeader } from './LiveNutritionHeader';

type InputMode = 'quick' | 'detailed';

interface RecipeCreatorDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (recipeId: string) => void;
}

export function RecipeCreatorDrawer({ open, onOpenChange, onSuccess }: RecipeCreatorDrawerProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isSaving, setIsSaving] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>('quick');
  
  // Quick mode fields
  const [title, setTitle] = useState('');
  const [recipeText, setRecipeText] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // Detailed mode fields
  const [ingredients, setIngredients] = useState<IngredientItem[]>([]);
  const [instructions, setInstructions] = useState('');
  const [servings, setServings] = useState('4');
  const [prepTime, setPrepTime] = useState('');
  const [cookTime, setCookTime] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const resetForm = useCallback(() => {
    setTitle('');
    setRecipeText('');
    setImagePreview(null);
    setIngredients([]);
    setInstructions('');
    setServings('4');
    setPrepTime('');
    setCookTime('');
    setShowAdvanced(false);
    setInputMode('quick');
  }, []);

  const handleClose = () => {
    onOpenChange(false);
    // Reset form after animation completes
    setTimeout(resetForm, 300);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(t('recipes.imageTooLarge', 'Image must be under 10MB'));
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setImagePreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const buildRecipeContent = (): string => {
    if (inputMode === 'quick') {
      return `${title}\n\n${recipeText}`;
    }

    // Detailed mode - construct structured content
    let content = title + '\n\n';
    
    if (servings) content += `Servings: ${servings}\n`;
    if (prepTime) content += `Prep time: ${prepTime} minutes\n`;
    if (cookTime) content += `Cook time: ${cookTime} minutes\n`;
    
    if (ingredients.length > 0) {
      content += '\nIngredients:\n';
      ingredients.forEach(ing => {
        const qty = ing.quantity ? `${ing.quantity} ` : '';
        const unit = ing.unit ? `${ing.unit} ` : '';
        let line = `- ${qty}${unit}${ing.name}`;
        
        // Include barcode nutrition data inline so AI preserves exact values
        if (ing.nutrition && ing.barcode) {
          const n = ing.nutrition;
          const parts: string[] = [];
          if (n.calories !== undefined) parts.push(`${n.calories} cal`);
          if (n.protein !== undefined) parts.push(`${n.protein}g protein`);
          if (n.fat !== undefined) parts.push(`${n.fat}g fat`);
          if (n.carbs !== undefined) parts.push(`${n.carbs}g carbs`);
          if (parts.length > 0) {
            line += ` (${parts.join(', ')} per serving - verified barcode data)`;
          }
        }
        
        content += line + '\n';
      });
    }
    
    if (instructions.trim()) {
      content += '\nInstructions:\n';
      content += instructions;
    }
    
    return content;
  };

  const handleSave = async () => {
    if (!user) {
      toast.error(t('common.loginRequired', 'Please log in'));
      return;
    }

    if (!title.trim()) {
      toast.error(t('recipes.titleRequired', 'Please enter a recipe title'));
      return;
    }

    const hasContent = inputMode === 'quick' 
      ? recipeText.trim() || imagePreview
      : ingredients.length > 0 || instructions.trim();

    if (!hasContent) {
      toast.error(t('recipes.contentRequired', 'Please add ingredients or instructions'));
      return;
    }

    setIsSaving(true);

    try {
      // Create upload record
      const { data: upload, error: uploadError } = await supabase
        .from('uploads')
        .insert({
          owner_user_id: user.id,
          status: 'pending',
          file_type: 'text',
          scope: 'private',
        })
        .select()
        .single();

      if (uploadError) throw uploadError;

      const fullContent = buildRecipeContent();
      const isImage = !!imagePreview && !recipeText.trim();

      // Call parse-recipe edge function using the SDK for proper auth handling
      const { data: result, error: fnError } = await supabase.functions.invoke('parse-recipe', {
        body: {
          uploadId: upload.id,
          content: isImage ? imagePreview : fullContent,
          isImage,
        },
      });

      if (fnError) {
        throw new Error(fnError.message || 'Failed to parse recipe');
      }

      if (!result.success || !result.recipes?.length) {
        throw new Error(result.error || 'Could not create recipe');
      }

      const recipe = result.recipes[0];

      // Update with user's title and image if provided
      const updates: Record<string, unknown> = { title: title.trim() };
      if (imagePreview) {
        updates.image_url = imagePreview;
      }
      
      await supabase.from('recipes').update(updates).eq('id', recipe.id);

      toast.success(t('recipes.createSuccess', 'Recipe created!'));
      handleClose();
      
      if (onSuccess) {
        onSuccess(recipe.id);
      } else {
        navigate(`/recipe/${recipe.id}`);
      }
    } catch (error) {
      console.error('Failed to create recipe:', error);
      toast.error(error instanceof Error ? error.message : t('recipes.createError', 'Failed to create recipe'));
    } finally {
      setIsSaving(false);
    }
  };

  const canSave = title.trim() && (
    inputMode === 'quick' 
      ? (recipeText.trim() || imagePreview)
      : (ingredients.length > 0 || instructions.trim())
  );

  return (
    <Drawer open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleClose();
      else onOpenChange(true);
    }}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="pb-2 border-b">
          <div className="flex items-center justify-between">
            <DrawerTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              {t('recipes.createRecipe', 'Create Recipe')}
            </DrawerTitle>
            <Button
              onClick={handleSave}
              disabled={isSaving || !canSave}
              size="sm"
              className="gradient-primary"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              {t('common.save', 'Save')}
            </Button>
          </div>
        </DrawerHeader>

        <div className="overflow-y-auto max-h-[calc(90vh-80px)] px-4 py-4 space-y-4">
          {/* Mode Toggle */}
          <div className="flex rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => setInputMode('quick')}
              className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                inputMode === 'quick' 
                  ? 'bg-background shadow-sm text-foreground' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('recipes.quickMode', 'Quick Mode')}
            </button>
            <button
              type="button"
              onClick={() => setInputMode('detailed')}
              className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                inputMode === 'detailed' 
                  ? 'bg-background shadow-sm text-foreground' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('recipes.detailedMode', 'Detailed Mode')}
            </button>
          </div>

          {/* Recipe Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-medium">
              {t('recipes.recipeTitle', 'Recipe Title')} *
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('recipes.titlePlaceholder', "e.g., Grandma's Chicken Soup")}
            />
          </div>

          {/* Image Upload */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            
            {imagePreview ? (
              <div className="relative rounded-xl overflow-hidden">
                <img 
                  src={imagePreview} 
                  alt="Recipe preview" 
                  className="w-full h-32 object-cover"
                />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-24 rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary"
              >
                <ImagePlus className="w-6 h-6" />
                <span className="text-xs">{t('recipes.addPhoto', 'Add photo (optional)')}</span>
              </button>
            )}
          </div>

          <AnimatePresence mode="wait">
            {inputMode === 'quick' ? (
              <motion.div
                key="quick"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                {/* Quick text input */}
                <div className="space-y-2">
                  <Label htmlFor="recipe-text" className="text-sm font-medium">
                    {t('recipes.recipeDetails', 'Recipe Details')}
                  </Label>
                  <Textarea
                    id="recipe-text"
                    value={recipeText}
                    onChange={(e) => setRecipeText(e.target.value)}
                    placeholder={t('recipes.quickPlaceholder', `Describe your recipe...

Ingredients:
- 2 chicken breasts
- Salt and pepper

Steps:
1. Season chicken
2. Grill until cooked`)}
                    className="min-h-[200px] resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('recipes.aiWillParse', 'AI will extract ingredients, steps, and calculate nutrition.')}
                  </p>
                </div>
              </motion.div>
            ) : (
            <motion.div
              key="detailed"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              {/* Live Nutrition Header */}
              <div className="sticky top-0 z-10 bg-background/95 backdrop-blur -mx-4 px-4 py-3 border-b border-border">
                <LiveNutritionHeader ingredients={ingredients} />
              </div>

              {/* Detailed inputs with barcode scanner */}
              <IngredientInput 
                ingredients={ingredients}
                onChange={setIngredients}
              />

                <div className="space-y-2">
                  <Label htmlFor="instructions" className="text-sm font-medium">
                    {t('recipes.instructions', 'Instructions')}
                  </Label>
                  <Textarea
                    id="instructions"
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder={t('recipes.instructionsPlaceholder', '1. First step...\n2. Second step...')}
                    className="min-h-[120px] resize-none"
                  />
                </div>

                {/* Advanced options */}
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {t('recipes.moreOptions', 'More options')}
                </button>

                <AnimatePresence>
                  {showAdvanced && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-3 gap-3 pt-2">
                        <div className="space-y-1">
                          <Label className="text-xs flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {t('recipes.servings', 'Servings')}
                          </Label>
                          <Input
                            type="number"
                            value={servings}
                            onChange={(e) => setServings(e.target.value)}
                            min="1"
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {t('recipes.prepMin', 'Prep (min)')}
                          </Label>
                          <Input
                            type="number"
                            value={prepTime}
                            onChange={(e) => setPrepTime(e.target.value)}
                            min="0"
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {t('recipes.cookMin', 'Cook (min)')}
                          </Label>
                          <Input
                            type="number"
                            value={cookTime}
                            onChange={(e) => setCookTime(e.target.value)}
                            min="0"
                            className="h-9"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          {/* AI Helper Note */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
            <Sparkles className="w-5 h-5 text-primary flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              {inputMode === 'quick'
                ? t('recipes.aiHelperQuick', "AI will format your recipe and calculate nutrition automatically.")
                : t('recipes.aiHelperDetailed', "Scan barcodes for accurate nutrition. AI fills in the rest.")
              }
            </p>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
