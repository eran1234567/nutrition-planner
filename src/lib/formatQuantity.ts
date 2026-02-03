/**
 * Format a quantity as a mixed number with Unicode fractions for display.
 * Keeps underlying data as floats for calculations, but shows user-friendly fractions.
 *
 * Examples:
 *   1.5  → "1½"
 *   0.25 → "¼"
 *   2.75 → "2¾"
 *   3    → "3"
 *   0.33 → "⅓"
 */
export function formatQuantityWithFractions(quantity: number | null): string {
  if (quantity === null || quantity === 0) return '';

  const whole = Math.floor(quantity);
  const decimal = quantity - whole;

  // Common fraction mappings (decimal → Unicode fraction)
  const fractions: Record<string, string> = {
    '0.125': '⅛',
    '0.25': '¼',
    '0.33': '⅓',
    '0.375': '⅜',
    '0.5': '½',
    '0.625': '⅝',
    '0.67': '⅔',
    '0.75': '¾',
    '0.875': '⅞',
  };

  // Round to 2 decimals and normalize string for lookup
  const decimalRounded = Math.round(decimal * 100) / 100;
  const decimalStr = decimalRounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');

  // Try to find a matching fraction
  const fraction = fractions[decimalStr];

  if (whole === 0 && fraction) {
    // Pure fraction like 0.5 → "½"
    return fraction;
  }

  if (whole === 0 && !fraction && decimalRounded > 0) {
    // Small decimal with no fraction match, show as decimal
    return decimalRounded.toString();
  }

  if (fraction) {
    // Mixed number like 2.5 → "2½"
    return `${whole}${fraction}`;
  }

  if (decimalRounded > 0) {
    // No fraction match, show whole + decimal (e.g., 2.15 → "2.15")
    return quantity.toFixed(2).replace(/\.?0+$/, '');
  }

  // Whole number
  return whole.toString();
}

/**
 * Format ingredient for display with quantity (as fraction) and unit.
 * Handles compound units like "6 oz fillets" → "4 fillets (6 oz each)".
 */
export function formatIngredientDisplay(
  qty: number | null,
  unit: string | null,
  name: string
): string {
  if (qty === null && !unit) return name;

  const formattedQty = formatQuantityWithFractions(qty);
  const unitStr = unit || '';

  // Check for compound units like "6 oz fillets" or "12 oz can"
  const compoundUnitMatch = unitStr.match(/^(\d+\s*(?:oz|g|lb|ml|fl oz))\s+(.+)$/i);

  if (compoundUnitMatch && qty !== null) {
    const [, size, baseUnit] = compoundUnitMatch;
    return `${formattedQty} ${baseUnit} (${size} each)`;
  }

  // Standard format: "2½ cups milk"
  const parts: string[] = [];
  if (formattedQty) parts.push(formattedQty);
  if (unitStr) parts.push(unitStr);

  return parts.length > 0 ? `${parts.join(' ')} ${name}` : name;
}
