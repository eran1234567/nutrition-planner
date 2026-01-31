import { useCallback, useRef, useState, useEffect } from 'react';

type BarcodeFormat = 'ean_13' | 'upc_a' | 'upc_e' | 'ean_8' | 'code_128';

interface ScanResult {
  barcode: string;
  format: string;
}

interface HybridBarcodeScannerOptions {
  onScan: (result: ScanResult) => void;
  onError?: (error: Error) => void;
}

// Check if native BarcodeDetector is available (Chrome/Android)
const hasNativeBarcodeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;

// Detect if iOS
const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

// Sampling rates based on platform - iOS gets slower rate to prevent overheating
const SCAN_INTERVAL_MS = isIOS ? 200 : 30; // 5 fps for iOS, ~33 fps for Android

export function useHybridBarcodeScanner({ onScan, onError }: HybridBarcodeScannerOptions) {
  const [isScanning, setIsScanning] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [engineType, setEngineType] = useState<'native' | 'zxing' | null>(null);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const nativeDetectorRef = useRef<any>(null);
  const zxingReaderRef = useRef<any>(null);
  const hasScannedRef = useRef(false);

  // Initialize the appropriate scanner engine
  const initializeEngine = useCallback(async () => {
    if (hasNativeBarcodeDetector) {
      try {
        // @ts-ignore - BarcodeDetector is not in TypeScript types
        const formats = await window.BarcodeDetector.getSupportedFormats();
        const targetFormats: BarcodeFormat[] = ['ean_13', 'upc_a', 'upc_e', 'ean_8'];
        const supportedFormats = targetFormats.filter(f => formats.includes(f));
        
        if (supportedFormats.length > 0) {
          // @ts-ignore
          nativeDetectorRef.current = new window.BarcodeDetector({
            formats: supportedFormats
          });
          setEngineType('native');
          console.log('[HybridScanner] Using native BarcodeDetector with formats:', supportedFormats);
          return 'native';
        }
      } catch (err) {
        console.log('[HybridScanner] Native BarcodeDetector failed, falling back to ZXing');
      }
    }

    // Fallback to ZXing WASM for iOS/Safari
    try {
      const zxingWasm = await import('zxing-wasm');
      // Get the readBarcodesFromImageData function
      const { readBarcodesFromImageData, setZXingModuleOverrides } = zxingWasm;
      
      // Store the read function for later use
      zxingReaderRef.current = readBarcodesFromImageData;
      
      setEngineType('zxing');
      console.log('[HybridScanner] Using ZXing WASM decoder');
      return 'zxing';
    } catch (err) {
      console.error('[HybridScanner] Failed to initialize ZXing:', err);
      throw new Error('Failed to initialize barcode scanner');
    }
  }, []);

  // Crop center 50% of the video frame for optimized scanning
  const cropCenterFrame = useCallback((video: HTMLVideoElement, canvas: HTMLCanvasElement): ImageData | null => {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx || video.videoWidth === 0) return null;

    // Calculate center 50% region for optimized scanning
    const cropWidth = Math.floor(video.videoWidth * 0.6);
    const cropHeight = Math.floor(video.videoHeight * 0.4);
    const cropX = Math.floor((video.videoWidth - cropWidth) / 2);
    const cropY = Math.floor((video.videoHeight - cropHeight) / 2);

    // Set canvas to cropped size
    canvas.width = cropWidth;
    canvas.height = cropHeight;

    // Draw only the center portion
    ctx.drawImage(
      video,
      cropX, cropY, cropWidth, cropHeight, // Source
      0, 0, cropWidth, cropHeight // Destination
    );

    return ctx.getImageData(0, 0, cropWidth, cropHeight);
  }, []);

  // Scan a single frame using native detector
  const scanWithNative = useCallback(async (video: HTMLVideoElement): Promise<ScanResult | null> => {
    if (!nativeDetectorRef.current) return null;
    
    try {
      const barcodes = await nativeDetectorRef.current.detect(video);
      if (barcodes.length > 0) {
        return {
          barcode: barcodes[0].rawValue,
          format: barcodes[0].format
        };
      }
    } catch (err) {
      // Silent fail for individual scan attempts
    }
    return null;
  }, []);

  // Scan a single frame using ZXing WASM
  const scanWithZXing = useCallback(async (imageData: ImageData): Promise<ScanResult | null> => {
    if (!zxingReaderRef.current) return null;
    
    try {
      const results = await zxingReaderRef.current(imageData, {
        // Only enable 1D product barcode formats - disable QR, PDF417, Aztec
        formats: ['EAN-13', 'EAN-8', 'UPC-A', 'UPC-E', 'Code128'],
        tryHarder: true,
        maxNumberOfSymbols: 1,
      });
      
      if (results && results.length > 0) {
        return {
          barcode: results[0].text,
          format: results[0].format || 'unknown'
        };
      }
    } catch (err) {
      // Silent fail for individual scan attempts (no barcode found is normal)
    }
    return null;
  }, []);

  // Trigger haptic feedback - 200ms vibration on successful scan
  const triggerHaptic = useCallback(() => {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(200);
      } catch (err) {
        console.debug('[HybridScanner] Vibration not available');
      }
    }
  }, []);

  // Main scanning loop
  const startScanLoop = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    hasScannedRef.current = false;

    const scan = async () => {
      if (hasScannedRef.current || !video || video.paused || video.ended) return;
      
      let result: ScanResult | null = null;

      if (engineType === 'native') {
        result = await scanWithNative(video);
      } else if (engineType === 'zxing') {
        // Crop center region for ZXing to reduce CPU load (~70% reduction)
        const imageData = cropCenterFrame(video, canvas);
        if (imageData) {
          result = await scanWithZXing(imageData);
        }
      }

      if (result && !hasScannedRef.current) {
        hasScannedRef.current = true;
        
        // Trigger haptic feedback immediately (200ms)
        triggerHaptic();
        
        // Pause video to freeze frame - gives visual confirmation
        video.pause();
        
        // Stop scanning loop
        if (scanIntervalRef.current) {
          clearInterval(scanIntervalRef.current);
          scanIntervalRef.current = null;
        }
        
        console.log('[HybridScanner] Barcode detected:', result.barcode, result.format);
        onScan(result);
      }
    };

    // Start scanning loop at platform-appropriate interval
    scanIntervalRef.current = window.setInterval(scan, SCAN_INTERVAL_MS);
    
    // Run first scan immediately
    scan();
  }, [engineType, scanWithNative, scanWithZXing, cropCenterFrame, triggerHaptic, onScan]);

  // Start the camera and scanner
  const start = useCallback(async (videoElement: HTMLVideoElement, canvasElement: HTMLCanvasElement) => {
    setIsInitializing(true);
    setError(null);
    videoRef.current = videoElement;
    canvasRef.current = canvasElement;

    try {
      // Initialize scanner engine first
      await initializeEngine();

      // Start camera with optimal settings
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      streamRef.current = stream;
      videoElement.srcObject = stream;
      
      await new Promise<void>((resolve, reject) => {
        videoElement.onloadedmetadata = () => {
          videoElement.play()
            .then(() => resolve())
            .catch(reject);
        };
        videoElement.onerror = () => reject(new Error('Video failed to load'));
      });

      setIsScanning(true);
      setIsInitializing(false);
      
      // Start the scanning loop
      startScanLoop();
      
      console.log('[HybridScanner] Camera started, engine:', engineType, 'interval:', SCAN_INTERVAL_MS, 'ms');
    } catch (err) {
      console.error('[HybridScanner] Start error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to start scanner';
      
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setError('Camera permission denied. Please allow camera access.');
      } else if (err instanceof Error && err.message.includes('No camera')) {
        setError('No camera found on this device');
      } else {
        setError(errorMessage);
      }
      
      setIsInitializing(false);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
    }
  }, [initializeEngine, startScanLoop, engineType, onError]);

  // Stop the scanner
  const stop = useCallback(() => {
    // Stop scanning loop
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    // Stop camera stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Clean up video
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsScanning(false);
    setEngineType(null);
    hasScannedRef.current = false;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    start,
    stop,
    isScanning,
    isInitializing,
    error,
    engineType,
    setError,
  };
}
