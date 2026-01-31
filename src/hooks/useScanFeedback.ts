import { useCallback, useRef } from 'react';

interface ScanFeedbackOptions {
  vibrationPattern?: number | number[];
  soundEnabled?: boolean;
}

/**
 * Hook for providing haptic and audio feedback on successful barcode scans
 */
export function useScanFeedback(options: ScanFeedbackOptions = {}) {
  const { vibrationPattern = [50, 30, 50], soundEnabled = true } = options;
  const audioContextRef = useRef<AudioContext | null>(null);

  /**
   * Play a pleasant success tone using Web Audio API
   */
  const playSuccessSound = useCallback(() => {
    if (!soundEnabled) return;

    try {
      // Create or reuse AudioContext
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = audioContextRef.current;
      
      // Resume context if suspended (required for mobile browsers)
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;
      
      // Create a pleasant two-tone success sound
      const frequencies = [880, 1318.5]; // A5 and E6 - a nice major chord interval
      
      frequencies.forEach((freq, index) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(freq, now);
        
        // Quick fade in and out for a soft "ding" sound
        const startTime = now + (index * 0.08);
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.15, startTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + 0.3);
      });
    } catch (error) {
      console.debug('[useScanFeedback] Audio not available:', error);
    }
  }, [soundEnabled]);

  /**
   * Trigger haptic feedback (vibration)
   */
  const triggerHaptic = useCallback(() => {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(vibrationPattern);
      } catch (error) {
        console.debug('[useScanFeedback] Vibration not available:', error);
      }
    }
  }, [vibrationPattern]);

  /**
   * Trigger both haptic and sound feedback
   */
  const triggerSuccessFeedback = useCallback(() => {
    triggerHaptic();
    playSuccessSound();
  }, [triggerHaptic, playSuccessSound]);

  /**
   * Cleanup audio context when done
   */
  const cleanup = useCallback(() => {
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }, []);

  return {
    triggerSuccessFeedback,
    triggerHaptic,
    playSuccessSound,
    cleanup,
  };
}
