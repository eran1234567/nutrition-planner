import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
}

export function MultiSelectDropdown({
  label,
  values,
  options,
  onChange,
  icon,
  placeholder,
  className,
}: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  
  const toggleValue = (value: string) => {
    if (values.includes(value)) {
      onChange(values.filter(v => v !== value));
    } else {
      onChange([...values, value]);
    }
  };
  
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
      <PopoverContent className="w-[200px] p-0 bg-popover border border-border shadow-lg" align="start">
        <div className="max-h-[300px] overflow-y-auto">
          {values.length > 0 && (
            <button
              onClick={() => onChange([])}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground border-b border-border"
            >
              <X className="h-4 w-4" />
              Clear all
            </button>
          )}
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
