/**
 * Shared filter constants for recipe filtering
 * Used by both Discover and My Recipes pages
 */

export const timeFilterOptions = [
  { value: '15', label: '< 15 min' },
  { value: '30', label: '< 30 min' },
  { value: '45', label: '< 45 min' },
  { value: '60', label: '< 60 min' },
];

export const mealFilterOptions = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
];

export const cuisineFilterOptions = [
  { value: 'American', label: 'American' },
  { value: 'Italian', label: 'Italian' },
  { value: 'Mexican', label: 'Mexican' },
  { value: 'Asian', label: 'Asian' },
  { value: 'Mediterranean', label: 'Mediterranean' },
  { value: 'Indian', label: 'Indian' },
  { value: 'Japanese', label: 'Japanese' },
  { value: 'Korean', label: 'Korean' },
  { value: 'Thai', label: 'Thai' },
  { value: 'French', label: 'French' },
  { value: 'Greek', label: 'Greek' },
  { value: 'Brazilian', label: 'Brazilian' },
];

export const dietTypeOptions = [
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'pescatarian', label: 'Pescatarian' },
  { value: 'keto', label: 'Keto' },
  { value: 'paleo', label: 'Paleo' },
  { value: 'mediterranean', label: 'Mediterranean' },
];

export const allergyOptions = [
  { value: 'dairy', label: 'Dairy' },
  { value: 'gluten', label: 'Gluten' },
  { value: 'nuts', label: 'Nuts' },
  { value: 'peanuts', label: 'Peanuts' },
  { value: 'shellfish', label: 'Shellfish' },
  { value: 'soy', label: 'Soy' },
  { value: 'eggs', label: 'Eggs' },
  { value: 'fish', label: 'Fish' },
];

export const commonDislikes = [
  { value: 'mushrooms', label: 'Mushrooms' },
  { value: 'onions', label: 'Onions' },
  { value: 'garlic', label: 'Garlic' },
  { value: 'peppers', label: 'Bell Peppers' },
  { value: 'tomatoes', label: 'Tomatoes' },
  { value: 'cilantro', label: 'Cilantro' },
  { value: 'olives', label: 'Olives' },
  { value: 'spicy', label: 'Spicy' },
];

export const healthConsiderationOptions = [
  { value: 'diabetes-friendly', label: 'Diabetes Friendly' },
  { value: 'heart-healthy', label: 'Heart Healthy' },
  { value: 'low-sodium', label: 'Low Sodium' },
  { value: 'kidney-friendly', label: 'Kidney Friendly' },
];

