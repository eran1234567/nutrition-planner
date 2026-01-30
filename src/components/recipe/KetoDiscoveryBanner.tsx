/**
 * KetoDiscoveryBanner - Actionable context switcher for enabling Keto Mode
 * 
 * Shows when a recipe has a high keto score (>70) but Keto Mode is not active.
 * Provides a one-click action to enable Keto Mode globally.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Sparkles, Check, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNeutronStore } from '@/stores/neutronStore';
import { toast } from 'sonner';

interface KetoDiscoveryBannerProps {
  ketoScore: number;
}

export function KetoDiscoveryBanner({ ketoScore }: KetoDiscoveryBannerProps) {
  const [isActivating, setIsActivating] = useState(false);
  const [isActivated, setIsActivated] = useState(false);
  const enableKetoMode = useNeutronStore((s) => s.enableKetoMode);

  const handleEnableKetoMode = async () => {
    setIsActivating(true);
    
    // Small delay for visual feedback
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Enable keto mode globally
    enableKetoMode();
    
    setIsActivating(false);
    setIsActivated(true);
    
    // Show success toast with animation
    toast.success('Keto Mode Active', {
      description: 'All carb labels now show Net Carbs. Keto optimization is enabled.',
      icon: <Sparkles className="w-4 h-4 text-emerald-500" />,
      duration: 4000,
    });
  };

  // Show success state briefly before component unmounts (due to isKetoMode becoming true)
  if (isActivated) {
    return (
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: 0, scale: 0.95 }}
        transition={{ delay: 0.5, duration: 0.3 }}
        className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-700 rounded-xl p-4 mb-6"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
            <Check className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
              Keto Mode Activated!
            </p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              Net Carbs are now displayed. Optimizer is ready.
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden bg-gradient-to-br from-indigo-50 via-violet-50 to-purple-50 dark:from-indigo-950/40 dark:via-violet-950/30 dark:to-purple-950/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 mb-6"
    >
      {/* Decorative gradient glow */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br from-indigo-400/20 to-purple-400/20 rounded-full blur-2xl" />
      
      <div className="relative flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Icon and Text */}
        <div className="flex items-start gap-3 flex-1">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/25">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">
              Keto Score: {ketoScore} — Almost There!
            </p>
            <p className="text-sm text-indigo-700 dark:text-indigo-300 mt-0.5">
              Optimize this meal and see <span className="font-semibold">Net Carbs</span> by enabling Keto Mode.
            </p>
          </div>
        </div>
        
        {/* Action Button */}
        <Button
          onClick={handleEnableKetoMode}
          disabled={isActivating}
          className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold shadow-lg shadow-indigo-500/25 transition-all hover:shadow-xl hover:shadow-indigo-500/30 disabled:opacity-70"
          size="sm"
        >
          {isActivating ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
              >
                <Sparkles className="w-4 h-4 mr-2" />
              </motion.div>
              Activating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Enable Keto Mode
              <ArrowRight className="w-3 h-3 ml-1" />
            </>
          )}
        </Button>
      </div>
      
      {/* Subtle shimmer effect */}
      <AnimatePresence>
        {!isActivating && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
            initial={{ x: '-100%' }}
            animate={{ x: '200%' }}
            transition={{ 
              duration: 2,
              repeat: Infinity,
              repeatDelay: 3,
              ease: 'linear'
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
