import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Upload, Link, Camera, PenLine, BookOpen, Loader2, Trash2, MoreVertical, Pencil, Search, Clock, UtensilsCrossed, ChefHat, Sparkles, AlertTriangle, HeartPulse } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/PageHeader';
import { BottomNav } from '@/components/layout/BottomNav';
import { RecipeCard } from '@/components/recipe/RecipeCard';
import { FilterDropdown } from '@/components/discover/FilterDropdown';
import { MultiSelectDropdown } from '@/components/discover/MultiSelectDropdown';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';

// Filter options (same as Discover page)
const timeFilterOptions = [
  { value: '15', label: '< 15 min' },
  { value: '30', label: '< 30 min' },
  { value: '45', label: '< 45 min' },
  { value: '60', label: '< 60 min' },
];

const mealFilterOptions = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
];

const cuisineFilterOptions = [
  { value: 'American', label: 'American' },
  { value: 'Italian', label: 'Italian' },
  { value: 'Mexican', label: 'Mexican' },
  { value: 'Asian', label: 'Asian' },
  { value: 'Mediterranean', label: 'Mediterranean' },
  { value: 'Indian', label: 'Indian' },
  { value: 'Japanese', label: 'Japanese' },
  { value: 'Thai', label: 'Thai' },
  { value: 'French', label: 'French' },
  { value: 'Greek', label: 'Greek' },
  { value: 'Brazilian', label: 'Brazilian' },
];

const dietTypeOptions = [
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'pescatarian', label: 'Pescatarian' },
  { value: 'keto', label: 'Keto' },
  { value: 'paleo', label: 'Paleo' },
  { value: 'mediterranean', label: 'Mediterranean' },
];

const allergyOptions = [
  { value: 'dairy', label: 'Dairy' },
  { value: 'gluten', label: 'Gluten' },
  { value: 'nuts', label: 'Nuts' },
  { value: 'peanuts', label: 'Peanuts' },
  { value: 'shellfish', label: 'Shellfish' },
  { value: 'soy', label: 'Soy' },
  { value: 'eggs', label: 'Eggs' },
  { value: 'fish', label: 'Fish' },
];

const commonDislikes = [
  { value: 'mushrooms', label: 'Mushrooms' },
  { value: 'onions', label: 'Onions' },
  { value: 'peppers', label: 'Bell Peppers' },
  { value: 'tomatoes', label: 'Tomatoes' },
  { value: 'cilantro', label: 'Cilantro' },
  { value: 'olives', label: 'Olives' },
  { value: 'spicy', label: 'Spicy' },
];

const healthConsiderationOptions = [
  { value: 'diabetes-friendly', label: 'Diabetes Friendly' },
  { value: 'heart-healthy', label: 'Heart Healthy' },
  { value: 'low-sodium', label: 'Low Sodium' },
  { value: 'kidney-friendly', label: 'Kidney Friendly' },
];

// Allergy/dislike term expansions
const allergyExpansions: Record<string, string[]> = {
  gluten: ['wheat', 'flour', 'bread', 'pasta', 'noodle', 'barley', 'rye', 'oat', 'oatmeal', 'couscous', 'bulgur', 'farro', 'spelt', 'semolina', 'seitan', 'breaded', 'battered', 'cracker', 'pretzel', 'bagel', 'croissant', 'muffin', 'cake', 'cookie', 'pastry', 'pie crust', 'pizza', 'tortilla', 'wrap', 'panko', 'breadcrumb', 'soy sauce', 'teriyaki'],
  dairy: ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'whey', 'casein', 'lactose', 'ghee', 'ice cream', 'sour cream', 'cottage cheese', 'cream cheese', 'ricotta', 'mozzarella', 'parmesan', 'cheddar', 'feta', 'brie', 'gouda', 'swiss', 'provolone', 'mascarpone', 'half and half', 'heavy cream', 'whipped cream', 'condensed milk', 'evaporated milk', 'buttermilk', 'kefir', 'paneer', 'queso'],
  nuts: ['almond', 'walnut', 'cashew', 'pistachio', 'pecan', 'hazelnut', 'macadamia', 'brazil nut', 'pine nut', 'chestnut', 'nut butter', 'almond butter', 'almond milk', 'almond flour', 'marzipan', 'praline', 'nougat', 'pesto'],
  peanuts: ['peanut', 'peanut butter', 'peanut oil', 'groundnut', 'goober'],
  shellfish: ['shrimp', 'prawn', 'lobster', 'crab', 'crayfish', 'crawfish', 'scallop', 'clam', 'mussel', 'oyster', 'squid', 'calamari', 'octopus', 'langoustine', 'cockle', 'abalone', 'whelk', 'periwinkle'],
  soy: ['soy', 'soya', 'tofu', 'tempeh', 'edamame', 'miso', 'soy sauce', 'soy milk', 'soybean', 'soy protein', 'tamari', 'teriyaki'],
  eggs: ['egg', 'eggs', 'mayonnaise', 'mayo', 'aioli', 'meringue', 'custard', 'quiche', 'frittata', 'omelet', 'omelette', 'hollandaise', 'bearnaise', 'egg wash', 'egg noodle'],
  fish: ['fish', 'salmon', 'tuna', 'cod', 'tilapia', 'halibut', 'mackerel', 'sardine', 'anchovy', 'trout', 'bass', 'snapper', 'mahi', 'swordfish', 'catfish', 'flounder', 'sole', 'haddock', 'perch', 'pike', 'herring', 'fish sauce', 'worcestershire'],
};

