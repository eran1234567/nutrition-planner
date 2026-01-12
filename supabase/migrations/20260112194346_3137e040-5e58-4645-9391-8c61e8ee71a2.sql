-- Create enums
CREATE TYPE public.scope_type AS ENUM ('private', 'household', 'global');
CREATE TYPE public.upload_status AS ENUM ('pending', 'parsing', 'parsed', 'failed');
CREATE TYPE public.unit_system AS ENUM ('imperial', 'metric');
CREATE TYPE public.member_role AS ENUM ('owner', 'admin', 'member');
CREATE TYPE public.meal_type AS ENUM ('breakfast', 'lunch', 'dinner', 'snack');
CREATE TYPE public.diet_type AS ENUM ('none', 'vegetarian', 'vegan', 'pescatarian', 'keto', 'paleo', 'mediterranean');

-- Households table
CREATE TABLE public.households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_user_id UUID NOT NULL,
  locale TEXT DEFAULT 'en-US',
  units_default unit_system DEFAULT 'imperial',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL,
  household_id UUID REFERENCES public.households(id) ON DELETE SET NULL,
  display_name TEXT,
  avatar_url TEXT,
  age INTEGER,
  is_child BOOLEAN DEFAULT false,
  locale TEXT DEFAULT 'en-US',
  units unit_system DEFAULT 'imperial',
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Household members (for family mode)
CREATE TABLE public.household_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  member_name TEXT NOT NULL,
  avatar_url TEXT,
  age INTEGER,
  is_child BOOLEAN DEFAULT false,
  role member_role DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User preferences
CREATE TABLE public.preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  member_id UUID REFERENCES public.household_members(id) ON DELETE CASCADE,
  diet_type diet_type DEFAULT 'none',
  allergies TEXT[] DEFAULT '{}',
  dislikes TEXT[] DEFAULT '{}',
  calorie_target INTEGER,
  protein_target INTEGER,
  carbs_target INTEGER,
  fat_target INTEGER,
  fiber_target INTEGER,
  meals_per_day INTEGER DEFAULT 3,
  medical_diabetes_friendly BOOLEAN DEFAULT false,
  medical_kidney_friendly BOOLEAN DEFAULT false,
  medical_heart_healthy BOOLEAN DEFAULT false,
  medical_low_sodium BOOLEAN DEFAULT false,
  medical_disclaimer_accepted BOOLEAN DEFAULT false,
  max_cook_time INTEGER DEFAULT 60,
  budget_level TEXT DEFAULT 'medium',
  cuisines_preferred TEXT[] DEFAULT '{}',
  equipment_available TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT preference_owner CHECK (
    (profile_id IS NOT NULL AND member_id IS NULL) OR
    (profile_id IS NULL AND member_id IS NOT NULL)
  )
);

-- Recipes table
CREATE TABLE public.recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID,
  household_id UUID REFERENCES public.households(id) ON DELETE SET NULL,
  scope scope_type DEFAULT 'private',
  title TEXT NOT NULL,
  description TEXT,
  servings INTEGER DEFAULT 4,
  prep_time INTEGER,
  cook_time INTEGER,
  total_time INTEGER,
  cuisine TEXT,
  difficulty TEXT DEFAULT 'medium',
  notes TEXT,
  image_url TEXT,
  is_kid_friendly BOOLEAN DEFAULT false,
  is_meal_prep_friendly BOOLEAN DEFAULT false,
  is_budget_friendly BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Recipe ingredients
CREATE TABLE public.recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity DECIMAL,
  unit TEXT,
  normalized_name TEXT,
  aisle TEXT,
  order_index INTEGER DEFAULT 0
);

-- Recipe steps
CREATE TABLE public.recipe_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  instruction TEXT NOT NULL
);

-- Recipe nutrition
CREATE TABLE public.recipe_nutrition (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID UNIQUE NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  calories INTEGER,
  protein_g DECIMAL,
  carbs_g DECIMAL,
  fat_g DECIMAL,
  fiber_g DECIMAL,
  sodium_mg DECIMAL,
  sugar_g DECIMAL,
  saturated_fat_g DECIMAL,
  cholesterol_mg DECIMAL
);

-- Recipe tags
CREATE TABLE public.recipe_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  tag_type TEXT NOT NULL,
  tag_value TEXT NOT NULL
);

