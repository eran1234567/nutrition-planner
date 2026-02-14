import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface RecipeWithImage {
  id: string;
  image_url: string | null;
}

const BATCH_SIZE = 5;
const SUPABASE_URL = 'https://vollogobxbnxyymzhhjq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvbGxvZ29ieGJueHl5bXpoaGpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyNDI4NTgsImV4cCI6MjA4MzgxODg1OH0.37hO8pCLsW38fpjzuGGByVKqgga9yVcLvLyccWsDpzo';

async function invokeBackfill(recipeIds: string[]) {
  const session = (await supabase.auth.getSession()).data.session;
  if (!session?.access_token) {
    return null;
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/backfill-recipe-images`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ recipeIds }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Backfill failed (${res.status}): ${text}`);
  }
  return res.json();
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

    const batch = missing.slice(0, BATCH_SIZE);
    batch.forEach((r) => triggeredIds.current.add(r.id));

    const ids = batch.map((r) => r.id);
    console.log(`Auto-backfilling images for ${ids.length} recipes (${missing.length} total missing)`);

    invokeBackfill(ids)
      .then((data) => {
        if (data) console.log('Auto backfill result:', data);
        else console.log('Auto backfill skipped: not signed in');
      })
      .catch((err) => console.error('Auto backfill images failed:', err));
  }, [recipes]);
}