// Diet exclusions for ingredient filtering
export const dietExclusions: Record<string, string[]> = {
  vegan: ['chicken', 'beef', 'pork', 'lamb', 'fish', 'salmon', 'tuna', 'shrimp', 'prawn', 'lobster', 'crab', 'shellfish', 'seafood', 'meat', 'bacon', 'ham', 'sausage', 'turkey', 'duck', 'veal', 'steak', 'egg', 'eggs', 'dairy', 'milk', 'cheese', 'butter', 'cream', 'yogurt', 'honey', 'cod', 'tilapia', 'halibut', 'mackerel', 'sardine', 'anchovy', 'trout', 'bass', 'snapper', 'mahi', 'swordfish', 'catfish', 'flounder', 'sole', 'haddock', 'perch', 'pike', 'scallop', 'mussel', 'clam', 'oyster', 'calamari', 'squid', 'octopus', 'crawfish', 'crayfish'],
  vegetarian: ['chicken', 'beef', 'pork', 'lamb', 'fish', 'salmon', 'tuna', 'shrimp', 'prawn', 'lobster', 'crab', 'shellfish', 'seafood', 'meat', 'bacon', 'ham', 'sausage', 'turkey', 'duck', 'veal', 'steak', 'cod', 'tilapia', 'halibut', 'mackerel', 'sardine', 'anchovy', 'trout', 'bass', 'snapper', 'mahi', 'swordfish', 'catfish', 'flounder', 'sole', 'haddock', 'perch', 'pike', 'scallop', 'mussel', 'clam', 'oyster', 'calamari', 'squid', 'octopus', 'crawfish', 'crayfish', 'poke', 'sashimi', 'moqueca', 'cioppino'],
  pescatarian: ['chicken', 'beef', 'pork', 'lamb', 'meat', 'bacon', 'ham', 'sausage', 'turkey', 'duck', 'veal', 'steak'],
  keto: ['bread', 'pasta', 'white rice', 'brown rice', 'jasmine rice', 'basmati rice', 'sticky rice', 'fried rice', 'rice bowl', 'rice pilaf', 'noodle', 'oatmeal', 'oat', 'cereal', 'granola', 'pancake', 'waffle', 'muffin', 'bagel', 'croissant', 'toast', 'tortilla', 'wrap', 'pita', 'couscous', 'quinoa', 'barley', 'wheat', 'flour', 'corn', 'potato', 'sweet potato', 'yam', 'bean', 'lentil', 'chickpea', 'hummus', 'pea', 'sugar', 'honey', 'maple syrup', 'agave', 'candy', 'cake', 'cookie', 'donut', 'pastry', 'pie', 'ice cream', 'frozen yogurt', 'banana', 'apple', 'orange', 'grape', 'mango', 'pineapple', 'watermelon', 'fruit salad', 'smoothie', 'juice', 'soda', 'açaí', 'acai', 'acai bowl', 'açaí bowl', 'oatmeal', 'porridge', 'risotto', 'polenta', 'grits', 'cornbread', 'biscuit', 'cracker', 'pretzel', 'chip', 'fries', 'french fries', 'hash brown', 'tater tot', 'breaded', 'battered', 'tempura', 'teriyaki', 'sweet and sour', 'bbq sauce', 'ketchup', 'jam', 'jelly', 'marmalade', 'dried fruit', 'raisin', 'date', 'fig', 'prune', 'apricot'],
  paleo: ['bread', 'pasta', 'white rice', 'brown rice', 'jasmine rice', 'basmati rice', 'sticky rice', 'fried rice', 'rice bowl', 'rice pilaf', 'noodle', 'grain', 'wheat', 'oat', 'oatmeal', 'corn', 'cornbread', 'polenta', 'grits', 'quinoa', 'barley', 'bulgur', 'couscous', 'farro', 'millet', 'rye', 'spelt', 'buckwheat', 'cereal', 'granola', 'cracker', 'pretzel', 'chip', 'tortilla', 'wrap', 'pita', 'bagel', 'muffin', 'pancake', 'waffle', 'croissant', 'biscuit', 'bean', 'lentil', 'chickpea', 'hummus', 'peanut', 'peanut butter', 'soy', 'tofu', 'tempeh', 'edamame', 'soy sauce', 'miso', 'black bean', 'kidney bean', 'pinto bean', 'navy bean', 'cannellini', 'fava', 'split pea', 'dairy', 'milk', 'cheese', 'yogurt', 'butter', 'cream', 'ice cream', 'sour cream', 'cottage cheese', 'cream cheese', 'whey', 'casein', 'sugar', 'cane sugar', 'brown sugar', 'powdered sugar', 'corn syrup', 'high fructose', 'agave', 'maple syrup', 'molasses', 'candy', 'cake', 'cookie', 'donut', 'pastry', 'pie', 'brownie', 'frosting', 'artificial sweetener', 'aspartame', 'sucralose', 'saccharin', 'vegetable oil', 'canola oil', 'soybean oil', 'corn oil', 'cottonseed oil', 'sunflower oil', 'safflower oil', 'margarine', 'shortening', 'processed', 'hot dog', 'deli meat', 'spam', 'bologna', 'salami'],
  mediterranean: ['beef', 'steak', 'pork', 'bacon', 'ham', 'sausage', 'hot dog', 'salami', 'pepperoni', 'bologna', 'deli meat', 'processed meat', 'ribs', 'brisket', 'pulled pork', 'carnitas', 'chorizo', 'bratwurst', 'kielbasa', 'spam', 'butter', 'margarine', 'lard', 'shortening', 'cream cheese', 'heavy cream', 'whipped cream', 'sugar', 'candy', 'cake', 'cookie', 'brownie', 'donut', 'pastry', 'pie', 'frosting', 'ice cream', 'milkshake', 'soda', 'soft drink', 'energy drink', 'sweetened', 'syrup', 'corn syrup', 'white bread', 'white rice', 'white flour', 'refined', 'processed', 'fried chicken', 'chicken nugget', 'french fries', 'onion rings', 'mozzarella sticks', 'fried', 'deep fried', 'battered', 'breaded', 'fast food', 'chips', 'cheetos', 'doritos', 'crackers', 'onigiri'],
  none: [],
};