-- Uploads table
CREATE TABLE public.uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL,
  household_id UUID REFERENCES public.households(id) ON DELETE SET NULL,
  scope scope_type DEFAULT 'private',
  file_url TEXT,
  file_name TEXT,
  file_type TEXT,
  source_url TEXT,
  status upload_status DEFAULT 'pending',
  parsed_text TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Upload to recipe links
CREATE TABLE public.upload_recipe_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID NOT NULL REFERENCES public.uploads(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Meal plans
CREATE TABLE public.meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  household_id UUID REFERENCES public.households(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Meal plan days
CREATE TABLE public.meal_plan_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id UUID NOT NULL REFERENCES public.meal_plans(id) ON DELETE CASCADE,
  day_date DATE NOT NULL,
  day_index INTEGER NOT NULL
);

-- Meal plan meals
CREATE TABLE public.meal_plan_meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_day_id UUID NOT NULL REFERENCES public.meal_plan_days(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  meal_type meal_type NOT NULL,
  servings DECIMAL DEFAULT 1,
  is_leftover BOOLEAN DEFAULT false,
  leftover_from_meal_id UUID REFERENCES public.meal_plan_meals(id) ON DELETE SET NULL,
  notes TEXT
);

-- Grocery list items
CREATE TABLE public.grocery_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id UUID NOT NULL REFERENCES public.meal_plans(id) ON DELETE CASCADE,
  ingredient_name TEXT NOT NULL,
  quantity DECIMAL,
  unit TEXT,
  aisle TEXT,
  is_checked BOOLEAN DEFAULT false,
  is_pantry_staple BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Pantry staples (household level)
CREATE TABLE public.pantry_staples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES public.households(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Favorites
CREATE TABLE public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, recipe_id)
);

-- Enable RLS on all tables
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_nutrition ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_recipe_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plan_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plan_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grocery_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pantry_staples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for households
CREATE POLICY "Users can view own households" ON public.households FOR SELECT USING (owner_user_id = auth.uid());
CREATE POLICY "Users can create households" ON public.households FOR INSERT WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "Owners can update households" ON public.households FOR UPDATE USING (owner_user_id = auth.uid());

-- RLS Policies for recipes (global readable, own editable)
CREATE POLICY "Anyone can view global recipes" ON public.recipes FOR SELECT USING (scope = 'global' OR owner_user_id = auth.uid());
CREATE POLICY "Users can insert own recipes" ON public.recipes FOR INSERT WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "Users can update own recipes" ON public.recipes FOR UPDATE USING (owner_user_id = auth.uid());
CREATE POLICY "Users can delete own recipes" ON public.recipes FOR DELETE USING (owner_user_id = auth.uid());

-- RLS Policies for recipe sub-tables
CREATE POLICY "View recipe ingredients" ON public.recipe_ingredients FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.recipes WHERE id = recipe_id AND (scope = 'global' OR owner_user_id = auth.uid()))
);
CREATE POLICY "Manage own recipe ingredients" ON public.recipe_ingredients FOR ALL USING (
  EXISTS (SELECT 1 FROM public.recipes WHERE id = recipe_id AND owner_user_id = auth.uid())
);

CREATE POLICY "View recipe steps" ON public.recipe_steps FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.recipes WHERE id = recipe_id AND (scope = 'global' OR owner_user_id = auth.uid()))
);
CREATE POLICY "Manage own recipe steps" ON public.recipe_steps FOR ALL USING (
  EXISTS (SELECT 1 FROM public.recipes WHERE id = recipe_id AND owner_user_id = auth.uid())
);

CREATE POLICY "View recipe nutrition" ON public.recipe_nutrition FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.recipes WHERE id = recipe_id AND (scope = 'global' OR owner_user_id = auth.uid()))
);
CREATE POLICY "Manage own recipe nutrition" ON public.recipe_nutrition FOR ALL USING (
  EXISTS (SELECT 1 FROM public.recipes WHERE id = recipe_id AND owner_user_id = auth.uid())
);

CREATE POLICY "View recipe tags" ON public.recipe_tags FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.recipes WHERE id = recipe_id AND (scope = 'global' OR owner_user_id = auth.uid()))
);
CREATE POLICY "Manage own recipe tags" ON public.recipe_tags FOR ALL USING (
  EXISTS (SELECT 1 FROM public.recipes WHERE id = recipe_id AND owner_user_id = auth.uid())
);

