import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Upload, 
  Link2, 
  Camera, 
  Image as ImageIcon, 
  FileText, 
  Trash2, 
  ChevronRight,
  X,
  Youtube,
  Globe,
  Loader2,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { BottomNav } from '@/components/layout/BottomNav';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UploadedItem {
  id: string;
  type: 'file' | 'link';
  name: string;
  url?: string;
  fileType?: string;
  status: 'pending' | 'parsing' | 'parsed' | 'failed';
  createdAt: Date;
  recipeCount?: number;
}

const MyRecipes = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  const [uploads, setUploads] = useState<UploadedItem[]>([]);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Load existing uploads from database
  const loadUploads = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('uploads')
      .select(`
        id,
        file_name,
        file_type,
        source_url,
        status,
        created_at,
        upload_recipe_links(count)
      `)
      .eq('owner_user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading uploads:', error);
      return;
    }

    if (data) {
      setUploads(data.map(u => ({
        id: u.id,
        type: u.source_url ? 'link' : 'file',
        name: u.file_name || new URL(u.source_url || 'https://unknown').hostname,
        url: u.source_url || undefined,
        fileType: u.file_type || undefined,
        status: u.status as UploadedItem['status'],
        createdAt: new Date(u.created_at || Date.now()),
        recipeCount: (u.upload_recipe_links as any)?.[0]?.count || 0,
      })));
    }
  }, [user]);

  useEffect(() => {
    loadUploads();
  }, [loadUploads]);

  // Subscribe to realtime updates for uploads
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('upload-status-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'uploads',
          filter: `owner_user_id=eq.${user.id}`,
        },
        async (payload) => {
          const updatedUpload = payload.new as any;
          
          // Get recipe count if parsed
          let recipeCount = 0;
          if (updatedUpload.status === 'parsed') {
            const { data } = await supabase
              .from('upload_recipe_links')
              .select('count')
              .eq('upload_id', updatedUpload.id);
            recipeCount = (data as any)?.[0]?.count || 0;
          }

          setUploads(prev => prev.map(u => 
            u.id === updatedUpload.id 
              ? { 
                  ...u, 
                  status: updatedUpload.status as UploadedItem['status'],
                  recipeCount 
                } 
              : u
          ));

          // Show toast notification on status change
          if (updatedUpload.status === 'parsed') {
            toast.success(
              t('myRecipes.recipeReady', `"${updatedUpload.file_name || 'Recipe'}" is ready to use!`),
              { duration: 5000 }
            );
          } else if (updatedUpload.status === 'failed') {
            toast.error(
              t('myRecipes.parseFailed', `Failed to parse "${updatedUpload.file_name || 'file'}"`),
              { duration: 5000 }
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, t]);

  const triggerParsing = async (uploadId: string, content?: string, sourceUrl?: string, isImage?: boolean) => {
    try {
      // Update local state to show parsing
      setUploads(prev => prev.map(u => 
        u.id === uploadId ? { ...u, status: 'parsing' as const } : u
      ));

      const { data, error } = await supabase.functions.invoke('parse-recipe', {
        body: { 
          uploadId, 
          content: content || sourceUrl,
          sourceUrl,
          isImage: isImage || false
        },
      });

      if (error) {
        console.error('Parsing error:', error);
        setUploads(prev => prev.map(u => 
          u.id === uploadId ? { ...u, status: 'failed' as const } : u
        ));
        toast.error(t('myRecipes.parseError', 'Failed to parse recipe'));
        return;
      }

      if (data?.success) {
        setUploads(prev => prev.map(u => 
          u.id === uploadId ? { ...u, status: 'parsed' as const, recipeCount: data.count } : u
        ));
        toast.success(t('myRecipes.parseSuccess', `Found ${data.count} recipe(s)!`));
      } else {
        setUploads(prev => prev.map(u => 
          u.id === uploadId ? { ...u, status: 'failed' as const } : u
        ));
        toast.error(data?.error || t('myRecipes.parseError', 'Failed to parse recipe'));
      }
    } catch (error) {
      console.error('Parse error:', error);
      setUploads(prev => prev.map(u => 
        u.id === uploadId ? { ...u, status: 'failed' as const } : u
      ));
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    
    for (const file of Array.from(files)) {
      // Read file content
      let fileContent = '';
      const isImage = file.type.startsWith('image/');
      
      if (isImage) {
        // Convert image to base64 for AI processing
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result);
          };
          reader.readAsDataURL(file);
        });
        fileContent = base64;
      } else if (file.type.startsWith('text/') || file.type === 'application/json') {
        fileContent = await file.text();
      }
      
      // Save to database
      if (user) {
        try {
          const { data: uploadData, error } = await supabase.from('uploads').insert({
            owner_user_id: user.id,
            file_name: file.name,
            file_type: file.type,
            status: 'pending',
            scope: 'private'
          }).select().single();

          if (error) throw error;

          const newUpload: UploadedItem = {
            id: uploadData.id,
            type: 'file',
            name: file.name,
            fileType: file.type,
            status: 'pending',
            createdAt: new Date(),
          };
          
          setUploads(prev => [newUpload, ...prev]);
          toast.success(t('myRecipes.uploadSuccess', 'File added successfully'));

          // Trigger parsing immediately with actual content
          if (fileContent) {
            await triggerParsing(uploadData.id, fileContent, undefined, isImage);
          }
        } catch (error) {
          toast.error(t('myRecipes.uploadError', 'Failed to save file'));
        }
      }
    }
    
    setIsUploading(false);
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleAddLink = async () => {
    if (!linkUrl.trim()) return;
    
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(linkUrl);
    } catch {
      toast.error(t('myRecipes.invalidUrl', 'Please enter a valid URL'));
      return;
    }
    
    // Save to database
    if (user) {
      try {
        const { data: uploadData, error } = await supabase.from('uploads').insert({
          owner_user_id: user.id,
          source_url: linkUrl,
          file_name: parsedUrl.hostname,
          status: 'pending',
          scope: 'private'
        }).select().single();

        if (error) throw error;

        const newUpload: UploadedItem = {
          id: uploadData.id,
          type: 'link',
          name: parsedUrl.hostname,
          url: linkUrl,
          status: 'pending',
          createdAt: new Date(),
        };
        
        setUploads(prev => [newUpload, ...prev]);
        toast.success(t('myRecipes.linkAdded', 'Link added successfully'));

        // Trigger parsing immediately
        await triggerParsing(uploadData.id, undefined, linkUrl);
      } catch (error) {
        toast.error(t('myRecipes.linkError', 'Failed to save link'));
      }
    }
    
    setLinkUrl('');
    setShowLinkInput(false);
  };

  const handleRemoveUpload = async (id: string) => {
    try {
      await supabase.from('uploads').delete().eq('id', id);
      setUploads(prev => prev.filter(u => u.id !== id));
      toast.success(t('myRecipes.removed', 'Item removed'));
    } catch (error) {
      toast.error(t('myRecipes.removeError', 'Failed to remove item'));
    }
  };

  const handleRetryParsing = async (upload: UploadedItem) => {
    await triggerParsing(upload.id, undefined, upload.url);
  };

  const getFileIcon = (fileType?: string) => {
    if (!fileType) return <FileText className="w-5 h-5" />;
    if (fileType.startsWith('image/')) return <ImageIcon className="w-5 h-5" />;
    return <FileText className="w-5 h-5" />;
  };

  const getLinkIcon = (url?: string) => {
    if (!url) return <Globe className="w-5 h-5" />;
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return <Youtube className="w-5 h-5 text-red-500" />;
    }
    return <Globe className="w-5 h-5" />;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'parsed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-destructive" />;
      case 'parsing':
        return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  // Count items currently parsing
  const parsingCount = uploads.filter(u => u.status === 'parsing').length;
  const pendingCount = uploads.filter(u => u.status === 'pending').length;
  const totalProcessing = parsingCount + pendingCount;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="w-10 h-10 rounded-full bg-card flex items-center justify-center"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  {t('myRecipes.title', 'My Recipes')}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {t('myRecipes.subtitle', 'Upload your own recipes')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6 space-y-6">
        {/* Upload Options */}
        <div className="grid grid-cols-2 gap-3">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-border bg-card hover:border-primary hover:bg-primary/5 transition-all"
          >
            <Upload className="w-8 h-8 text-primary mb-2" />
            <span className="text-sm font-medium text-foreground">
              {t('myRecipes.uploadFiles', 'Upload Files')}
            </span>
            <span className="text-xs text-muted-foreground mt-1">
              {t('myRecipes.filesHint', 'Photos, PDFs, screenshots')}
            </span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => cameraInputRef.current?.click()}
            className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-border bg-card hover:border-primary hover:bg-primary/5 transition-all"
          >
            <Camera className="w-8 h-8 text-primary mb-2" />
            <span className="text-sm font-medium text-foreground">
              {t('myRecipes.takePhoto', 'Take Photo')}
            </span>
            <span className="text-xs text-muted-foreground mt-1">
              {t('myRecipes.cameraHint', 'Snap a recipe')}
            </span>
          </motion.button>
        </div>

        {/* Add Link Button */}
        <AnimatePresence mode="wait">
          {showLinkInput ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3"
            >
              <div className="flex gap-2">
                <Input
                  type="url"
                  placeholder="https://youtube.com/watch?v=... or recipe URL"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddLink();
                    }
                  }}
                  className="flex-1"
                  autoFocus
                />
                <Button onClick={handleAddLink} disabled={!linkUrl.trim()}>
                  <Plus className="w-4 h-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => {
                    setShowLinkInput(false);
                    setLinkUrl('');
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('myRecipes.linkHelp', 'Paste a YouTube video, recipe blog, or any URL with recipes')}
              </p>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowLinkInput(true)}
              >
                <Link2 className="w-4 h-4 mr-2" />
                {t('myRecipes.addLink', 'Add Link (YouTube, websites)')}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx,.txt"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Processing Banner */}
        {totalProcessing > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-primary/10 border border-primary/20"
          >
            <div className="flex items-center gap-3 mb-2">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
              <p className="text-sm font-medium text-foreground">
                {t('myRecipes.processing', 'Processing {{count}} item(s)...', { count: totalProcessing })}
              </p>
            </div>
            <Progress value={parsingCount > 0 ? 50 : 10} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {t('myRecipes.processingHint', "We'll notify you when your recipes are ready")}
            </p>
          </motion.div>
        )}

        {/* Uploads List */}
        {uploads.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-foreground">
              {t('myRecipes.yourUploads', 'Your Uploads')} ({uploads.length})
            </h2>
            <div className="space-y-2">
              {uploads.map((upload, index) => (
                <motion.div
                  key={upload.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border"
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
                    {upload.type === 'link' 
                      ? getLinkIcon(upload.url)
                      : getFileIcon(upload.fileType)
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {upload.name}
                    </p>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(upload.status)}
                      <p className="text-xs text-muted-foreground">
                        {upload.status === 'pending' && t('myRecipes.statusPending', 'Pending')}
                        {upload.status === 'parsing' && t('myRecipes.statusParsing', 'Processing...')}
                        {upload.status === 'parsed' && t('myRecipes.statusParsed', `${upload.recipeCount || 0} recipe(s) found`)}
                        {upload.status === 'failed' && t('myRecipes.statusFailed', 'Failed')}
                      </p>
                    </div>
                  </div>
                  {upload.status === 'failed' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRetryParsing(upload)}
                    >
                      {t('common.retry', 'Retry')}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemoveUpload(upload.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {uploads.length === 0 && (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
              <Upload className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              {t('myRecipes.emptyTitle', 'No recipes yet')}
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              {t('myRecipes.emptyDesc', 'Upload photos of recipes, screenshots, or add links to your favorite recipe sources')}
            </p>
          </div>
        )}

        {/* Continue Button */}
        <div className="pt-4">
          <Button 
            className="w-full" 
            size="lg"
            onClick={() => navigate('/discover')}
          >
            {t('myRecipes.continue', 'Continue to Discover')}
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>

      {isUploading && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {t('myRecipes.uploading', 'Uploading...')}
            </p>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
};

export default MyRecipes;
