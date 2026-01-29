import { useState, useEffect, useRef, useMemo } from 'react';
import { X, Check, ChevronUp, ChevronDown, Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Ingredient {
  name: string;
  quantity: number | null;
  unit: string | null;
  section?: string | null;
}

interface Step {
  step_number: number;
  instruction: string;
}

interface CookingModeProps {
  title: string;
  sourceUrl: string | null;
  ingredients: Ingredient[];
  steps: Step[];
  servingMultiplier?: number;
  onClose: () => void;
}

// Helper to format quantities with fractions
function formatQuantity(quantity: number): string {
  if (quantity === 0) return '';
  
  const whole = Math.floor(quantity);
  const decimal = quantity - whole;
  
  const fractions: Record<string, string> = {
    '0.25': '¼',
    '0.33': '⅓',
    '0.5': '½',
    '0.67': '⅔',
    '0.75': '¾',
    '0.125': '⅛',
    '0.375': '⅜',
    '0.625': '⅝',
    '0.875': '⅞',
  };
  
  const decimalStr = decimal.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  const fraction = fractions[decimalStr] || (decimal > 0 ? ` ${decimal.toFixed(1)}` : '');
  
  if (whole === 0 && fraction) return fraction.trim();
  if (fraction) return `${whole}${fraction}`;
  return whole.toString();
}

// Extract video ID from YouTube URL
function getYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

// Check if URL is an Instagram video/reel
function isInstagramVideo(url: string): boolean {
  return /instagram\.com\/(reel|p)\//.test(url);
}

export function CookingMode({
  title,
  sourceUrl,
  ingredients,
  steps,
  servingMultiplier = 1,
  onClose,
}: CookingModeProps) {
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [isVideoMinimized, setIsVideoMinimized] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(true);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const videoRef = useRef<HTMLIFrameElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Group ingredients by section
  const ingredientsBySection = useMemo(() => {
    const sections: Record<string, Ingredient[]> = {};
    ingredients.forEach((ing) => {
      const section = ing.section || 'Main';
      if (!sections[section]) sections[section] = [];
      sections[section].push(ing);
    });
    return sections;
  }, [ingredients]);

  // Sort sections so 'Main' comes first
  const sectionOrder = useMemo(() => {
    const sections = Object.keys(ingredientsBySection);
    return sections.sort((a, b) => {
      if (a === 'Main') return -1;
      if (b === 'Main') return 1;
      return 0;
    });
  }, [ingredientsBySection]);

  // Get YouTube embed URL
  const youtubeVideoId = sourceUrl ? getYouTubeVideoId(sourceUrl) : null;
  const hasVideo = !!youtubeVideoId;

  // Handle scroll to minimize video
  useEffect(() => {
    const handleScroll = () => {
      if (contentRef.current) {
        const scrollTop = contentRef.current.scrollTop;
        setIsVideoMinimized(scrollTop > 150);
      }
    };

    const content = contentRef.current;
    if (content) {
      content.addEventListener('scroll', handleScroll);
      return () => content.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const toggleStep = (stepNumber: number) => {
    setCompletedSteps((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(stepNumber)) {
        newSet.delete(stepNumber);
      } else {
        newSet.add(stepNumber);
      }
      return newSet;
    });
  };

  const progress = steps.length > 0 ? (completedSteps.size / steps.length) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background"
    >
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background border-b border-border">
        <div className="flex items-center justify-between p-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate">{title}</h1>
            <p className="text-xs text-muted-foreground">Cooking Mode</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>
        
        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <motion.div
            className="h-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Floating PiP Video */}
      <AnimatePresence>
        {hasVideo && isVideoMinimized && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -20 }}
            className="fixed top-20 right-4 z-30 w-40 aspect-video rounded-lg overflow-hidden shadow-xl border-2 border-primary"
          >
            <iframe
              src={`https://www.youtube.com/embed/${youtubeVideoId}?enablejsapi=1&mute=1&autoplay=0&modestbranding=1&rel=0`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
            <button
              onClick={() => setIsVideoMinimized(false)}
              className="absolute bottom-1 right-1 p-1 bg-black/60 rounded text-white"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scrollable content */}
      <div
        ref={contentRef}
        className="h-[calc(100vh-80px)] overflow-y-auto pb-20"
      >
        {/* Hero Video (when not minimized) */}
        {hasVideo && !isVideoMinimized && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative aspect-video bg-black"
          >
            <iframe
              ref={videoRef}
              src={`https://www.youtube.com/embed/${youtubeVideoId}?enablejsapi=1&mute=1&autoplay=0&modestbranding=1&rel=0`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
            <button
              onClick={() => setIsVideoMinimized(true)}
              className="absolute bottom-3 right-3 p-2 bg-black/60 rounded-lg text-white hover:bg-black/80"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </motion.div>
        )}

        <div className="p-4 space-y-6">
          {/* All Ingredients Summary (collapsed by default in cooking mode) */}
          <details className="bg-muted/50 rounded-xl overflow-hidden">
            <summary className="p-4 font-semibold cursor-pointer hover:bg-muted/70 transition-colors">
              📝 All Ingredients ({ingredients.length})
            </summary>
            <div className="p-4 pt-0 space-y-4">
              {sectionOrder.map((section) => (
                <div key={section}>
                  {sectionOrder.length > 1 && (
                    <h4 className="text-xs font-medium text-primary uppercase tracking-wide mb-2">
                      {section}
                    </h4>
                  )}
                  <ul className="space-y-1 text-sm">
                    {ingredientsBySection[section].map((ing, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        <span>
                          {ing.quantity && `${formatQuantity(ing.quantity * servingMultiplier)} `}
                          {ing.unit && `${ing.unit} `}
                          {ing.name}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </details>

          {/* Instructions with contextual ingredients */}
          <div className="space-y-6">
            <h2 className="text-lg font-bold">Instructions</h2>
            
            {steps.map((step, idx) => {
              const isCompleted = completedSteps.has(step.step_number);
              
              // Show section ingredients before the first step that might use them
              // For simplicity, show the matching section before step 1 for "Main",
              // and other sections when they might be contextually relevant
              const showSection = idx === 0 && sectionOrder.length > 0 ? sectionOrder[0] : null;
              
              return (
                <div key={step.step_number}>
                  {/* Contextual ingredients for this section */}
                  {showSection && ingredientsBySection[showSection] && (
                    <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                      <h4 className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">
                        {showSection === 'Main' ? 'Gather These Ingredients' : `For the ${showSection}`}
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {ingredientsBySection[showSection].map((ing, i) => (
                          <span
                            key={i}
                            className="text-xs px-2 py-1 bg-background rounded-full border"
                          >
                            {ing.quantity && `${formatQuantity(ing.quantity * servingMultiplier)} `}
                            {ing.unit && `${ing.unit} `}
                            {ing.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Show other sections at relevant steps */}
                  {idx > 0 && sectionOrder[idx] && ingredientsBySection[sectionOrder[idx]] && (
                    <div className="mb-4 p-3 bg-accent/50 border border-accent rounded-lg">
                      <h4 className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">
                        For the {sectionOrder[idx]}
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {ingredientsBySection[sectionOrder[idx]].map((ing, i) => (
                          <span
                            key={i}
                            className="text-xs px-2 py-1 bg-background rounded-full border"
                          >
                            {ing.quantity && `${formatQuantity(ing.quantity * servingMultiplier)} `}
                            {ing.unit && `${ing.unit} `}
                            {ing.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Step card */}
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={cn(
                      'flex gap-4 p-4 rounded-xl transition-all cursor-pointer',
                      isCompleted
                        ? 'bg-primary/10 border-2 border-primary/30'
                        : 'bg-muted/50 border-2 border-transparent hover:border-muted'
                    )}
                    onClick={() => toggleStep(step.step_number)}
                  >
                    {/* Checkbox */}
                    <div
                      className={cn(
                        'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold transition-all',
                        isCompleted
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background border-2 border-border text-foreground'
                      )}
                    >
                      {isCompleted ? <Check className="w-5 h-5" /> : step.step_number}
                    </div>
                    
                    {/* Instruction text */}
                    <p
                      className={cn(
                        'flex-1 text-lg leading-relaxed pt-1',
                        isCompleted && 'text-muted-foreground line-through'
                      )}
                      dangerouslySetInnerHTML={{ __html: step.instruction }}
                    />
                  </motion.div>
                </div>
              );
            })}
          </div>

          {/* Completion message */}
          {completedSteps.size === steps.length && steps.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center p-6 bg-primary/10 rounded-2xl border-2 border-primary/30"
            >
              <p className="text-4xl mb-2">🎉</p>
              <h3 className="text-xl font-bold text-primary">All Done!</h3>
              <p className="text-muted-foreground">Enjoy your {title}!</p>
              <Button onClick={onClose} className="mt-4">
                Exit Cooking Mode
              </Button>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
