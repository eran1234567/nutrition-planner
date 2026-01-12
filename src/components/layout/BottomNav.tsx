import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Search, Calendar, BookOpen, ShoppingCart, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const navItems = [
  { path: '/discover', icon: Search, labelKey: 'nav.discover' },
  { path: '/plan', icon: Calendar, labelKey: 'nav.plan' },
  { path: '/recipes', icon: BookOpen, labelKey: 'nav.recipes' },
  { path: '/grocery', icon: ShoppingCart, labelKey: 'nav.grocery' },
  { path: '/settings', icon: User, labelKey: 'nav.settings' },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <nav className="bottom-nav">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'tap-target flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-colors relative',
                isActive 
                  ? 'text-primary' 
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute inset-0 bg-primary-soft rounded-xl"
                  initial={false}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
              <Icon className="h-5 w-5 relative z-10" strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-2xs font-medium relative z-10">
                {t(item.labelKey)}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