// Allergy term expansions - map category allergies to specific ingredients
export const allergyExpansions: Record<string, string[]> = {
  gluten: ['wheat', 'flour', 'bread', 'pasta', 'noodle', 'barley', 'rye', 'oat', 'oatmeal', 'couscous', 'bulgur', 'farro', 'spelt', 'semolina', 'seitan', 'breaded', 'battered', 'cracker', 'pretzel', 'bagel', 'croissant', 'muffin', 'cake', 'cookie', 'pastry', 'pie crust', 'pizza', 'tortilla', 'wrap', 'panko', 'breadcrumb', 'soy sauce', 'teriyaki'],
  dairy: ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'whey', 'casein', 'lactose', 'ghee', 'ice cream', 'sour cream', 'cottage cheese', 'cream cheese', 'ricotta', 'mozzarella', 'parmesan', 'cheddar', 'feta', 'brie', 'gouda', 'swiss', 'provolone', 'mascarpone', 'half and half', 'heavy cream', 'whipped cream', 'condensed milk', 'evaporated milk', 'buttermilk', 'kefir', 'paneer', 'queso'],
  nuts: ['almond', 'walnut', 'cashew', 'pistachio', 'pecan', 'hazelnut', 'macadamia', 'brazil nut', 'pine nut', 'chestnut', 'nut butter', 'almond butter', 'almond milk', 'almond flour', 'marzipan', 'praline', 'nougat', 'pesto'],
  peanuts: ['peanut', 'peanut butter', 'peanut oil', 'groundnut', 'goober'],
  shellfish: ['shrimp', 'prawn', 'lobster', 'crab', 'crayfish', 'crawfish', 'scallop', 'clam', 'mussel', 'oyster', 'squid', 'calamari', 'octopus', 'langoustine', 'cockle', 'abalone', 'whelk', 'periwinkle'],
  soy: ['soy', 'soya', 'tofu', 'tempeh', 'edamame', 'miso', 'soy sauce', 'soy milk', 'soybean', 'soy protein', 'tamari', 'teriyaki'],
  eggs: ['egg', 'eggs', 'mayonnaise', 'mayo', 'aioli', 'meringue', 'custard', 'quiche', 'frittata', 'omelet', 'omelette', 'hollandaise', 'bearnaise', 'egg wash', 'egg noodle'],
  fish: ['fish', 'salmon', 'tuna', 'cod', 'tilapia', 'halibut', 'mackerel', 'sardine', 'anchovy', 'trout', 'bass', 'snapper', 'mahi', 'swordfish', 'catfish', 'flounder', 'sole', 'haddock', 'perch', 'pike', 'herring', 'fish sauce', 'worcestershire'],
};

// Dislike term expansions - map category dislikes to specific ingredients
export const dislikeExpansions: Record<string, string[]> = {
  spicy: ['jalapeño', 'jalapeno', 'habanero', 'serrano', 'cayenne', 'chipotle', 'ghost pepper', 'scotch bonnet', 'thai chili', 'bird eye', 'hot sauce', 'sriracha', 'tabasco', 'gochujang', 'harissa', 'wasabi', 'horseradish', 'chili flake', 'red pepper flake', 'crushed red pepper', 'chili powder', 'hot pepper', 'buffalo', 'kung pao', 'szechuan', 'sichuan', 'vindaloo', 'arrabbiata', 'diablo', 'fra diavolo', 'peri peri', 'piri piri', 'jerk', 'cajun', 'blackened', 'fiery', 'extra hot', 'very hot'],
  mushrooms: ['mushroom', 'shiitake', 'portobello', 'cremini', 'oyster mushroom', 'chanterelle', 'porcini', 'enoki', 'maitake', 'morel', 'truffle', 'funghi', 'fungi'],
  onions: ['onion', 'shallot', 'scallion', 'green onion', 'spring onion', 'leek', 'chive', 'red onion', 'white onion', 'yellow onion', 'vidalia', 'pearl onion', 'cipollini'],
  peppers: ['bell pepper', 'red bell pepper', 'green bell pepper', 'yellow bell pepper', 'orange bell pepper', 'sweet pepper', 'capsicum', 'pimento', 'pimiento', 'roasted pepper', 'roasted red pepper', 'stuffed pepper', 'poblano', 'anaheim pepper', 'banana pepper', 'cubanelle'],
  garlic: ['garlic', 'garlic clove', 'garlic powder', 'garlic salt', 'minced garlic', 'roasted garlic', 'garlic paste', 'garlic butter', 'garlic oil', 'black garlic', 'elephant garlic'],
  tomatoes: ['tomato', 'tomatoes', 'marinara', 'pomodoro', 'sun-dried tomato', 'cherry tomato', 'grape tomato', 'roma tomato', 'tomato sauce', 'tomato paste', 'salsa', 'bruschetta', 'pico de gallo', 'gazpacho'],
  cilantro: ['cilantro', 'coriander', 'culantro', 'fresh coriander'],
  olives: ['olive', 'kalamata', 'black olive', 'green olive', 'tapenade', 'olivada'],
};
