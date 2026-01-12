import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Upload, Link, Camera, PenLine, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/PageHeader';
import { BottomNav } from '@/components/layout/BottomNav';
import { RecipeCard } from '@/components/recipe/RecipeCard';
import { seedRecipes } from '@/data/seedRecipes';
import { motion } from 'framer-motion';

export default function Recipes() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showAddMenu, setShowAddMenu] = useState(false);

  const addOptions = [
    { icon: Upload, label: 'Upload file', desc: 'PDF, image, or doc' },
    { icon: Link, label: 'Paste link', desc: 'From any website' },
    { icon: Camera, label: 'Take photo', desc: 'Snap a recipe' },
    { icon: PenLine, label: 'Create manually', desc: 'Write your own' },
  ];

  // For now, show seed recipes as examples
  const userRecipes = seedRecipes.slice(0, 4);

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
        {userRecipes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <BookOpen className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-1">{t('recipes.noRecipes')}</h3>
            <p className="text-muted-foreground text-sm mb-6">{t('recipes.noRecipesDesc')}</p>
            <Button onClick={() => setShowAddMenu(true)}>
              <Plus className="w-4 h-4 mr-2" />
              {t('recipes.addRecipe')}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {userRecipes.map((recipe) => (
              <RecipeCard 
                key={recipe.id} 
                recipe={recipe as any} 
                onClick={() => navigate(`/recipe/${recipe.id}`)}
                compact 
              />
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
