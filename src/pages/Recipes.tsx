import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Upload, Link, Camera, PenLine, BookOpen, Loader2, Trash2, X, MoreVertical, Pencil } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/PageHeader';
import { BottomNav } from '@/components/layout/BottomNav';
import { RecipeCard } from '@/components/recipe/RecipeCard';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';

interface RecipeNutrition {
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
}

interface UserRecipe {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  prep_time: number | null;
  cook_time: number | null;
  total_time: number | null;
  servings: number | null;
  is_kid_friendly: boolean | null;
  is_meal_prep_friendly: boolean | null;
  nutrition?: RecipeNutrition | null;
}

export default function Recipes() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [userRecipes, setUserRecipes] = useState<UserRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recipeToDelete, setRecipeToDelete] = useState<UserRecipe | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [processingUpload, setProcessingUpload] = useState<{ name: string; progress: number } | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [recipeToRename, setRecipeToRename] = useState<UserRecipe | null>(null);
  const [newRecipeName, setNewRecipeName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  const addOptions = [
    { icon: Upload, label: 'Upload file', desc: 'PDF, image, or doc', action: 'upload' },
    { icon: Link, label: 'Paste link', desc: 'From any website', action: 'link' },
    { icon: Camera, label: 'Take photo', desc: 'Snap a recipe', action: 'camera' },
    { icon: PenLine, label: 'Create manually', desc: 'Write your own', action: 'manual' },
  ];

  useEffect(() => {
    fetchUserRecipes();
  }, []);

  const handleDeleteClick = (recipe: UserRecipe) => {
    setRecipeToDelete(recipe);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!recipeToDelete) return;
    
    setIsDeleting(true);
    const { error } = await supabase
      .from('recipes')
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq('id', recipeToDelete.id);

    if (error) {
      toast.error(t('recipes.deleteError', 'Failed to delete recipe'));
    } else {
      setUserRecipes(prev => prev.filter(r => r.id !== recipeToDelete.id));
      toast.success(t('recipes.deleteSuccess', 'Recipe deleted'));
    }
    
    setIsDeleting(false);
    setDeleteDialogOpen(false);
    setRecipeToDelete(null);
  };

  const handleDeleteAllConfirm = async () => {
    setIsDeletingAll(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error(t('common.error', 'An error occurred'));
      setIsDeletingAll(false);
      return;
    }

    const { error } = await supabase
      .from('recipes')
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq('owner_user_id', user.id)
      .eq('is_deleted', false);

    if (error) {
      toast.error(t('recipes.deleteAllError', 'Failed to delete all recipes'));
    } else {
      setUserRecipes([]);
      toast.success(t('recipes.deleteAllSuccess', 'All recipes deleted'));
    }

    setIsDeletingAll(false);
    setDeleteAllDialogOpen(false);
  };

  const handleRenameClick = (recipe: UserRecipe) => {
    setRecipeToRename(recipe);
    setNewRecipeName(recipe.title);
    setRenameDialogOpen(true);
  };

  const handleRenameConfirm = async () => {
    if (!recipeToRename || !newRecipeName.trim()) return;
    
    setIsRenaming(true);
    const { error } = await supabase
      .from('recipes')
      .update({ title: newRecipeName.trim() })
      .eq('id', recipeToRename.id);

    if (error) {
      toast.error(t('recipes.renameError', 'Failed to rename recipe'));
    } else {
      setUserRecipes(prev => prev.map(r => 
        r.id === recipeToRename.id ? { ...r, title: newRecipeName.trim() } : r
      ));
      toast.success(t('recipes.renameSuccess', 'Recipe renamed'));
    }
    
    setIsRenaming(false);
    setRenameDialogOpen(false);
    setRecipeToRename(null);
    setNewRecipeName('');
  };

  const handleAddOption = (action: string) => {
    switch (action) {
      case 'upload':
        fileInputRef.current?.click();
        break;
      case 'link':
        setShowLinkInput(true);
        break;
      case 'camera':
        cameraInputRef.current?.click();
        break;
      case 'manual':
        navigate('/recipe/new');
        break;
    }
    setShowAddMenu(false);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error(t('common.loginRequired', 'Please log in'));
      return;
    }

    for (const file of Array.from(files)) {
      const isImage = file.type.startsWith('image/');
      const isDocument = file.type === 'application/pdf' || 
                         file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                         file.type === 'application/msword' ||
                         file.name.endsWith('.docx') || 
                         file.name.endsWith('.doc') || 
                         file.name.endsWith('.pdf');
      const isText = file.type.startsWith('text/') || file.type === 'application/json';

      let fileContent = '';
      if (isImage || isDocument) {
        fileContent = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      } else if (isText) {
        fileContent = await file.text();
      }

      let mimeType = file.type;
      if (!mimeType || mimeType === 'application/octet-stream') {
        const ext = file.name.toLowerCase().split('.').pop();
        const mimeMap: Record<string, string> = {
          'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'doc': 'application/msword',
          'pdf': 'application/pdf',
          'txt': 'text/plain',
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'gif': 'image/gif',
          'webp': 'image/webp',
        };
        mimeType = mimeMap[ext || ''] || 'application/octet-stream';
      }

      try {
        const { data: uploadData, error } = await supabase.from('uploads').insert({
          owner_user_id: user.id,
          file_name: file.name,
          file_type: mimeType,
          status: 'pending',
          scope: 'private'
        }).select().single();

        if (error) throw error;

        // Show processing state
        setShowAddMenu(true);
        setProcessingUpload({ name: file.name, progress: 10 });

        if (fileContent) {
          // Simulate progress
          const progressInterval = setInterval(() => {
            setProcessingUpload(prev => prev ? { ...prev, progress: Math.min(prev.progress + 15, 85) } : null);
          }, 800);

          const { data } = await supabase.functions.invoke('parse-recipe', {
            body: { 
              uploadId: uploadData.id, 
              content: fileContent,
              isImage: isImage
            },
          });

          clearInterval(progressInterval);
          setProcessingUpload(prev => prev ? { ...prev, progress: 100 } : null);

          if (data?.success) {
            toast.success(t('myRecipes.parseSuccess', `Found ${data.count} recipe(s)!`));
            await fetchUserRecipes();
          } else {
            toast.error(data?.error || t('myRecipes.parseError', 'Failed to parse recipe'));
          }

          // Close after short delay
          setTimeout(() => {
            setProcessingUpload(null);
            setShowAddMenu(false);
          }, 500);
        } else {
          toast.error(t('myRecipes.unsupportedFile', 'Unsupported file type'));
          await supabase.from('uploads').update({ status: 'failed', error_message: 'Unsupported file type' }).eq('id', uploadData.id);
          setProcessingUpload(null);
        }
      } catch (error) {
        if (import.meta.env.DEV) console.error('File upload error:', error);
        toast.error(t('myRecipes.uploadError', 'Failed to save file'));
        setProcessingUpload(null);
      }
    }
    
    if (event.target) event.target.value = '';
  };

  const handleAddLink = async () => {
    if (!linkUrl.trim()) return;
    
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(linkUrl);
    } catch {
      toast.error(t('myRecipes.invalidUrl', 'Please enter a valid URL'));
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error(t('common.loginRequired', 'Please log in'));
      return;
    }

    try {
      const { data: uploadData, error } = await supabase.from('uploads').insert({
        owner_user_id: user.id,
        source_url: linkUrl,
        file_name: parsedUrl.hostname,
        status: 'pending',
        scope: 'private'
      }).select().single();

      if (error) throw error;

      const urlToProcess = linkUrl;
      setLinkUrl('');
      setShowLinkInput(false);
      
      // Show processing state
      setShowAddMenu(true);
      setProcessingUpload({ name: parsedUrl.hostname, progress: 10 });

      // Simulate progress
      const progressInterval = setInterval(() => {
        setProcessingUpload(prev => prev ? { ...prev, progress: Math.min(prev.progress + 15, 85) } : null);
      }, 800);

      const { data } = await supabase.functions.invoke('parse-recipe', {
        body: { 
          uploadId: uploadData.id, 
          sourceUrl: urlToProcess
        },
      });

      clearInterval(progressInterval);
      setProcessingUpload(prev => prev ? { ...prev, progress: 100 } : null);

      if (data?.success) {
        toast.success(t('myRecipes.parseSuccess', `Found ${data.count} recipe(s)!`));
        await fetchUserRecipes();
      } else {
        toast.error(data?.error || t('myRecipes.parseError', 'Failed to parse recipe'));
      }

      // Close after short delay
      setTimeout(() => {
        setProcessingUpload(null);
        setShowAddMenu(false);
      }, 500);
    } catch (error) {
      toast.error(t('myRecipes.linkError', 'Failed to save link'));
      setProcessingUpload(null);
    }
  };

  const fetchUserRecipes = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: recipes, error } = await supabase
      .from('recipes')
      .select(`
        id,title,description,image_url,prep_time,cook_time,total_time,servings,is_kid_friendly,is_meal_prep_friendly,
        recipe_nutrition(calories,protein_g,carbs_g,fat_g)
      `)
      .eq('owner_user_id', user.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      if (import.meta.env.DEV) console.error('Failed to fetch recipes:', error);
      toast.error(t('recipes.loadError', 'Failed to load recipes'));
    } else if (recipes) {
      // Map recipes with nutrition
      const recipesWithNutrition = recipes.map((r: any) => ({
        ...r,
        nutrition: r.recipe_nutrition || null,
      }));
      setUserRecipes(recipesWithNutrition);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Hidden file inputs */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/*,.pdf,.doc,.docx,.txt"
        multiple
        className="hidden"
      />
      <input
        type="file"
        ref={cameraInputRef}
        onChange={handleFileSelect}
        accept="image/*"
        capture="environment"
        className="hidden"
      />

      <div className="page-container">
        <PageHeader
          title={t('recipes.myRecipes')}
          rightAction={
            <div className="flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost">
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem 
                    onClick={() => setDeleteAllDialogOpen(true)}
                    className="text-destructive focus:text-destructive"
                    disabled={userRecipes.length === 0}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {t('recipes.deleteAll', 'Delete All Recipes')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          }
        />

        {/* Add Recipe Menu */}
        {showAddMenu && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-card rounded-xl border border-border"
          >
            {processingUpload ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{t('recipes.processing', 'Processing Recipe')}</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => {
                      setProcessingUpload(null);
                      setShowAddMenu(false);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground truncate">{processingUpload.name}</p>
                <Progress value={processingUpload.progress} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">
                  {processingUpload.progress < 100 
                    ? t('recipes.parsingRecipe', 'Parsing recipe...') 
                    : t('recipes.parsingComplete', 'Complete!')}
                </p>
              </div>
            ) : (
              <>
                <h3 className="font-semibold mb-3">{t('recipes.addRecipe')}</h3>
                <div className="grid grid-cols-2 gap-2">
                  {addOptions.map((option) => (
                    <button
                      key={option.label}
                      onClick={() => handleAddOption(option.action)}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted hover:bg-secondary transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-lg bg-primary-soft flex items-center justify-center">
                        <option.icon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{option.label}</p>
                        <p className="text-xs text-muted-foreground">{option.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* Link Input Modal */}
        {showLinkInput && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-card rounded-xl border border-border space-y-3"
          >
            <h3 className="font-semibold">{t('recipes.pasteLink', 'Paste Recipe Link')}</h3>
            <div className="flex gap-2">
              <Input
                type="url"
                placeholder="https://..."
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddLink()}
                autoFocus
                className="flex-1"
              />
              <Button onClick={handleAddLink} disabled={!linkUrl.trim()}>
                {t('common.add', 'Add')}
              </Button>
              <Button variant="ghost" onClick={() => { setShowLinkInput(false); setLinkUrl(''); }}>
                {t('common.cancel', 'Cancel')}
              </Button>
            </div>
          </motion.div>
        )}

        {/* Empty State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : userRecipes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <BookOpen className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-1">{t('recipes.noRecipes')}</h3>
            <p className="text-muted-foreground text-sm mb-6">{t('recipes.noRecipesDesc')}</p>
            <Button onClick={() => navigate('/my-recipes')}>
              <Plus className="w-4 h-4 mr-2" />
              {t('recipes.addRecipe')}
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              {userRecipes.map((recipe) => (
                <div key={recipe.id} className="relative group">
                  <RecipeCard 
                    recipe={{
                      id: recipe.id,
                      title: recipe.title,
                      image_url: recipe.image_url || undefined,
                      total_time: recipe.total_time || undefined,
                      servings: recipe.servings || 4,
                      is_kid_friendly: recipe.is_kid_friendly || false,
                      is_meal_prep_friendly: recipe.is_meal_prep_friendly || false,
                      nutrition: recipe.nutrition,
                    }} 
                    onClick={() => navigate(`/recipe/${recipe.id}`)}
                    onDelete={() => handleDeleteClick(recipe)}
                  />
                  {/* Rename button overlay */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRenameClick(recipe);
                    }}
                    className="absolute top-2 left-2 w-8 h-8 rounded-full flex items-center justify-center bg-card/90 text-muted-foreground hover:bg-card opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    title={t('recipes.rename', 'Rename')}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Floating Add Button */}
      <AnimatePresence>
        {!showAddMenu && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setShowAddMenu(true)}
            className="fixed bottom-24 right-4 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors z-20"
          >
            <Plus className="w-6 h-6" />
          </motion.button>
        )}
      </AnimatePresence>

      <BottomNav />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('recipes.deleteTitle', 'Delete Recipe')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('recipes.deleteConfirm', 'Are you sure you want to delete "{{title}}"? This action cannot be undone.', { title: recipeToDelete?.title })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm} 
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? t('common.deleting', 'Deleting...') : t('common.delete', 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete All Confirmation Dialog */}
      <AlertDialog open={deleteAllDialogOpen} onOpenChange={setDeleteAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('recipes.deleteAllTitle', 'Delete All Recipes')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('recipes.deleteAllConfirm', 'Are you sure you want to delete all {{count}} recipes? This action cannot be undone.', { count: userRecipes.length })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingAll}>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteAllConfirm} 
              disabled={isDeletingAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingAll ? t('common.deleting', 'Deleting...') : t('recipes.deleteAll', 'Delete All')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename Dialog */}
      <AlertDialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('recipes.renameTitle', 'Rename Recipe')}</AlertDialogTitle>
            <AlertDialogDescription className="sr-only">
              {t('recipes.renameDesc', 'Enter a new name for your recipe')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={newRecipeName}
            onChange={(e) => setNewRecipeName(e.target.value)}
            placeholder={t('recipes.recipeName', 'Recipe name')}
            className="mt-2"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleRenameConfirm()}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRenaming}>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRenameConfirm} 
              disabled={isRenaming || !newRecipeName.trim()}
            >
              {isRenaming ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
