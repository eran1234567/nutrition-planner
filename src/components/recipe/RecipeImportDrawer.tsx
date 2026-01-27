import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Upload, Link, Camera, PenLine, Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { useRecipeImport } from '@/hooks/useRecipeImport';

interface RecipeImportDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
  /** Show "Create manually" option - defaults to true */
  showManualOption?: boolean;
}

export function RecipeImportDrawer({ 
  open, 
  onOpenChange, 
  onImportComplete,
  showManualOption = true 
}: RecipeImportDrawerProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  const { 
    importFromUrl, 
    importFromFile, 
    importProgress,
    isYouTubeChannelOrPlaylist 
  } = useRecipeImport();

  const addOptions = [
    { icon: Upload, label: t('recipes.uploadFile', 'Upload file'), desc: t('recipes.uploadFileDesc', 'PDF, image, or doc'), action: 'upload' },
    { icon: Link, label: t('recipes.pasteLink', 'Paste link'), desc: t('recipes.pasteLinkDesc', 'From any website'), action: 'link' },
    { icon: Camera, label: t('recipes.takePhoto', 'Take photo'), desc: t('recipes.takePhotoDesc', 'Snap a recipe'), action: 'camera' },
    ...(showManualOption ? [{ icon: PenLine, label: t('recipes.createManually', 'Create manually'), desc: t('recipes.createManuallyDesc', 'Write your own'), action: 'manual' }] : []),
  ];

  const handleClose = () => {
    onOpenChange(false);
    setShowLinkInput(false);
    setLinkUrl('');
  };

  const handleAddOption = (action: string) => {
    switch (action) {
      case 'upload':
        fileInputRef.current?.click();
        break;
      case 'link':
        setShowLinkInput(true);
        break;
      case 'camera':
        cameraInputRef.current?.click();
        break;
      case 'manual':
        navigate('/recipe/new');
        handleClose();
        break;
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      const result = await importFromFile(file);
      if (result.success) {
        onImportComplete?.();
        handleClose();
      }
    }
    
    if (event.target) event.target.value = '';
  };

  const handleAddLink = async () => {
    if (!linkUrl.trim()) return;
    
    const urlToImport = linkUrl;
    setLinkUrl('');
    setShowLinkInput(false);
    
    // For YouTube channels/playlists, close drawer and let background processing handle it
    if (isYouTubeChannelOrPlaylist(urlToImport)) {
      handleClose();
    }
    
    const result = await importFromUrl(urlToImport);
    if (result.success && !isYouTubeChannelOrPlaylist(urlToImport)) {
      onImportComplete?.();
      handleClose();
    }
  };

  return (
    <>
      <Drawer open={open} onOpenChange={(isOpen) => {
        if (!isOpen) {
          handleClose();
        } else {
          onOpenChange(true);
        }
      }}>
        <DrawerContent className="pb-8">
          <DrawerHeader className="pb-2">
            <DrawerTitle>
              {importProgress 
                ? t('recipes.processing', 'Processing Recipe')
                : t('recipes.addRecipe', 'Add Recipe')
              }
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4">
            <AnimatePresence mode="wait">
              {importProgress ? (
                <motion.div
                  key="progress"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-3 py-4"
                >
                  <p className="text-sm text-muted-foreground truncate">{importProgress.name}</p>
                  <Progress value={importProgress.progress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">
                    {importProgress.progress < 100 
                      ? t('recipes.parsingRecipe', 'Parsing recipe...') 
                      : t('recipes.parsingComplete', 'Complete!')}
                  </p>
                </motion.div>
              ) : showLinkInput ? (
                <motion.div
                  key="link-input"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3 py-2"
                >
                  <div className="flex gap-2">
                    <Input
                      type="url"
                      placeholder="https://youtube.com/watch?v=... or recipe URL"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddLink()}
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
                    {t('myRecipes.linkHelp', 'Paste a YouTube video, channel, playlist, or any URL with recipes')}
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="options"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-2 gap-2 py-2"
                >
                  {addOptions.map((option) => (
                    <button
                      key={option.label}
                      onClick={() => handleAddOption(option.action)}
                      className="flex items-center gap-3 p-3 rounded-xl bg-muted hover:bg-secondary transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <option.icon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{option.label}</p>
                        <p className="text-xs text-muted-foreground">{option.desc}</p>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </DrawerContent>
      </Drawer>

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
    </>
  );
}
