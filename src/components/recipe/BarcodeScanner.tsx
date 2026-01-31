import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { useTranslation } from 'react-i18next';
import { X, Loader2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { useScanFeedback } from '@/hooks/useScanFeedback';

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (barcode: string, format: string) => void;
}

export function BarcodeScanner({ open, onClose, onScan }: BarcodeScannerProps) {
  const { t } = useTranslation();
  const [isInitializing, setIsInitializing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [showNoScanHint, setShowNoScanHint] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCamera, setHasCamera] = useState(true);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerIdRef = useRef<string>('barcode-scanner-' + Date.now());
  
  // Haptic and sound feedback
  const { triggerSuccessFeedback, cleanup: cleanupFeedback } = useScanFeedback();

  useEffect(() => {
    if (!open) {
      setShowNoScanHint(false);
      return;
    }
    if (!isScanning) {
      setShowNoScanHint(false);
      return;
    }

    const timeout = window.setTimeout(() => {
      setShowNoScanHint(true);
    }, 9000);

    return () => window.clearTimeout(timeout);
  }, [open, isScanning]);

  // CRITICAL: Camera must be started directly from user click to satisfy browser security
  const startScanner = useCallback(async () => {
    setIsInitializing(true);
    setError(null);
    
    const scannerId = scannerIdRef.current;

    try {
      // Create scanner container if not exists
      if (containerRef.current && !document.getElementById(scannerId)) {
        const scannerDiv = document.createElement('div');
        scannerDiv.id = scannerId;
        scannerDiv.style.width = '100%';
        scannerDiv.style.height = '100%';
        containerRef.current.appendChild(scannerDiv);
      }

      // Configure for barcode formats (UPC, EAN for food products)
      const formatsToSupport = [
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.QR_CODE,
      ];

      const scanner = new Html5Qrcode(scannerId, {
        formatsToSupport,
        useBarCodeDetectorIfSupported: true,
        verbose: false,
      });
      scannerRef.current = scanner;

      const qrbox = (viewfinderWidth: number, viewfinderHeight: number) => {
        // Large scanning area like reference - ~95% width, ~45% height
        const width = Math.floor(viewfinderWidth * 0.95);
        const height = Math.floor(viewfinderHeight * 0.45);
        return { width, height };
      };

      // CRITICAL: getUserMedia is called here, directly in the click handler chain
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 15,
          qrbox,
          aspectRatio: 1.0, // Square aspect for full-screen feel
        },
        (decodedText, decodedResult) => {
          console.log('[BarcodeScanner] Scanned:', decodedText, decodedResult.result.format);
          const format = decodedResult.result.format?.formatName || 'unknown';
          
          // Trigger haptic feedback and success sound
          triggerSuccessFeedback();
          
          onScan(decodedText, format);
          
          // Stop scanner after successful scan
          scanner.stop().catch(console.error);
          setIsScanning(false);
          onClose();
        },
        (errorMessage) => {
          if (Math.random() < 0.01) {
            console.debug('[BarcodeScanner] Scan attempt (no match):', errorMessage);
          }
        }
      );

      setIsInitializing(false);
      setIsScanning(true);
      console.log('[BarcodeScanner] Started scanning with formats:', formatsToSupport.map(f => Html5QrcodeSupportedFormats[f]));
    } catch (err) {
      console.error('Scanner init error:', err);
      
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError(t('recipes.cameraPermissionDenied', 'Camera permission denied. Please allow camera access and try again.'));
        } else if (err.message.includes('No camera')) {
          setHasCamera(false);
          setError(t('recipes.noCameraFound', 'No camera found on this device'));
        } else {
          setError(err.message);
        }
      } else {
        setError(t('recipes.scannerError', 'Failed to initialize camera'));
      }
      
      setIsInitializing(false);
    }
  }, [onClose, onScan, t, triggerSuccessFeedback]);

  const stopScanner = useCallback(() => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
    const el = document.getElementById(scannerIdRef.current);
    if (el) el.remove();
    setIsScanning(false);
    cleanupFeedback();
  }, [cleanupFeedback]);

  const handleClose = useCallback(() => {
    stopScanner();
    onClose();
  }, [stopScanner, onClose]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black flex flex-col"
      >
        {/* Full-screen camera container */}
        <div 
          ref={containerRef} 
          className="absolute inset-0 [&>div]:!w-full [&>div]:!h-full [&_video]:w-full [&_video]:h-full [&_video]:object-cover"
        />

        {/* Overlay controls */}
        <div className="relative z-10 flex flex-col h-full">
          {/* Top bar */}
          <div className="flex items-center justify-between p-4 pt-safe">
            <div className="text-white">
              <h2 className="font-semibold text-lg">{t('recipes.scanBarcode', 'Scan Barcode')}</h2>
              <p className="text-xs text-white/70">
                {t('recipes.scanBarcodeHint', 'Point camera at product barcode')}
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
            {/* Initial state - show start button */}
            {!isScanning && !isInitializing && !error && (
              <div className="flex flex-col items-center justify-center text-white gap-6 p-4">
                <div className="w-64 h-32 border-2 border-white/50 rounded-xl flex items-center justify-center">
                  <p className="text-sm text-white/70 text-center px-4">
                    {t('recipes.tapToStartCamera', 'Tap below to start scanning')}
                  </p>
                </div>
                <Button
                  onClick={startScanner}
                  className="gap-2 bg-white text-black hover:bg-white/90"
                  size="lg"
                >
                  <Play className="w-5 h-5" />
                  {t('recipes.startCamera', 'Start Camera')}
                </Button>
              </div>
            )}

            {isInitializing && (
              <div className="flex flex-col items-center justify-center text-white gap-3">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p className="text-sm">{t('recipes.initializingCamera', 'Initializing camera...')}</p>
              </div>
            )}

            {error && (
              <div className="flex flex-col items-center justify-center text-white gap-3 p-4 text-center">
                <p className="text-sm text-destructive">{error}</p>
                {!hasCamera && (
                  <p className="text-xs text-white/70">
                    {t('recipes.tryScanningImage', 'Try scanning from an image instead')}
                  </p>
                )}
                <Button
                  onClick={() => {
                    setError(null);
                    startScanner();
                  }}
                  variant="outline"
                  className="mt-2 bg-white/10 border-white/20 text-white hover:bg-white/20"
                >
                  {t('common.tryAgain', 'Try Again')}
                </Button>
              </div>
            )}

            {/* Scan frame overlay when scanning */}
            {isScanning && !error && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {/* Darkened corners */}
                <div className="absolute inset-0 bg-black/40" />
                
                {/* Scan window cutout */}
                <div className="relative w-72 h-28">
                  {/* Clear the center */}
                  <div className="absolute inset-0 bg-black/0" style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)' }} />
                  
                  {/* Corner brackets */}
                  <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg" />
                  <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg" />
                  <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg" />
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg" />
                  
                  {/* Scanning line animation */}
                  <motion.div
                    className="absolute left-2 right-2 h-0.5 bg-primary"
                    initial={{ top: '10%' }}
                    animate={{ top: '90%' }}
                    transition={{ duration: 2, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* No scan hint */}
          {isScanning && !error && showNoScanHint && (
            <div className="absolute bottom-32 left-4 right-4 text-center">
              <p className="text-sm text-white/90 bg-black/50 backdrop-blur-sm rounded-lg px-4 py-2">
                {t(
                  'recipes.noScanHint',
                  'Not scanning? Move closer, increase lighting, and keep barcode steady.'
                )}
              </p>
            </div>
          )}

          {/* Bottom info */}
          <div className="p-4 pb-safe text-center">
            <p className="text-sm text-white/70">
              {t('recipes.supportedBarcodes', 'Supports UPC, EAN, and QR codes')}
            </p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
