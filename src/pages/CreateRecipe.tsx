import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Loader2, ImagePlus, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { BottomNav } from '@/components/layout/BottomNav';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

export default function CreateRecipe() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [recipeText, setRecipeText] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(t('recipes.imageTooLarge', 'Image must be under 10MB'));
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setImagePreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImagePreview(null);
    setImageFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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

    if (!recipeText.trim()) {
      toast.error(t('recipes.textRequired', 'Please describe your recipe'));
      return;
    }

    setIsSaving(true);

    try {
      // Create an upload record first
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

      // Combine title with recipe text for AI parsing
      const fullContent = `${title}\n\n${recipeText}`;
      
      // Prepare the content - include image if provided
      let content = fullContent;
      let isImage = false;
      
      // If user provided an image, we'll send that for parsing along with text
      if (imagePreview) {
        isImage = true;
        content = imagePreview;
      }

      // Call the parse-recipe edge function
      const { data: session } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-recipe`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.session?.access_token}`,
          },
          body: JSON.stringify({
            uploadId: upload.id,
            content: isImage ? imagePreview : fullContent,
            isImage,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to parse recipe');
      }

      const result = await response.json();

      if (!result.success || !result.recipes?.length) {
        throw new Error(result.error || 'Could not extract recipe from text');
      }

      const recipe = result.recipes[0];

      // Update with user's title (AI may have extracted a different one)
      await supabase.from('recipes').update({
        title: title.trim(),
        ...(imagePreview ? { image_url: imagePreview } : {})
      }).eq('id', recipe.id);

      toast.success(t('recipes.createSuccess', 'Recipe created! You can edit it anytime.'));
      navigate(`/recipe/${recipe.id}`);
    } catch (error) {
      console.error('Failed to create recipe:', error);
      toast.error(error instanceof Error ? error.message : t('recipes.createError', 'Failed to create recipe'));
    } finally {
      setIsSaving(false);
    }
  };

  const canSave = title.trim() && recipeText.trim();

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 py-4 flex items-center justify-between max-w-3xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">{t('recipes.createRecipe', 'Create Recipe')}</h1>
          <Button 
            onClick={handleSave} 
            disabled={isSaving || !canSave} 
            size="sm"
            className="gradient-primary"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : t('common.save', 'Save')}
          </Button>
        </div>
      </div>

      <div className="px-4 py-6 max-w-3xl mx-auto space-y-6">
        {/* AI Helper Banner */}
        <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/10 border border-primary/20">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-medium text-sm">{t('recipes.aiHelper', 'AI-Powered')}</p>
            <p className="text-xs text-muted-foreground">
              {t('recipes.aiHelperDesc', 'Just describe your recipe - I\'ll format it and calculate nutrition!')}
            </p>
          </div>
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
            placeholder={t('recipes.titlePlaceholder', 'e.g., Grandma\'s Chicken Soup')}
            className="text-base"
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
                className="w-full h-48 object-cover"
              />
              <button
                onClick={removeImage}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-32 rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary"
            >
              <ImagePlus className="w-8 h-8" />
              <span className="text-sm">{t('recipes.addPhoto', 'Add a photo (optional)')}</span>
              <span className="text-xs">{t('recipes.aiGeneratesImage', 'AI will generate one if you don\'t add a photo')}</span>
            </button>
          )}
        </div>

        {/* Recipe Text Input */}
        <div className="space-y-2">
          <Label htmlFor="recipe-text" className="text-sm font-medium">
            {t('recipes.recipeDetails', 'Recipe Details')} *
          </Label>
          <Textarea
            id="recipe-text"
            value={recipeText}
            onChange={(e) => setRecipeText(e.target.value)}
            placeholder={t('recipes.writeRecipePlaceholder', `Write your recipe here in your own words...

Ingredients:
- 2 chicken breasts
- Mixed greens
- Cherry tomatoes
- Olive oil and lemon dressing

Instructions:
1. Season and grill chicken
2. Slice and arrange over greens
3. Add tomatoes and drizzle with dressing

Serves 2, takes about 20 minutes`)}
            className="min-h-[280px] text-base resize-none"
          />
          <p className="text-xs text-muted-foreground">
            {t('recipes.aiWillParse', 'AI will extract ingredients, instructions, and calculate nutrition automatically.')}
          </p>
        </div>

        {/* Tips */}
        <div className="p-4 rounded-xl bg-muted/50 space-y-2">
          <p className="font-medium text-sm">{t('recipes.tips', 'Tips for best results:')}</p>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• {t('recipes.tip1', 'Include ingredient quantities (e.g., "2 cups flour")')}</li>
            <li>• {t('recipes.tip2', 'Mention number of servings if known')}</li>
            <li>• {t('recipes.tip3', 'Add prep and cook times if you want')}</li>
            <li>• {t('recipes.tip4', 'You can edit the recipe anytime after saving')}</li>
          </ul>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