const dislikeExpansions: Record<string, string[]> = {
  spicy: ['jalapeño', 'jalapeno', 'habanero', 'serrano', 'cayenne', 'chipotle', 'ghost pepper', 'scotch bonnet', 'thai chili', 'bird eye', 'hot sauce', 'sriracha', 'tabasco', 'gochujang', 'harissa', 'wasabi', 'horseradish', 'chili flake', 'red pepper flake', 'crushed red pepper', 'chili powder', 'hot pepper', 'buffalo', 'kung pao', 'szechuan', 'sichuan', 'vindaloo', 'arrabbiata', 'diablo', 'fra diavolo', 'peri peri', 'piri piri', 'jerk', 'cajun', 'blackened', 'fiery', 'extra hot', 'very hot'],
  mushrooms: ['mushroom', 'shiitake', 'portobello', 'cremini', 'oyster mushroom', 'chanterelle', 'porcini', 'enoki', 'maitake', 'morel', 'truffle', 'funghi', 'fungi'],
  onions: ['onion', 'shallot', 'scallion', 'green onion', 'spring onion', 'leek', 'chive', 'red onion', 'white onion', 'yellow onion', 'vidalia', 'pearl onion', 'cipollini'],
  peppers: ['bell pepper', 'red bell pepper', 'green bell pepper', 'yellow bell pepper', 'orange bell pepper', 'sweet pepper', 'capsicum', 'pimento', 'pimiento', 'roasted pepper', 'roasted red pepper', 'stuffed pepper', 'poblano', 'anaheim pepper', 'banana pepper', 'cubanelle'],
  tomatoes: ['tomato', 'tomatoes', 'marinara', 'pomodoro', 'sun-dried tomato', 'cherry tomato', 'grape tomato', 'roma tomato', 'tomato sauce', 'tomato paste', 'salsa', 'bruschetta', 'pico de gallo', 'gazpacho'],
  cilantro: ['cilantro', 'coriander', 'culantro', 'fresh coriander'],
  olives: ['olive', 'kalamata', 'black olive', 'green olive', 'tapenade', 'olivada'],
};

interface RecipeNutrition {
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
}

interface RecipeIngredient {
  name: string;
  normalized_name: string | null;
}

interface RecipeTag {
  tag_type: string;
  tag_value: string;
}

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
  nutrition?: RecipeNutrition | null;
  ingredients?: RecipeIngredient[];
  tags?: RecipeTag[];
}

// Diet exclusions for auto-detection
const dietExclusions = {
  paleo: ['wheat', 'flour', 'bread', 'pasta', 'rice', 'corn', 'oat', 'grain', 'barley', 'rye', 'quinoa', 'legume', 'bean', 'lentil', 'pea', 'peanut', 'soy', 'tofu', 'milk', 'cheese', 'yogurt', 'cream', 'butter', 'dairy', 'sugar', 'syrup', 'honey', 'canola', 'vegetable oil', 'soybean oil'],
  mediterranean: ['bacon', 'sausage', 'hot dog', 'salami', 'pepperoni', 'processed meat', 'lard', 'margarine', 'candy', 'soda', 'white bread', 'white rice', 'onigiri']
};

