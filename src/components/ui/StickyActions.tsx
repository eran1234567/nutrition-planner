import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface StickyActionsProps {
  children: ReactNode;
  className?: string;
  show?: boolean;
}

export function StickyActions({ children, className, show = true }: StickyActionsProps) {
  if (!show) return null;

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className={cn('sticky-actions', className)}
    >
      {children}
    </motion.div>
  );
}
