import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ChefHat, Salad, Calendar, ShoppingCart, Sparkles, LogIn, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const Index = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isAuthenticated, signOut, isLoading } = useAuth();

  const features = [
    { icon: Salad, label: 'Smart Recommendations', desc: 'Personalized meal suggestions' },
    { icon: Calendar, label: '7-Day Plans', desc: 'Automated weekly planning' },
    { icon: ShoppingCart, label: 'Grocery Lists', desc: 'Auto-generated shopping' },
  ];

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen gradient-hero">
      {/* Top auth button */}
      <div className="absolute top-4 right-4">
        {!isLoading && (
          isAuthenticated ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="gap-2"
            >
              <LogOut className="w-4 h-4" />
              {t('auth.signOut', 'Sign Out')}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/auth')}
              className="gap-2"
            >
              <LogIn className="w-4 h-4" />
              {t('auth.signIn', 'Sign In')}
            </Button>
          )
        )}
      </div>

      <div className="page-container flex flex-col items-center justify-center min-h-screen text-center px-6">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <div className="w-20 h-20 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-6 shadow-glow-primary">
            <ChefHat className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-3">
            {t('app.name')}
          </h1>
          <p className="text-lg text-muted-foreground max-w-xs mx-auto">
            Plan healthy meals for your week in minutes, not hours
          </p>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="grid grid-cols-1 gap-3 w-full max-w-sm mb-10"
        >
          {features.map((feature, index) => (
            <motion.div
              key={feature.label}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + index * 0.1 }}
              className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border"
            >
              <div className="w-12 h-12 rounded-xl bg-primary-soft flex items-center justify-center flex-shrink-0">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-foreground">{feature.label}</h3>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="w-full max-w-sm space-y-3"
        >
          <Button
            onClick={() => navigate('/discover')}
            className="w-full h-14 text-lg font-semibold gradient-primary hover:opacity-90 transition-opacity"
            size="lg"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            {t('onboarding.getStarted')}
          </Button>
          <Button
            variant="ghost"
            onClick={() => navigate('/discover')}
            className="w-full"
          >
            Browse recipes first
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

export default Index;
