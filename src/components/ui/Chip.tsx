import { cn } from '@/lib/utils';
import { Check, X } from 'lucide-react';
import { ReactNode } from 'react';

interface ChipProps {
  children: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  variant?: 'default' | 'outline' | 'filled';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  disabled?: boolean;
}

export function Chip({
  children,
  selected = false,
  onClick,
  onRemove,
  variant = 'default',
  size = 'md',
  icon,
  disabled = false,
}: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'chip inline-flex items-center gap-1.5 transition-all',
        selected && 'chip-selected',
        variant === 'outline' && 'bg-transparent border border-border',
        variant === 'outline' && selected && 'border-primary bg-primary text-primary-foreground',
        size === 'sm' && 'text-xs px-2 py-1',
        size === 'lg' && 'text-base px-4 py-2',
        disabled && 'opacity-50 cursor-not-allowed',
        onClick && !disabled && 'cursor-pointer hover:bg-muted active:scale-95'
      )}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {selected && !icon && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
      <span>{children}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="flex-shrink-0 ml-0.5 hover:text-destructive"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </button>
  );
}
