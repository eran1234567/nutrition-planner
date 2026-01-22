import { cn } from '@/lib/utils';
import { ChevronDown, Check } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface FilterDropdownProps {
  label: string;
  value: string | null;
  options: { value: string; label: string }[];
  onChange: (value: string | null) => void;
  icon?: React.ReactNode;
  placeholder?: string;
  className?: string;
}

export function FilterDropdown({
  label,
  value,
  options,
  onChange,
  icon,
  placeholder,
  className,
}: FilterDropdownProps) {
  const selectedOption = options.find(opt => opt.value === value);
  
  return (
    <Select
      value={value || ''}
      onValueChange={(val) => onChange(val === '__clear__' ? null : val)}
    >
      <SelectTrigger 
        className={cn(
          "h-9 min-w-[100px] bg-background border-border text-sm",
          value && "border-primary bg-primary/5",
          className
        )}
      >
        <div className="flex items-center gap-1.5 truncate">
          {icon && <span className="flex-shrink-0 opacity-60">{icon}</span>}
          <SelectValue placeholder={placeholder || label}>
            {selectedOption?.label || placeholder || label}
          </SelectValue>
        </div>
      </SelectTrigger>
      <SelectContent className="bg-popover border border-border shadow-lg">
        <SelectItem value="__clear__" className="text-muted-foreground">
          {placeholder || label} (All)
        </SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
