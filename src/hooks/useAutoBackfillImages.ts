import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface RecipeWithImage {
  id: string;
  image_url: string | null;
}

export function useAutoBackfillImages(recipes: RecipeWithImage[]) {
  const triggeredIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!recipes || recipes.length === 0) return;

    const missing = recipes.filter(
      (r) =>
        !triggeredIds.current.has(r.id) &&
        (!r.image_url || r.image_url === '' || r.image_url.startsWith('data:'))
    );

    if (missing.length === 0) return;

    missing.forEach((r) => triggeredIds.current.add(r.id));

    const ids = missing.map((r) => r.id);

    supabase.functions
      .invoke('backfill-recipe-images', {
        body: { recipeIds: ids },
      })
      .catch((err) => console.error('Auto backfill images failed:', err));
  }, [recipes]);
}
