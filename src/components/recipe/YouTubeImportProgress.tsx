import { motion, AnimatePresence } from 'framer-motion';
import { Youtube, X, Check, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface YouTubeImportProgressProps {
  channelName: string | null;
  totalVideos: number;
  processedVideos: number;
  recipesCreated: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  onCancel?: () => void;
  onDismiss?: () => void;
}

export function YouTubeImportProgress({
  channelName,
  totalVideos,
  processedVideos,
  recipesCreated,
  status,
  progress,
  onCancel,
  onDismiss,
}: YouTubeImportProgressProps) {
  const isComplete = status === 'completed';
  const isFailed = status === 'failed';
  const isProcessing = status === 'processing';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.9 }}
        className={cn(
          'fixed bottom-20 left-4 right-4 md:left-auto md:right-6 md:w-96 z-50',
          'bg-card border border-border rounded-xl shadow-xl overflow-hidden'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center',
              isComplete ? 'bg-green-500/20' : isFailed ? 'bg-destructive/20' : 'bg-red-500/20'
            )}>
              {isComplete ? (
                <Check className="w-5 h-5 text-green-500" />
              ) : isFailed ? (
                <X className="w-5 h-5 text-destructive" />
              ) : (
                <Youtube className="w-5 h-5 text-red-500" />
              )}
            </div>
            <div>
              <p className="font-semibold text-sm">
                {isComplete ? 'Import Complete' : isFailed ? 'Import Failed' : 'Importing Recipes'}
              </p>
              <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                {channelName || 'YouTube Channel'}
              </p>
            </div>
          </div>
          {(isComplete || isFailed) && onDismiss && (
            <Button variant="ghost" size="icon" onClick={onDismiss}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Progress Section */}
        <div className="p-4 space-y-3">
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {isComplete ? 'Completed' : `Processing video ${processedVideos} of ${totalVideos}`}
              </span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress 
              value={progress} 
              className={cn(
                'h-2',
                isComplete && '[&>div]:bg-green-500',
                isFailed && '[&>div]:bg-destructive'
              )} 
            />
          </div>

          {/* Stats */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-2xl font-bold text-primary">{recipesCreated}</p>
                <p className="text-xs text-muted-foreground">Recipes created</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-muted-foreground">{processedVideos}</p>
                <p className="text-xs text-muted-foreground">Videos processed</p>
              </div>
            </div>
            {isProcessing && (
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            )}
          </div>

          {/* Cancel button for in-progress */}
          {isProcessing && onCancel && (
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full mt-2"
              onClick={onCancel}
            >
              Cancel Import
            </Button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
