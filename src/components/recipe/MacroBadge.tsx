import { cn } from '@/lib/utils';
import { Flame } from 'lucide-react';

interface MacroBadgeProps {
  type: 'calories' | 'protein' | 'carbs' | 'fat' | 'fiber';
  value: number;
  unit?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

const macroConfig = {
  calories: {
    label: 'Cal',
    icon: Flame,
    className: 'macro-calories',
  },
  protein: {
    label: 'P',
    icon: null,
    className: 'macro-protein',
  },
  carbs: {
    label: 'C',
    icon: null,
    className: 'macro-carbs',
  },
  fat: {
    label: 'F',
    icon: null,
    className: 'macro-fat',
  },
  fiber: {
    label: 'Fiber',
    icon: null,
    className: 'bg-fiber/10 text-fiber',
  },
};

export function MacroBadge({ 
  type, 
  value, 
  unit = 'g', 
  size = 'md',
  showIcon = true 
}: MacroBadgeProps) {
  const config = macroConfig[type];
  const Icon = config.icon;

  return (
    <div className={cn(
      'macro-badge',
      config.className,
      size === 'sm' && 'text-2xs px-1.5 py-0.5',
      size === 'lg' && 'text-sm px-3 py-1.5'
    )}>
      {showIcon && Icon && <Icon className={cn('w-3 h-3', size === 'lg' && 'w-4 h-4')} />}
      <span className="font-medium">{config.label}</span>
      <span>{Math.round(value)}{type !== 'calories' ? unit : ''}</span>
    </div>
  );
}
