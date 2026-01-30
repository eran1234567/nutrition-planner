/**
 * CelebrationState - Success animation when Keto Score reaches 100
 * Features confetti explosion and Neutron Verified badge
 */

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Check, Shield } from 'lucide-react';
import confetti from 'canvas-confetti';

interface CelebrationStateProps {
  score: number;
  onCelebrationComplete?: () => void;
  show: boolean;
}

export function CelebrationState({ score, onCelebrationComplete, show }: CelebrationStateProps) {
  const [hasTriggeredConfetti, setHasTriggeredConfetti] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (show && score >= 100 && !hasTriggeredConfetti) {
      setHasTriggeredConfetti(true);
      
      // Trigger confetti explosion
      const rect = containerRef.current?.getBoundingClientRect();
      const originX = rect ? (rect.left + rect.width / 2) / window.innerWidth : 0.5;
      const originY = rect ? (rect.top + rect.height / 2) / window.innerHeight : 0.3;

      // First burst - emerald and gold colors
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { x: originX, y: originY },
        colors: ['#10b981', '#34d399', '#6ee7b7', '#fbbf24', '#fcd34d'],
        startVelocity: 30,
        gravity: 0.8,
        scalar: 1.2,
        ticks: 100,
      });

      // Second burst with slight delay
      setTimeout(() => {
        confetti({
          particleCount: 40,
          spread: 100,
          origin: { x: originX, y: originY },
          colors: ['#10b981', '#059669', '#047857'],
          startVelocity: 20,
          gravity: 0.6,
          scalar: 0.8,
          ticks: 80,
        });
      }, 150);

      // Callback after animation
      setTimeout(() => {
        onCelebrationComplete?.();
      }, 2000);
    }
  }, [show, score, hasTriggeredConfetti, onCelebrationComplete]);

  // Reset confetti flag when score drops below 100
  useEffect(() => {
    if (score < 100) {
      setHasTriggeredConfetti(false);
    }
  }, [score]);

  if (!show || score < 100) {
    return null;
  }

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="relative overflow-hidden rounded-xl"
    >
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 via-emerald-400/10 to-teal-500/20" />
      
      {/* Shimmer Effect */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
        animate={{
          x: ['-100%', '100%'],
        }}
        transition={{
          duration: 2,
          ease: 'linear',
          repeat: Infinity,
          repeatDelay: 3,
        }}
      />

      {/* Content */}
      <div className="relative p-5 flex items-center gap-4">
        {/* Badge Icon */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
          className="relative"
        >
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <Shield className="w-7 h-7 text-white" />
          </div>
          
          {/* Check mark overlay */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5, type: 'spring' }}
            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-md"
          >
            <Check className="w-4 h-4 text-emerald-500" />
          </motion.div>
        </motion.div>

        {/* Text Content */}
        <div className="flex-1">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-2"
          >
            <h4 className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
              Neutron Verified
            </h4>
            <motion.div
              animate={{
                rotate: [0, 15, -15, 0],
              }}
              transition={{
                duration: 0.5,
                delay: 0.8,
              }}
            >
              <Sparkles className="w-5 h-5 text-amber-500" />
            </motion.div>
          </motion.div>
          
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-sm text-emerald-600/80 dark:text-emerald-400/80"
          >
            Perfect 100 Score achieved! Recipe optimized for ketosis.
          </motion.p>
        </div>

        {/* Score Badge */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.4 }}
          className="relative"
        >
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/40">
            <span className="text-xl font-black text-white">100</span>
          </div>
          
          {/* Pulse ring */}
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-emerald-400"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.5, 0, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeOut',
            }}
          />
        </motion.div>
      </div>
    </motion.div>
  );
}
