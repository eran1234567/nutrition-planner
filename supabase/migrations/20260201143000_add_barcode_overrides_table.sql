-- Create a table to persist verified nutrition overrides for barcodes
CREATE TABLE IF NOT EXISTS public.barcode_nutrition_overrides (
  barcode text PRIMARY KEY,
  serving_quantity_grams numeric,
  calories numeric DEFAULT 0,
  protein_g numeric DEFAULT 0,
  carbs_g numeric DEFAULT 0,
  fat_g numeric DEFAULT 0,
  fiber_g numeric DEFAULT 0,
  sugar_g numeric DEFAULT 0,
  sodium_mg numeric DEFAULT 0,
  source text DEFAULT 'user',
  created_at timestamptz DEFAULT now()
);
