import { useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { useHybridBarcodeScanner } from '@/hooks/useHybridBarcodeScanner';

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (barcode: string, format: string) => void;
}

export function BarcodeScanner({ open, onClose, onScan }: BarcodeScannerProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleScan = useCallback((result: { barcode: string; format: string }) => {
    console.log('[BarcodeScanner] Scanned:', result.barcode, result.format);
    onScan(result.barcode, result.format);
    onClose();
  }, [onScan, onClose]);

  const {
    start,
    stop,
    isScanning,
    isInitializing,
    error,
    engineType,
    setError,
  } = useHybridBarcodeScanner({
    onScan: handleScan,
  });

  // Auto-start scanner when modal opens
  useEffect(() => {
    if (open && videoRef.current && canvasRef.current) {
      start(videoRef.current, canvasRef.current);
    }
    
    return () => {
      if (!open) {
        stop();
      }
    };
  }, [open, start, stop]);

  // Stop when closing
  const handleClose = useCallback(() => {
    stop();
    onClose();
  }, [stop, onClose]);

  const handleRetry = useCallback(() => {
    setError(null);
    if (videoRef.current && canvasRef.current) {
      start(videoRef.current, canvasRef.current);
    }
  }, [setError, start]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black flex flex-col"
      >
        {/* Full-screen video container */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
          autoPlay
        />
        
        {/* Hidden canvas for frame processing */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Overlay controls */}
        <div className="relative z-10 flex flex-col h-full">
          {/* Top bar */}
          <div className="flex items-center justify-between p-4 pt-safe bg-gradient-to-b from-black/60 to-transparent">
            <div className="text-white">
              <h2 className="font-semibold text-lg">{t('recipes.scanBarcode', 'Scan Barcode')}</h2>
              <p className="text-xs text-white/70">
                {engineType === 'native' 
                  ? t('recipes.nativeScanner', 'Using native scanner')
                  : engineType === 'zxing'
                  ? t('recipes.wasmScanner', 'Using WASM scanner')
                  : t('recipes.initializingScanner', 'Initializing...')}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Center content */}
          <div className="flex-1 flex items-center justify-center">
            {/* Show loading state while initializing */}
            {isInitializing && (
              <div className="flex flex-col items-center justify-center text-white gap-3">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p className="text-sm">{t('recipes.initializingCamera', 'Initializing camera...')}</p>
              </div>
            )}

            {error && (
              <div className="flex flex-col items-center justify-center text-white gap-3 p-4 text-center">
                <p className="text-sm text-destructive">{error}</p>
                <Button
                  onClick={handleRetry}
                  variant="outline"
                  className="mt-2 bg-white/10 border-white/20 text-white hover:bg-white/20"
                >
                  {t('common.tryAgain', 'Try Again')}
                </Button>
              </div>
            )}

            {/* Static Green Scan Box - Amazon-like focus area */}
            {isScanning && !error && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {/* Darkened area outside the scan zone */}
                <div className="absolute inset-0">
                  {/* Top dark area */}
                  <div className="absolute top-0 left-0 right-0 h-[30%] bg-black/50" />
                  {/* Bottom dark area */}
                  <div className="absolute bottom-0 left-0 right-0 h-[30%] bg-black/50" />
                  {/* Left dark area */}
                  <div className="absolute top-[30%] left-0 w-[10%] h-[40%] bg-black/50" />
                  {/* Right dark area */}
                  <div className="absolute top-[30%] right-0 w-[10%] h-[40%] bg-black/50" />
                </div>
                
                {/* Green scan zone box - using inline styles for scanner-specific colors */}
                <div className="relative w-[80%] h-[20%] max-w-md">
                  {/* Main border with glow effect */}
                  <div 
                    className="absolute inset-0 rounded-lg" 
                    style={{ 
                      border: '4px solid #22c55e',
                      boxShadow: '0 0 20px rgba(34, 197, 94, 0.5)'
                    }} 
                  />
                  
                  {/* Corner accents for visual pop */}
                  <div className="absolute -top-1 -left-1 w-8 h-8 rounded-tl-lg" style={{ borderTop: '4px solid #4ade80', borderLeft: '4px solid #4ade80' }} />
                  <div className="absolute -top-1 -right-1 w-8 h-8 rounded-tr-lg" style={{ borderTop: '4px solid #4ade80', borderRight: '4px solid #4ade80' }} />
                  <div className="absolute -bottom-1 -left-1 w-8 h-8 rounded-bl-lg" style={{ borderBottom: '4px solid #4ade80', borderLeft: '4px solid #4ade80' }} />
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-br-lg" style={{ borderBottom: '4px solid #4ade80', borderRight: '4px solid #4ade80' }} />
                  
                  {/* Scanning line animation */}
                  <motion.div
                    className="absolute left-2 right-2 h-1 rounded-full"
                    style={{ background: 'linear-gradient(to right, transparent, #4ade80, transparent)' }}
                    initial={{ top: '10%' }}
                    animate={{ top: '90%' }}
                    transition={{ 
                      duration: 1.5, 
                      repeat: Infinity, 
                      repeatType: 'reverse', 
                      ease: 'easeInOut' 
                    }}
                  />
                </div>
                
                {/* Instruction text below scan zone */}
                <div className="absolute bottom-[25%] left-0 right-0 text-center">
                  <p className="text-sm font-medium mx-auto px-4 py-2 rounded-full inline-block" style={{ color: 'rgba(255,255,255,0.9)', background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)' }}>
                    {t('recipes.alignBarcode', 'Align barcode within the green box')}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Bottom info */}
          <div className="p-4 pb-safe text-center bg-gradient-to-t from-black/60 to-transparent">
            <p className="text-sm text-white/70">
              {t('recipes.supportedBarcodes', 'Supports UPC, EAN, and Code128')}
            </p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
