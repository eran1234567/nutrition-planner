import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Upload, Link, Camera, PenLine, BookOpen, Loader2 } from 'lucide-react';
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
  nutrition?: {
    calories: number | null;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
  } | null;
}

export default function Recipes() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [userRecipes, setUserRecipes] = useState<UserRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recipeToDelete, setRecipeToDelete] = useState<UserRecipe | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const addOptions = [
    { icon: Upload, label: 'Upload file', desc: 'PDF, image, or doc' },
    { icon: Link, label: 'Paste link', desc: 'From any website' },
    { icon: Camera, label: 'Take photo', desc: 'Snap a recipe' },
    { icon: PenLine, label: 'Create manually', desc: 'Write your own' },
  ];

  useEffect(() => {
    const fetchUserRecipes = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: recipes, error } = await supabase
        .from('recipes')
        .select(`
          id,
          title,
          description,
          image_url,
          prep_time,
          cook_time,
          total_time,
          servings,
          is_kid_friendly,
          is_meal_prep_friendly,
          recipe_nutrition (
            calories,
            protein_g,
            carbs_g,
            fat_g
          )
        `)
        .eq('owner_user_id', user.id)
        .is('is_deleted', false)
        .order('created_at', { ascending: false });

      if (!error && recipes) {
        const formattedRecipes = recipes.map(r => ({
          ...r,
          nutrition: r.recipe_nutrition?.[0] || null
        }));
        setUserRecipes(formattedRecipes);
      }
      setLoading(false);
    };

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

  return (
    <div className="min-h-screen bg-background pb-24">
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
                  nutrition: recipe.nutrition ? {
                    id: '',
                    recipe_id: recipe.id,
                    calories: recipe.nutrition.calories || undefined,
                    protein_g: recipe.nutrition.protein_g || undefined,
                    carbs_g: recipe.nutrition.carbs_g || undefined,
                    fat_g: recipe.nutrition.fat_g || undefined,
                  } : undefined,
                }} 
                onClick={() => navigate(`/recipe/${recipe.id}`)}
                onDelete={() => handleDeleteClick(recipe)}
                compact 
              />
            ))}
          </div>
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
    </div>
  );
}