// Keto thresholds
const KETO_MAX_CARBS = 8;
const KETO_MAX_CARB_PERCENT = 10;
const KETO_MAX_PROTEIN_PERCENT = 35;
const KETO_MIN_FAT_PERCENT = 60;

// Helper to check if a recipe meets strict keto macro criteria
const isKetoFriendly = (nutrition: RecipeNutrition | null | undefined): boolean => {
  if (!nutrition) return false;
  
  const carbs = nutrition.carbs_g ?? 0;
  const protein = nutrition.protein_g ?? 0;
  const fat = nutrition.fat_g ?? 0;
  
  if (carbs > KETO_MAX_CARBS) return false;
  
  const proteinCals = protein * 4;
  const fatCals = fat * 9;
  const carbCals = carbs * 4;
  const totalMacroCals = proteinCals + fatCals + carbCals;
  
  if (totalMacroCals <= 0) return false;
  
  const carbPercent = (carbCals / totalMacroCals) * 100;
  const proteinPercent = (proteinCals / totalMacroCals) * 100;
  const fatPercent = (fatCals / totalMacroCals) * 100;
  
  return carbPercent <= KETO_MAX_CARB_PERCENT && 
         proteinPercent <= KETO_MAX_PROTEIN_PERCENT && 
         fatPercent >= KETO_MIN_FAT_PERCENT;
};

const isPaleoFriendly = (ingredients: RecipeIngredient[] | undefined): boolean => {
  if (!ingredients || ingredients.length === 0) return false;
  return !ingredients.some(ing => {
    const ingName = (ing.normalized_name || ing.name || '').toLowerCase();
    return dietExclusions.paleo.some(excluded => ingName.includes(excluded));
  });
};

const isMediterraneanFriendly = (ingredients: RecipeIngredient[] | undefined): boolean => {
  if (!ingredients || ingredients.length === 0) return false;
  return !ingredients.some(ing => {
    const ingName = (ing.normalized_name || ing.name || '').toLowerCase();
    return dietExclusions.mediterranean.some(excluded => ingName.includes(excluded));
  });
};

// Build diet badges for a recipe
const getDietBadges = (recipe: UserRecipe): string[] => {
  const badges: string[] = [];
  const recipeDietTags = (recipe.tags || [])
    .filter(t => t.tag_type === 'diet')
    .map(t => t.tag_value.toLowerCase());
  
  // Keto: auto-detect from macros
  if (isKetoFriendly(recipe.nutrition)) badges.push('keto');
  
  // Paleo: auto-detect from ingredients or use tag
  if (recipeDietTags.includes('paleo') || isPaleoFriendly(recipe.ingredients)) badges.push('paleo');
  
  // Mediterranean: auto-detect from ingredients or use tag
  if (recipeDietTags.includes('mediterranean') || isMediterraneanFriendly(recipe.ingredients)) badges.push('mediterranean');
  
  // Vegan, vegetarian, pescatarian: rely on tags
  ['vegan', 'vegetarian', 'pescatarian'].forEach(diet => {
    if (recipeDietTags.includes(diet) && !badges.includes(diet)) {
      badges.push(diet);
    }
  });
  
  return badges;
};

