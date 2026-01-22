import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, Check, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface MultiSelectDropdownProps {
  label: string;
  values: string[];
  options: { value: string; label: string }[];
  onChange: (values: string[]) => void;
  icon?: React.ReactNode;
  placeholder?: string;
  className?: string;
  allowCustom?: boolean;
  customPlaceholder?: string;
}

export function MultiSelectDropdown({
  label,
  values,
  options,
  onChange,
  icon,
  placeholder,
  className,
  allowCustom = false,
  customPlaceholder,
}: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const [customInput, setCustomInput] = useState('');
  
  const toggleValue = (value: string) => {
    if (values.includes(value)) {
      onChange(values.filter(v => v !== value));
    } else {
      onChange([...values, value]);
    }
  };

  const addCustomValue = () => {
    const trimmed = customInput.trim().toLowerCase();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setCustomInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCustomValue();
    }
  };

  // Get custom values (values not in predefined options)
  const optionValues = options.map(o => o.value.toLowerCase());
  const customValues = values.filter(v => !optionValues.includes(v.toLowerCase()));
  
  const displayText = values.length === 0 
    ? (placeholder || label)
    : values.length === 1 
      ? options.find(o => o.value === values[0])?.label || values[0]
      : `${values.length} selected`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-9 w-auto px-3 justify-between bg-background border-border text-sm font-normal whitespace-nowrap",
            values.length > 0 && "border-primary bg-primary/5",
            className
          )}
        >
          <div className="flex items-center gap-1.5">
            {icon && <span className="flex-shrink-0 opacity-60">{icon}</span>}
            <span>{displayText}</span>
          </div>
          <ChevronDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0 bg-popover border border-border shadow-lg" align="start">
        <div className="max-h-[350px] overflow-y-auto">
          {/* Custom input for adding new items */}
          {allowCustom && (
            <div className="p-2 border-b border-border">
              <div className="flex gap-1">
                <Input
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={customPlaceholder || `Add custom ${label.toLowerCase()}...`}
                  className="h-8 text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={addCustomValue}
                  disabled={!customInput.trim()}
                >
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}

          {values.length > 0 && (
            <button
              onClick={() => onChange([])}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground border-b border-border"
            >
              <X className="h-4 w-4" />
              Clear all
            </button>
          )}

          {/* Custom values (user-added) */}
          {customValues.length > 0 && (
            <>
              {customValues.map((value) => (
                <button
                  key={value}
                  onClick={() => toggleValue(value)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm bg-primary/10 text-primary hover:bg-primary/20"
                >
                  <div className="h-4 w-4 border rounded flex items-center justify-center bg-primary border-primary">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                  <span className="capitalize">{value}</span>
                  <X className="h-3 w-3 ml-auto opacity-60 hover:opacity-100" />
                </button>
              ))}
              <div className="border-b border-border" />
            </>
          )}

          {/* Predefined options */}
          {options.map((option) => {
            const isSelected = values.includes(option.value);
            return (
              <button
                key={option.value}
                onClick={() => toggleValue(option.value)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground",
                  isSelected && "bg-primary/10 text-primary"
                )}
              >
                <div className={cn(
                  "h-4 w-4 border rounded flex items-center justify-center",
                  isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"
                )}>
                  {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                </div>
                {option.label}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
