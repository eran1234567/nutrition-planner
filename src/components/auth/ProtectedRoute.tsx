import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

// Prefetch user recipes on auth - makes Recipes tab instant
const prefetchUserRecipes = async (userId: string) => {
  const { data: recipes } = await supabase
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
    .eq('owner_user_id', userId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });

  return (recipes || []).map(r => ({
    ...r,
    nutrition: r.recipe_nutrition?.[0] || null
  }));
};

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading } = useAuth();
  const user = useAuthStore(state => state.user);
  const queryClient = useQueryClient();
  const location = useLocation();

  // Prefetch recipes when user is authenticated
  useEffect(() => {
    if (user?.id) {
      queryClient.prefetchQuery({
        queryKey: ['user-recipes', user.id],
        queryFn: () => prefetchUserRecipes(user.id),
        staleTime: 5 * 60 * 1000,
      });
    }
  }, [user?.id, queryClient]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth?mode=signup" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