export default function Recipes() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [userRecipes, setUserRecipes] = useState<UserRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recipeToDelete, setRecipeToDelete] = useState<UserRecipe | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [processingUpload, setProcessingUpload] = useState<{ name: string; progress: number } | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [recipeToRename, setRecipeToRename] = useState<UserRecipe | null>(null);
  const [newRecipeName, setNewRecipeName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  // URL-based filter state
  const searchQuery = searchParams.get('q') || '';
  const selectedTime = searchParams.get('time');
  const selectedMealType = searchParams.get('meal');
  const selectedCuisine = searchParams.get('cuisine');
  const selectedDietType = searchParams.get('diet');
  const selectedAllergies = useMemo(() => {
    const allergies = searchParams.get('allergies');
    return allergies ? allergies.split(',').filter(Boolean) : [];
  }, [searchParams]);
  const selectedDislikes = useMemo(() => {
    const dislikes = searchParams.get('dislikes');
    return dislikes ? dislikes.split(',').filter(Boolean) : [];
  }, [searchParams]);
  const selectedHealthConsiderations = useMemo(() => {
    const health = searchParams.get('health');
    return health ? health.split(',').filter(Boolean) : [];
  }, [searchParams]);

  // Helper to update URL params
  const updateSearchParams = useCallback((key: string, value: string | string[] | null) => {
    const newParams = new URLSearchParams(searchParams);
    if (value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
      newParams.delete(key);
    } else if (Array.isArray(value)) {
      newParams.set(key, value.join(','));
    } else {
      newParams.set(key, value);
    }
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  // Filter setters
  const setSearchQuery = useCallback((value: string) => updateSearchParams('q', value || null), [updateSearchParams]);
  const setSelectedTime = useCallback((value: string | null) => updateSearchParams('time', value), [updateSearchParams]);
  const setSelectedMealType = useCallback((value: string | null) => updateSearchParams('meal', value), [updateSearchParams]);
  const setSelectedCuisine = useCallback((value: string | null) => updateSearchParams('cuisine', value), [updateSearchParams]);
  const setSelectedDietType = useCallback((value: string | null) => updateSearchParams('diet', value), [updateSearchParams]);
  const setSelectedAllergies = useCallback((value: string[]) => updateSearchParams('allergies', value), [updateSearchParams]);
  const setSelectedDislikes = useCallback((value: string[]) => updateSearchParams('dislikes', value), [updateSearchParams]);
  const setSelectedHealthConsiderations = useCallback((value: string[]) => updateSearchParams('health', value), [updateSearchParams]);

  // Build blocked terms from allergies/dislikes
  const blockedTerms = useMemo(() => {
    const normalize = (v: string) => v.trim().toLowerCase();
    
    // Expand allergy terms
    const expandedAllergies = selectedAllergies.flatMap(allergy => {
      const allergyLower = allergy.toLowerCase();
      const expansions = allergyExpansions[allergyLower] || [];
      return [allergyLower, ...expansions];
    });
    
    // Expand dislike terms to include specific ingredients
    // When expansions exist, use ONLY the specific terms to avoid generic matches
    // (e.g., "peppers" → "pepper" would incorrectly match "black pepper")
    const expandedDislikes = selectedDislikes.flatMap(dislike => {
      const dislikeLower = dislike.toLowerCase();
      const expansions = dislikeExpansions[dislikeLower] || [];
      // If specific expansions exist, use only those; otherwise use the original term
      return expansions.length > 0 ? expansions : [dislikeLower];
    });
    
    const base = [...expandedAllergies, ...expandedDislikes].filter(Boolean).map(normalize).filter(Boolean);
    const expanded = base.flatMap((term) => {
      const variants = new Set<string>();
      variants.add(term);
      if (term.endsWith('s') && term.length > 1) variants.add(term.slice(0, -1));
      else variants.add(`${term}s`);
      return Array.from(variants);
    });
    return Array.from(new Set(expanded)).filter(Boolean);
  }, [selectedAllergies, selectedDislikes]);

  // Filter recipes
  const filteredRecipes = useMemo(() => {
    return userRecipes.filter(recipe => {
      // Search filter
      if (searchQuery) {
        const searchTerms = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
        const titleLower = recipe.title.toLowerCase();
        const descLower = (recipe.description || '').toLowerCase();
        const matchesSearch = searchTerms.every(term => 
          titleLower.includes(term) || descLower.includes(term)
        );
        if (!matchesSearch) return false;
      }
      
      // Time filter
      if (selectedTime && recipe.total_time && recipe.total_time > parseInt(selectedTime)) {
        return false;
      }
      
      // Meal type filter
      if (selectedMealType) {
        const mealTypesToMatch = selectedMealType === 'lunch' || selectedMealType === 'dinner' 
          ? ['lunch', 'dinner'] 
          : [selectedMealType];
        if (!recipe.tags?.some(t => t.tag_type === 'meal' && mealTypesToMatch.includes(t.tag_value))) {
          return false;
        }
      }
      
      // Cuisine filter
      // Note: User recipes may not have cuisine field, so we skip if no cuisine data
      
      // Diet type filter
      if (selectedDietType) {
        const dietBadges = getDietBadges(recipe);
        if (!dietBadges.includes(selectedDietType.toLowerCase())) {
          return false;
        }
      }
      
      // Allergies/dislikes filter
      if (blockedTerms.length > 0) {
        const titleLower = recipe.title.toLowerCase();
        const ingredientNames = (recipe.ingredients || []).map((ing) => (ing.normalized_name || ing.name || '').toLowerCase());
        const matchesBlocked = (text: string) => blockedTerms.some((term) => text.includes(term));
        const matchesBlockedIngredients = () => blockedTerms.some((term) => ingredientNames.some((name) => name.includes(term)));
        if (matchesBlocked(titleLower)) return false;
        if (matchesBlockedIngredients()) return false;
      }
      
      // Health considerations filter
      if (selectedHealthConsiderations.length > 0) {
        const recipeMedicalTags = (recipe.tags || []).filter(t => t.tag_type === 'medical').map(t => t.tag_value);
        const hasAllHealthTags = selectedHealthConsiderations.every(pref => recipeMedicalTags.includes(pref));
        if (!hasAllHealthTags) return false;
      }
      
      return true;
    });
  }, [userRecipes, searchQuery, selectedTime, selectedMealType, selectedDietType, blockedTerms, selectedHealthConsiderations]);

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

  const handleRenameClick = (recipe: UserRecipe) => {
    setRecipeToRename(recipe);
    setNewRecipeName(recipe.title);
    setRenameDialogOpen(true);
  };

  const handleRenameConfirm = async () => {
    if (!recipeToRename || !newRecipeName.trim()) return;
    
    setIsRenaming(true);
    const { error } = await supabase
      .from('recipes')
      .update({ title: newRecipeName.trim() })
      .eq('id', recipeToRename.id);

    if (error) {
      toast.error(t('recipes.renameError', 'Failed to rename recipe'));
    } else {
      setUserRecipes(prev => prev.map(r => 
        r.id === recipeToRename.id ? { ...r, title: newRecipeName.trim() } : r
      ));
      toast.success(t('recipes.renameSuccess', 'Recipe renamed'));
    }
    
    setIsRenaming(false);
    setRenameDialogOpen(false);
    setRecipeToRename(null);
    setNewRecipeName('');
  };

  const handleAddOption = (action: string) => {
    switch (action) {
      case 'upload':
        fileInputRef.current?.click();
        setShowAddDrawer(false);
        break;
      case 'link':
        // Keep drawer open, show link input inside it
        setShowLinkInput(true);
        break;
      case 'camera':
        cameraInputRef.current?.click();
        setShowAddDrawer(false);
        break;
      case 'manual':
        navigate('/recipe/new');
        setShowAddDrawer(false);
        break;
    }
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

        // Keep drawer open to show progress
        setProcessingUpload({ name: file.name, progress: 10 });

        if (fileContent) {
          // Simulate progress
          const progressInterval = setInterval(() => {
            setProcessingUpload(prev => prev ? { ...prev, progress: Math.min(prev.progress + 15, 85) } : null);
          }, 800);

          const { data } = await supabase.functions.invoke('parse-recipe', {
            body: { 
              uploadId: uploadData.id, 
              content: fileContent,
              isImage: isImage
            },
          });

          clearInterval(progressInterval);
          setProcessingUpload(prev => prev ? { ...prev, progress: 100 } : null);

          if (data?.success) {
            toast.success(t('myRecipes.parseSuccess', `Found ${data.count} recipe(s)!`));
            await fetchUserRecipes();
          } else {
            toast.error(data?.error || t('myRecipes.parseError', 'Failed to parse recipe'));
          }

          // Close drawer after short delay
          setTimeout(() => {
            setProcessingUpload(null);
            setShowAddDrawer(false);
          }, 500);
        } else {
          toast.error(t('myRecipes.unsupportedFile', 'Unsupported file type'));
          await supabase.from('uploads').update({ status: 'failed', error_message: 'Unsupported file type' }).eq('id', uploadData.id);
          setProcessingUpload(null);
        }
      } catch (error) {
        if (import.meta.env.DEV) console.error('File upload error:', error);
        toast.error(t('myRecipes.uploadError', 'Failed to save file'));
        setProcessingUpload(null);
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

      const urlToProcess = linkUrl;
      setLinkUrl('');
      setShowLinkInput(false);
      
      // Keep drawer open to show progress
      setProcessingUpload({ name: parsedUrl.hostname, progress: 10 });

      // Simulate progress
      const progressInterval = setInterval(() => {
        setProcessingUpload(prev => prev ? { ...prev, progress: Math.min(prev.progress + 15, 85) } : null);
      }, 800);

      const { data } = await supabase.functions.invoke('parse-recipe', {
        body: { 
          uploadId: uploadData.id, 
          sourceUrl: urlToProcess
        },
      });

      clearInterval(progressInterval);
      setProcessingUpload(prev => prev ? { ...prev, progress: 100 } : null);

      if (data?.success) {
        toast.success(t('myRecipes.parseSuccess', `Found ${data.count} recipe(s)!`));
        await fetchUserRecipes();
      } else {
        toast.error(data?.error || t('myRecipes.parseError', 'Failed to parse recipe'));
      }

      // Close drawer after short delay
      setTimeout(() => {
        setProcessingUpload(null);
        setShowAddDrawer(false);
      }, 500);
    } catch (error) {
      toast.error(t('myRecipes.linkError', 'Failed to save link'));
      setProcessingUpload(null);
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
      .select(`
        id,title,description,image_url,prep_time,cook_time,total_time,servings,is_kid_friendly,is_meal_prep_friendly,
        recipe_nutrition(calories,protein_g,carbs_g,fat_g),
        recipe_ingredients(name,normalized_name),
        recipe_tags(tag_type,tag_value)
      `)
      .eq('owner_user_id', user.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      if (import.meta.env.DEV) console.error('Failed to fetch recipes:', error);
      toast.error(t('recipes.loadError', 'Failed to load recipes'));
    } else if (recipes) {
      // Map recipes with nutrition, ingredients and tags
      const recipesWithData = recipes.map((r: any) => ({
        ...r,
        nutrition: Array.isArray(r.recipe_nutrition) ? r.recipe_nutrition[0] : r.recipe_nutrition || null,
        ingredients: r.recipe_ingredients || [],
        tags: r.recipe_tags || [],
      }));
      setUserRecipes(recipesWithData);
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
            <div className="flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost">
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem 
                    onClick={() => setDeleteAllDialogOpen(true)}
                    className="text-destructive focus:text-destructive"
                    disabled={userRecipes.length === 0}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {t('recipes.deleteAll', 'Delete All Recipes')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          }
        />

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder={t('discover.searchPlaceholder', 'Search recipes...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 text-base"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-4 mb-4">
          <FilterDropdown
            label="Meal"
            value={selectedMealType}
            options={mealFilterOptions}
            onChange={setSelectedMealType}
            icon={<UtensilsCrossed className="w-3 h-3" />}
          />
          
          <FilterDropdown
            label="Time"
            value={selectedTime}
            options={timeFilterOptions}
            onChange={setSelectedTime}
            icon={<Clock className="w-3 h-3" />}
          />
          
          <FilterDropdown
            label="Diet Type"
            value={selectedDietType}
            options={dietTypeOptions}
            onChange={setSelectedDietType}
            icon={<Sparkles className="w-3 h-3" />}
          />
          
          <MultiSelectDropdown
            label="Allergies"
            values={selectedAllergies}
            options={allergyOptions}
            onChange={setSelectedAllergies}
            icon={<AlertTriangle className="w-3 h-3" />}
            allowCustom
            customPlaceholder="Add allergy..."
          />
          
          <MultiSelectDropdown
            label="Dislikes"
            values={selectedDislikes}
            options={commonDislikes}
            onChange={setSelectedDislikes}
            allowCustom
            customPlaceholder="Add dislike..."
          />
          
          <MultiSelectDropdown
            label="Health"
            values={selectedHealthConsiderations}
            options={healthConsiderationOptions}
            onChange={setSelectedHealthConsiderations}
            icon={<HeartPulse className="w-3 h-3" />}
          />
        </div>

        {/* Recipe count */}
        {!loading && userRecipes.length > 0 && (
          <p className="text-sm text-muted-foreground mb-4">
            {filteredRecipes.length === userRecipes.length 
              ? t('recipes.showingAll', '{{count}} recipes', { count: userRecipes.length })
              : t('recipes.showingFiltered', '{{filtered}} of {{total}} recipes', { filtered: filteredRecipes.length, total: userRecipes.length })
            }
          </p>
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
        ) : filteredRecipes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-1">{t('recipes.noMatchingRecipes', 'No matching recipes')}</h3>
            <p className="text-muted-foreground text-sm mb-6">{t('recipes.tryDifferentFilters', 'Try adjusting your filters')}</p>
            <Button variant="outline" onClick={() => setSearchParams(new URLSearchParams())}>
              {t('recipes.clearFilters', 'Clear Filters')}
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 auto-rows-fr">
              {filteredRecipes.map((recipe) => (
                <div key={recipe.id} className="relative group h-full">
                  <RecipeCard 
                    recipe={{
                      id: recipe.id,
                      title: recipe.title,
                      image_url: recipe.image_url || undefined,
                      total_time: recipe.total_time || undefined,
                      servings: recipe.servings || 4,
                      is_kid_friendly: recipe.is_kid_friendly || false,
                      is_meal_prep_friendly: recipe.is_meal_prep_friendly || false,
                      nutrition: recipe.nutrition,
                    }} 
                    dietBadges={getDietBadges(recipe)}
                    onClick={() => navigate(`/recipe/${recipe.id}`)}
                    onDelete={() => handleDeleteClick(recipe)}
                  />
                  {/* Rename button overlay */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRenameClick(recipe);
                    }}
                    className="absolute top-2 left-2 w-8 h-8 rounded-full flex items-center justify-center bg-card/90 text-muted-foreground hover:bg-card opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    title={t('recipes.rename', 'Rename')}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Floating Add Button */}
      <motion.button
        onClick={() => setShowAddDrawer(true)}
        className="fixed bottom-24 right-4 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors z-20"
        whileTap={{ scale: 0.95 }}
      >
        <Plus className="w-6 h-6" />
      </motion.button>

      {/* Add Recipe Drawer */}
      <Drawer open={showAddDrawer} onOpenChange={(open) => {
        setShowAddDrawer(open);
        if (!open) {
          setShowLinkInput(false);
          setLinkUrl('');
        }
      }}>
        <DrawerContent className="pb-8">
          <DrawerHeader className="pb-2">
            <DrawerTitle>
              {processingUpload 
                ? t('recipes.processing', 'Processing Recipe')
                : t('recipes.addRecipe', 'Add Recipe')
              }
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4">
            {processingUpload ? (
              <div className="space-y-3 py-4">
                <p className="text-sm text-muted-foreground truncate">{processingUpload.name}</p>
                <Progress value={processingUpload.progress} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">
                  {processingUpload.progress < 100 
                    ? t('recipes.parsingRecipe', 'Parsing recipe...') 
                    : t('recipes.parsingComplete', 'Complete!')}
                </p>
              </div>
            ) : showLinkInput ? (
              <div className="space-y-3 py-2">
                <Input
                  type="url"
                  placeholder="https://..."
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddLink()}
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button onClick={handleAddLink} disabled={!linkUrl.trim()} className="flex-1">
                    {t('common.add', 'Add')}
                  </Button>
                  <Button variant="outline" onClick={() => { setShowLinkInput(false); setLinkUrl(''); }}>
                    {t('common.cancel', 'Cancel')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 py-2">
                {addOptions.map((option) => (
                  <button
                    key={option.label}
                    onClick={() => handleAddOption(option.action)}
                    className="flex items-center gap-3 p-3 rounded-xl bg-muted hover:bg-secondary transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <option.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{option.label}</p>
                      <p className="text-xs text-muted-foreground">{option.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

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

      {/* Rename Dialog */}
      <AlertDialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('recipes.renameTitle', 'Rename Recipe')}</AlertDialogTitle>
            <AlertDialogDescription className="sr-only">
              {t('recipes.renameDesc', 'Enter a new name for your recipe')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={newRecipeName}
            onChange={(e) => setNewRecipeName(e.target.value)}
            placeholder={t('recipes.recipeName', 'Recipe name')}
            className="mt-2"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleRenameConfirm()}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRenaming}>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRenameConfirm} 
              disabled={isRenaming || !newRecipeName.trim()}
            >
              {isRenaming ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
