import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { useTranslation } from 'react-i18next';
import { X, Loader2, Camera, ScanBarcode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (barcode: string, format: string) => void;
}

export function BarcodeScanner({ open, onClose, onScan }: BarcodeScannerProps) {
  const { t } = useTranslation();
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCamera, setHasCamera] = useState(true);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const scannerId = 'barcode-scanner-' + Date.now();
    
    // Create scanner element
    const initScanner = async () => {
      setIsInitializing(true);
      setError(null);

      try {
        // Check for camera permissions
        const devices = await Html5Qrcode.getCameras();
        if (!devices || devices.length === 0) {
          setHasCamera(false);
          setError(t('recipes.noCameraFound', 'No camera found on this device'));
          setIsInitializing(false);
          return;
        }

        // Create scanner container if not exists
        if (containerRef.current && !document.getElementById(scannerId)) {
          const scannerDiv = document.createElement('div');
          scannerDiv.id = scannerId;
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
          verbose: false 
        });
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 280, height: 150 },
            aspectRatio: 1.777,
          },
          (decodedText, decodedResult) => {
            // Barcode scanned successfully
            const format = decodedResult.result.format?.formatName || 'unknown';
            onScan(decodedText, format);
            
            // Stop scanner after successful scan
            scanner.stop().catch(console.error);
            onClose();
          },
          () => {
            // QR code scanning failure - ignore (keep scanning)
          }
        );

        setIsInitializing(false);
      } catch (err) {
        console.error('Scanner init error:', err);
        setError(
          err instanceof Error 
            ? err.message 
            : t('recipes.scannerError', 'Failed to initialize camera')
        );
        setIsInitializing(false);
      }
    };

    initScanner();

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
      // Clean up scanner element
      const el = document.getElementById(scannerId);
      if (el) el.remove();
    };
  }, [open, onClose, onScan, t]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/90 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 text-white">
          <div className="flex items-center gap-3">
            <ScanBarcode className="w-6 h-6" />
            <div>
              <h2 className="font-semibold">{t('recipes.scanBarcode', 'Scan Barcode')}</h2>
              <p className="text-xs text-white/70">
                {t('recipes.scanBarcodeHint', 'Point camera at product barcode')}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Scanner area */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="relative w-full max-w-md aspect-video rounded-xl overflow-hidden bg-black">
            {isInitializing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p className="text-sm">{t('recipes.initializingCamera', 'Initializing camera...')}</p>
              </div>
            )}

            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3 p-4 text-center">
                <Camera className="w-12 h-12 text-white/50" />
                <p className="text-sm text-red-400">{error}</p>
                {!hasCamera && (
                  <p className="text-xs text-white/70">
                    {t('recipes.tryScanningImage', 'Try scanning from an image instead')}
                  </p>
                )}
              </div>
            )}

            {/* Scanner will be mounted here */}
            <div 
              ref={containerRef} 
              className="w-full h-full [&>div]:!border-0 [&_video]:object-cover [&_video]:rounded-xl"
            />
          </div>
        </div>

        {/* Scan overlay guide */}
        {!isInitializing && !error && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-72 h-36 border-2 border-white/50 rounded-lg">
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-lg" />
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-lg" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-lg" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-lg" />
            </div>
          </div>
        )}

        {/* Bottom info */}
        <div className="p-4 text-center text-white/70">
          <p className="text-sm">
            {t('recipes.supportedBarcodes', 'Supports UPC, EAN, and QR codes')}
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
