/**
 * Shared ingredient grouping utilities for the Neutron Engine.
 * Used by RecipeDetail, CookingMode, and any other component that displays
 * ingredients organized by sections (e.g., 'Main', 'Marinade', 'Sauce').
 */

export interface GroupableIngredient {
  section?: string | null;
  order_index?: number | null;
}

/**
 * Groups ingredients by their section field.
 * Ingredients without a section are assigned to 'Main'.
 */
export function groupIngredientsBySection<T extends GroupableIngredient>(
  ingredients: T[]
): Record<string, T[]> {
  const sections: Record<string, T[]> = {};
  for (const ing of ingredients) {
    const section = ing.section || 'Main';
    if (!sections[section]) {
      sections[section] = [];
    }
    sections[section].push(ing);
  }
  return sections;
}

/**
 * Returns section keys in display order:
 * - 'Main' always comes first
 * - Other sections sorted by the lowest order_index of their ingredients
 * - Alphabetical as a stable tie-breaker
 */
export function getSectionOrder<T extends GroupableIngredient>(
  ingredientsBySection: Record<string, T[]>
): string[] {
  const keys = Object.keys(ingredientsBySection);

  const minOrderIndexFor = (section: string): number => {
    if (section === 'Main') return -1;
    const items = ingredientsBySection[section] ?? [];
    let min = Number.POSITIVE_INFINITY;
    for (const ing of items) {
      const oi = ing.order_index;
      if (typeof oi === 'number' && Number.isFinite(oi)) {
        min = Math.min(min, oi);
      }
    }
    return Number.isFinite(min) ? min : Number.POSITIVE_INFINITY;
  };

  return keys.sort((a, b) => {
    if (a === 'Main') return -1;
    if (b === 'Main') return 1;
    const aMin = minOrderIndexFor(a);
    const bMin = minOrderIndexFor(b);
    if (aMin !== bMin) return aMin - bMin;
    return a.localeCompare(b);
  });
}

/**
 * Convenience function that groups ingredients and returns both
 * the grouped object and the ordered section keys.
 */
export function groupAndOrderIngredients<T extends GroupableIngredient>(
  ingredients: T[]
): { sections: Record<string, T[]>; sectionOrder: string[] } {
  const sections = groupIngredientsBySection(ingredients);
  const sectionOrder = getSectionOrder(sections);
  return { sections, sectionOrder };
}
