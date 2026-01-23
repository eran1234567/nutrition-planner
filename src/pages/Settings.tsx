import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  User, 
  Target, 
  LogOut,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BottomNav } from '@/components/layout/BottomNav';
import { useAuth } from '@/hooks/useAuth';
import { useUserData } from '@/hooks/useUserData';

const settingsItems = [
  {
    id: 'goals',
    icon: Target,
    labelKey: 'settings.goals',
    descKey: 'settings.goalsDesc',
    path: '/plan',
  },
];

export default function Settings() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { signOut, user } = useAuth();
  const { profile } = useUserData();

  const handleEditSection = (item: typeof settingsItems[0]) => {
    if (item.path) {
      navigate(item.path);
    }
  };

  const handleSignOut = async () => {
    // Navigate first for immediate feedback, then sign out
    navigate('/');
    await signOut();
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="page-container">
        {/* Header */}
        <div className="flex items-center gap-4 py-4 mb-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-card flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">{t('settings.title')}</h1>
        </div>

        {/* User info */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-xl p-4 mb-6 flex items-center gap-4"
        >
          <div className="w-14 h-14 rounded-full bg-primary-soft flex items-center justify-center">
            <User className="w-7 h-7 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-semibold">{profile?.display_name || user?.email || 'User'}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </motion.div>

        {/* Settings list */}
        <div className="space-y-2">
          {settingsItems.map((item, index) => (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => handleEditSection(item)}
              className="w-full flex items-center gap-4 p-4 bg-card rounded-xl hover:bg-card/80 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-primary-soft flex items-center justify-center">
                <item.icon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium">{t(item.labelKey)}</p>
                <p className="text-sm text-muted-foreground">{t(item.descKey)}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </motion.button>
          ))}
        </div>

        {/* Sign out */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-8"
        >
          <Button
            variant="outline"
            onClick={handleSignOut}
            className="w-full h-12 text-destructive border-destructive/30 hover:bg-destructive/10"
          >
            <LogOut className="w-5 h-5 mr-2" />
            {t('settings.signOut')}
          </Button>
        </motion.div>
      </div>

      <BottomNav />
    </div>
  );
}