-- RLS Policies for uploads
CREATE POLICY "Users can view own uploads" ON public.uploads FOR SELECT USING (owner_user_id = auth.uid());
CREATE POLICY "Users can insert own uploads" ON public.uploads FOR INSERT WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "Users can update own uploads" ON public.uploads FOR UPDATE USING (owner_user_id = auth.uid());
CREATE POLICY "Users can delete own uploads" ON public.uploads FOR DELETE USING (owner_user_id = auth.uid());

-- RLS Policies for meal plans
CREATE POLICY "Users can view own meal plans" ON public.meal_plans FOR SELECT USING (
  profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Users can create meal plans" ON public.meal_plans FOR INSERT WITH CHECK (
  profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Users can update own meal plans" ON public.meal_plans FOR UPDATE USING (
  profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- RLS for meal plan days/meals
CREATE POLICY "View meal plan days" ON public.meal_plan_days FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.meal_plans mp JOIN public.profiles p ON mp.profile_id = p.id WHERE mp.id = meal_plan_id AND p.user_id = auth.uid())
);
CREATE POLICY "Manage meal plan days" ON public.meal_plan_days FOR ALL USING (
  EXISTS (SELECT 1 FROM public.meal_plans mp JOIN public.profiles p ON mp.profile_id = p.id WHERE mp.id = meal_plan_id AND p.user_id = auth.uid())
);

CREATE POLICY "View meal plan meals" ON public.meal_plan_meals FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.meal_plan_days mpd JOIN public.meal_plans mp ON mpd.meal_plan_id = mp.id JOIN public.profiles p ON mp.profile_id = p.id WHERE mpd.id = meal_plan_day_id AND p.user_id = auth.uid())
);
CREATE POLICY "Manage meal plan meals" ON public.meal_plan_meals FOR ALL USING (
  EXISTS (SELECT 1 FROM public.meal_plan_days mpd JOIN public.meal_plans mp ON mpd.meal_plan_id = mp.id JOIN public.profiles p ON mp.profile_id = p.id WHERE mpd.id = meal_plan_day_id AND p.user_id = auth.uid())
);

-- RLS for grocery list
CREATE POLICY "View grocery items" ON public.grocery_list_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.meal_plans mp JOIN public.profiles p ON mp.profile_id = p.id WHERE mp.id = meal_plan_id AND p.user_id = auth.uid())
);
CREATE POLICY "Manage grocery items" ON public.grocery_list_items FOR ALL USING (
  EXISTS (SELECT 1 FROM public.meal_plans mp JOIN public.profiles p ON mp.profile_id = p.id WHERE mp.id = meal_plan_id AND p.user_id = auth.uid())
);

-- RLS for preferences
CREATE POLICY "View own preferences" ON public.preferences FOR SELECT USING (
  profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Manage own preferences" ON public.preferences FOR ALL USING (
  profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- RLS for favorites
CREATE POLICY "View own favorites" ON public.favorites FOR SELECT USING (
  profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Manage own favorites" ON public.favorites FOR ALL USING (
  profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- RLS for pantry staples
CREATE POLICY "View own pantry" ON public.pantry_staples FOR SELECT USING (
  profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Manage own pantry" ON public.pantry_staples FOR ALL USING (
  profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- RLS for household members
CREATE POLICY "View household members" ON public.household_members FOR SELECT USING (
  household_id IN (SELECT id FROM public.households WHERE owner_user_id = auth.uid())
);
CREATE POLICY "Manage household members" ON public.household_members FOR ALL USING (
  household_id IN (SELECT id FROM public.households WHERE owner_user_id = auth.uid())
);

-- RLS for upload recipe links
CREATE POLICY "View upload links" ON public.upload_recipe_links FOR SELECT USING (
  upload_id IN (SELECT id FROM public.uploads WHERE owner_user_id = auth.uid())
);
CREATE POLICY "Manage upload links" ON public.upload_recipe_links FOR ALL USING (
  upload_id IN (SELECT id FROM public.uploads WHERE owner_user_id = auth.uid())
);

-- Create trigger for profile creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_households_updated_at BEFORE UPDATE ON public.households FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_preferences_updated_at BEFORE UPDATE ON public.preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_recipes_updated_at BEFORE UPDATE ON public.recipes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();