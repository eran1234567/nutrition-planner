import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Upload, Link, Camera, PenLine, BookOpen, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/PageHeader';
import { BottomNav } from '@/components/layout/BottomNav';
import { RecipeCard } from '@/components/recipe/RecipeCard';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
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
import { Input } from '@/components/ui/input';

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
  // nutrition fetched on detail page (avoid heavy joins on list view)
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

        toast.success(t('myRecipes.uploadSuccess', 'File added - parsing...'));

        if (fileContent) {
          supabase.functions.invoke('parse-recipe', {
            body: { 
              uploadId: uploadData.id, 
              content: fileContent,
              isImage: isImage
            },
          }).then(({ data }) => {
            if (data?.success) {
              toast.success(t('myRecipes.parseSuccess', `Found ${data.count} recipe(s)!`));
              // Refresh list
              fetchUserRecipes();
            } else {
              toast.error(data?.error || t('myRecipes.parseError', 'Failed to parse recipe'));
            }
          });
        } else {
          toast.error(t('myRecipes.unsupportedFile', 'Unsupported file type'));
          await supabase.from('uploads').update({ status: 'failed', error_message: 'Unsupported file type' }).eq('id', uploadData.id);
        }
      } catch (error) {
        console.error('File upload error:', error);
        toast.error(t('myRecipes.uploadError', 'Failed to save file'));
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

      toast.success(t('myRecipes.linkAdded', 'Link added - parsing...'));
      setLinkUrl('');
      setShowLinkInput(false);

      supabase.functions.invoke('parse-recipe', {
        body: { 
          uploadId: uploadData.id, 
          sourceUrl: linkUrl
        },
      }).then(({ data }) => {
        if (data?.success) {
          toast.success(t('myRecipes.parseSuccess', `Found ${data.count} recipe(s)!`));
          fetchUserRecipes();
        } else {
          toast.error(data?.error || t('myRecipes.parseError', 'Failed to parse recipe'));
        }
      });
    } catch (error) {
      toast.error(t('myRecipes.linkError', 'Failed to save link'));
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
      .select('id,title,description,image_url,prep_time,cook_time,total_time,servings,is_kid_friendly,is_meal_prep_friendly')
      .eq('owner_user_id', user.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('Failed to fetch recipes:', error);
      toast.error(t('recipes.loadError', 'Failed to load recipes'));
    } else if (recipes) {
      setUserRecipes(recipes);
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
            <Button size="icon" variant="ghost" onClick={() => setShowAddMenu(!showAddMenu)}>
              <Plus className="h-5 w-5" />
            </Button>
          }
        />

        {/* Add Recipe Menu */}
        {showAddMenu && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-card rounded-xl border border-border"
          >
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
            <div className="flex justify-end mb-4">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteAllDialogOpen(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {t('recipes.deleteAll', 'Delete All Recipes')}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {userRecipes.map((recipe) => (
                <RecipeCard 
                  key={recipe.id} 
                  recipe={{
                    id: recipe.id,
                    title: recipe.title,
                    scope: 'private',
                    image_url: recipe.image_url || undefined,
                    prep_time: recipe.prep_time || undefined,
                    cook_time: recipe.cook_time || undefined,
                    total_time: recipe.total_time || undefined,
                    servings: recipe.servings || 4,
                    difficulty: 'medium',
                    is_kid_friendly: recipe.is_kid_friendly || false,
                    is_meal_prep_friendly: recipe.is_meal_prep_friendly || false,
                    is_budget_friendly: false,
                    is_deleted: false,
                    created_at: '',
                    updated_at: '',
                  // nutrition loaded on detail page
                  }} 
                  onClick={() => navigate(`/recipe/${recipe.id}`)}
                  onDelete={() => handleDeleteClick(recipe)}
                  compact 
                />
              ))}
            </div>
          </>
        )}
      </div>

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
    </div>
  );
}
