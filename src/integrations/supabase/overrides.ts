import { supabase } from './client';

export async function upsertBarcodeOverride(barcode: string, payload: {
  serving_quantity_grams?: number | null;
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  fiber_g?: number;
  sugar_g?: number;
  sodium_mg?: number;
  source?: string;
}) {
  const { data, error } = await supabase
    .from('barcode_nutrition_overrides')
    .upsert({ barcode, ...payload }, { onConflict: 'barcode' })
    .select()
    .single();

  if (error) {
    console.warn('[DB] failed to upsert barcode override', error);
    return { error };
  }
  return { data };
}
