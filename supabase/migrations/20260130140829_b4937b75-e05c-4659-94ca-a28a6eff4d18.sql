-- Create ingredient_nutrition reference table for deterministic macro lookups
CREATE TABLE public.ingredient_nutrition (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  keywords text[] NOT NULL DEFAULT '{}',
  serving_description text NOT NULL DEFAULT '1 unit',
  calories integer NOT NULL DEFAULT 0,
  protein_g numeric NOT NULL DEFAULT 0,
  carbs_g numeric NOT NULL DEFAULT 0,
  fat_g numeric NOT NULL DEFAULT 0,
  fiber_g numeric NOT NULL DEFAULT 0,
  sugar_g numeric NOT NULL DEFAULT 0,
  sodium_mg numeric NOT NULL DEFAULT 0,
  saturated_fat_g numeric NOT NULL DEFAULT 0,
  cholesterol_mg numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS but allow public read access (reference data)
ALTER TABLE public.ingredient_nutrition ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view ingredient nutrition"
ON public.ingredient_nutrition
FOR SELECT
USING (true);

-- Seed with USDA reference data for common ingredients
INSERT INTO public.ingredient_nutrition (name, keywords, serving_description, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, saturated_fat_g, cholesterol_mg) VALUES
-- Eggs
('large_egg', ARRAY['egg', 'eggs', 'whole egg', 'large egg'], '1 large egg', 72, 6.3, 0.4, 4.8, 0, 0.4, 71, 1.6, 186),
('egg_yolk', ARRAY['egg yolk', 'yolk', 'yolks'], '1 large yolk', 55, 2.7, 0.6, 4.5, 0, 0.1, 8, 1.6, 184),
('egg_white', ARRAY['egg white', 'white', 'whites'], '1 large white', 17, 3.6, 0.2, 0.1, 0, 0.2, 55, 0, 0),

-- Avocado
('avocado_whole', ARRAY['avocado', 'whole avocado', 'medium avocado'], '1 medium avocado (201g)', 322, 4, 17, 29, 13, 1.3, 14, 4.3, 0),
('avocado_half', ARRAY['half avocado', '0.5 avocado', '1/2 avocado'], '1/2 medium avocado (100g)', 160, 2, 8.5, 14.7, 6.7, 0.7, 7, 2.1, 0),

-- Common Proteins
('chicken_breast', ARRAY['chicken breast', 'grilled chicken', 'chicken'], '100g cooked', 165, 31, 0, 3.6, 0, 0, 74, 1, 85),
('salmon', ARRAY['salmon', 'salmon fillet'], '100g cooked', 208, 20, 0, 13, 0, 0, 59, 3.1, 55),
('ground_beef_90_10', ARRAY['ground beef', 'lean beef', 'beef'], '100g cooked 90/10', 176, 26, 0, 8, 0, 0, 66, 3.1, 80),
('bacon', ARRAY['bacon', 'bacon strips'], '2 slices cooked', 86, 6, 0.2, 6.7, 0, 0, 274, 2.2, 18),
('shrimp', ARRAY['shrimp', 'prawns'], '100g cooked', 99, 24, 0.2, 0.3, 0, 0, 111, 0.1, 189),

-- Dairy
('butter', ARRAY['butter', 'tbsp butter'], '1 tbsp (14g)', 102, 0.1, 0, 11.5, 0, 0, 2, 7.3, 31),
('cheddar_cheese', ARRAY['cheddar', 'cheese', 'cheddar cheese'], '1 oz (28g)', 113, 7, 0.4, 9.3, 0, 0.1, 174, 5.9, 28),
('cream_cheese', ARRAY['cream cheese'], '1 oz (28g)', 99, 1.7, 1.6, 9.8, 0, 0.7, 91, 5.5, 29),
('heavy_cream', ARRAY['heavy cream', 'cream', 'whipping cream'], '1 tbsp (15ml)', 51, 0.4, 0.4, 5.4, 0, 0, 6, 3.4, 17),

-- Fats & Oils
('olive_oil', ARRAY['olive oil', 'evoo', 'extra virgin olive oil'], '1 tbsp (14g)', 119, 0, 0, 13.5, 0, 0, 0, 1.9, 0),
('coconut_oil', ARRAY['coconut oil'], '1 tbsp (14g)', 121, 0, 0, 13.5, 0, 0, 0, 11.2, 0),
('avocado_oil', ARRAY['avocado oil'], '1 tbsp (14g)', 124, 0, 0, 14, 0, 0, 0, 1.6, 0),

-- Keto Specialty
('keto_bread', ARRAY['keto bread', 'low carb bread'], '1 slice', 60, 6, 13, 2.5, 12, 0, 150, 0.5, 0),
('almond_flour', ARRAY['almond flour', 'almond meal'], '1/4 cup (28g)', 160, 6, 6, 14, 3, 1, 0, 1, 0),
('coconut_flour', ARRAY['coconut flour'], '2 tbsp (14g)', 60, 2, 8, 2, 5, 1, 10, 1.5, 0),

-- Vegetables
('broccoli', ARRAY['broccoli'], '1 cup chopped (91g)', 31, 2.5, 6, 0.3, 2.4, 1.5, 30, 0, 0),
('spinach', ARRAY['spinach'], '1 cup raw (30g)', 7, 0.9, 1.1, 0.1, 0.7, 0.1, 24, 0, 0),
('cauliflower', ARRAY['cauliflower', 'cauliflower rice'], '1 cup (100g)', 25, 2, 5, 0.1, 2.1, 2, 30, 0, 0),

-- Nuts & Seeds
('almonds', ARRAY['almonds'], '1 oz (28g)', 164, 6, 6, 14, 3.5, 1.2, 0, 1.1, 0),
('walnuts', ARRAY['walnuts'], '1 oz (28g)', 185, 4.3, 3.9, 18.5, 1.9, 0.7, 1, 1.7, 0),
('chia_seeds', ARRAY['chia seeds', 'chia'], '1 oz (28g)', 138, 4.7, 12, 8.7, 9.8, 0, 5, 0.9, 0),

-- Grains (for non-keto)
('white_rice', ARRAY['white rice', 'rice'], '1 cup cooked (158g)', 205, 4.3, 45, 0.4, 0.6, 0, 1, 0.1, 0),
('pasta', ARRAY['pasta', 'spaghetti', 'noodles'], '1 cup cooked (140g)', 220, 8, 43, 1.3, 2.5, 0.8, 1, 0.2, 0),
('bread_slice', ARRAY['bread', 'slice bread', 'toast'], '1 slice regular', 79, 2.7, 15, 1, 1, 1.5, 142, 0.2, 0);

-- Create index for keyword search
CREATE INDEX idx_ingredient_nutrition_keywords ON public.ingredient_nutrition USING GIN(keywords);