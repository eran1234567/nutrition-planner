import { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: ReactNode;
  className?: string;
}

export function PageHeader({ 
  title, 
  subtitle, 
  showBack = false, 
  onBack,
  rightAction,
  className 
}: PageHeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <header className={cn('flex items-center justify-between gap-3 mb-4', className)}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {showBack && (
          <button
            onClick={handleBack}
            className="tap-target -ml-2 rounded-full hover:bg-muted transition-colors"
            aria-label="Go back"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-foreground truncate">{title}</h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>
      </div>
      {rightAction && (
        <div className="flex-shrink-0">{rightAction}</div>
      )}
    </header>
  );
}
