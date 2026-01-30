/**
 * Shared Recipe Filters Bar Component
 * Used by both Discover and My Recipes pages
 */

import { Search, Clock, UtensilsCrossed, ChefHat, AlertTriangle, HeartPulse, Sparkles, HelpCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { FilterDropdown } from '@/components/discover/FilterDropdown';
import { MultiSelectDropdown } from '@/components/discover/MultiSelectDropdown';
import {
  timeFilterOptions,
  mealFilterOptions,
  cuisineFilterOptions,
  dietTypeOptions,
  allergyOptions,
  commonDislikes,
  healthConsiderationOptions,
} from '@/lib/filters/constants';
import type { RecipeFilterState, RecipeFilterActions } from '@/lib/filters/types';

interface RecipeFiltersBarProps {
  filters: RecipeFilterState;
  actions: RecipeFilterActions;
  showSearch?: boolean;
  showHelpButton?: boolean;
  onHelpClick?: () => void;
  className?: string;
}

export function RecipeFiltersBar({
  filters,
  actions,
  showSearch = true,
  showHelpButton = false,
  onHelpClick,
  className = '',
}: RecipeFiltersBarProps) {
  return (
    <div className={className}>
      {/* Search */}
      {showSearch && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search recipes..."
            value={filters.searchQuery}
            onChange={(e) => actions.setSearchQuery(e.target.value)}
            className="pl-10 h-12 text-base"
          />
        </div>
      )}

      {/* Filter Dropdowns */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-4">
        <FilterDropdown
          label="Meal"
          value={filters.selectedMealType}
          options={mealFilterOptions}
          onChange={actions.setSelectedMealType}
          icon={<UtensilsCrossed className="w-3 h-3" />}
        />
        
        <FilterDropdown
          label="Time"
          value={filters.selectedTime}
          options={timeFilterOptions}
          onChange={actions.setSelectedTime}
          icon={<Clock className="w-3 h-3" />}
        />
        
        <FilterDropdown
          label="Cuisine"
          value={filters.selectedCuisine}
          options={cuisineFilterOptions}
          onChange={actions.setSelectedCuisine}
          icon={<ChefHat className="w-3 h-3" />}
        />
        
        <FilterDropdown
          label="Diet"
          value={filters.selectedDietType}
          options={dietTypeOptions}
          onChange={actions.setSelectedDietType}
          icon={<Sparkles className="w-3 h-3" />}
        />
        
        <MultiSelectDropdown
          label="Allergies"
          values={filters.selectedAllergies}
          options={allergyOptions}
          onChange={actions.setSelectedAllergies}
          icon={<AlertTriangle className="w-3 h-3" />}
          allowCustom
          customPlaceholder="Add custom allergy..."
        />
        
        <MultiSelectDropdown
          label="Dislikes"
          values={filters.selectedDislikes}
          options={commonDislikes}
          onChange={actions.setSelectedDislikes}
          icon={<AlertTriangle className="w-3 h-3" />}
          allowCustom
          customPlaceholder="Add disliked ingredient..."
        />
        
        <MultiSelectDropdown
          label="Health"
          values={filters.selectedHealthConsiderations}
          options={healthConsiderationOptions}
          onChange={actions.setSelectedHealthConsiderations}
          icon={<HeartPulse className="w-3 h-3" />}
        />

        {showHelpButton && onHelpClick && (
          <button
            onClick={onHelpClick}
            className="flex items-center gap-1 px-3 py-2 rounded-full border border-border bg-card text-muted-foreground hover:bg-muted transition-colors shrink-0"
          >
            <HelpCircle className="w-3 h-3" />
            <span className="text-xs">Help</span>
          </button>
        )}
      </div>
    </div>
  );
}
