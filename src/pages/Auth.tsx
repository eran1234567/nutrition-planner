import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, Loader2, ChefHat, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { z } from 'zod';
import { toast } from '@/hooks/use-toast';

const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

const Auth = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { signIn, signUp, isAuthenticated, isLoading: authLoading } = useAuth();
  
  // Check URL param for mode
  const modeParam = searchParams.get('mode');
  const [isSignUp, setIsSignUp] = useState(modeParam === 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDevCreating, setIsDevCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; confirmPassword?: string }>({});

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/discover';

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate, from]);

  const validateForm = (): boolean => {
    const errors: { email?: string; password?: string; confirmPassword?: string } = {};
    
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      errors.email = emailResult.error.errors[0].message;
    }
    
    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      errors.password = passwordResult.error.errors[0].message;
    }
    
    if (isSignUp && password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);

    try {
      if (isSignUp) {
        const { error } = await signUp(email, password);
        if (error) {
          if (error.message.includes('already registered')) {
            setError('This email is already registered. Please sign in instead.');
          } else {
            setError(error.message);
          }
        } else {
          // Navigate back to where user came from (or default to discover)
          navigate(from, { replace: true });
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            setError('Invalid email or password. Please try again.');
          } else {
            setError(error.message);
          }
        } else {
          navigate(from, { replace: true });
        }
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setError(null);
    setFieldErrors({});
    setConfirmPassword('');
  };

  // Dev-only: create a user without client password policy restrictions using the dev function
  const handleDevCreateUser = async () => {
    if (!import.meta.env.DEV) return;
    if (!email || !password) {
      toast.error('Please enter email and password in the form first');
      return;
    }

    const secret = import.meta.env.VITE_DEV_BYPASS_SECRET;
    if (!secret) {
      toast.error('VITE_DEV_BYPASS_SECRET is not set in your local .env');
      return;
    }

    setIsDevCreating(true);
    try {
      const primaryUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dev-create-user`;
      const fallbackUrl = 'http://127.0.0.1:54321/functions/v1/dev-create-user';

      const attempt = async (url: string) => {
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-dev-bypass': secret,
            },
            body: JSON.stringify({ email, password }),
          });
          const text = await res.text().catch(() => '');
          let data: any = {};
          try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
          return { res, data };
        } catch (err) {
          return { err };
        }
      };

      // Try configured SUPABASE URL first
      let result = await attempt(primaryUrl);
      if (result.err || (result.res && result.res.status === 404)) {
        // Try local functions server as fallback
        toast('Primary function not reachable; trying local functions server...', { duration: 3000 });
        result = await attempt(fallbackUrl);
      }

      if (result.err) {
        console.error('Dev create user request failed:', result.err);
        toast.error(String(result.err));
        return;
      }

      const { res, data } = result;
      if (!res.ok) {
        toast.error(data?.error?.message || data?.error || JSON.stringify(data));
        return;
      }

      toast.success('Dev user created. Signing in...');
      const { error: signInError } = await signIn(email, password);
      if (signInError) {
        toast.error(signInError.message || String(signInError));
      } else {
        navigate(from, { replace: true });
      }
    } catch (err) {
      console.error('Unexpected error in handleDevCreateUser:', err);
      toast.error(String(err));
    } finally {
      setIsDevCreating(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background to-muted/30 px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4"
          >
            <ChefHat className="w-8 h-8 text-primary" />
          </motion.div>
          <h1 className="text-2xl font-bold text-foreground">
            {isSignUp ? t('auth.createAccount', 'Create Account') : t('auth.welcomeBack', 'Welcome Back')}
          </h1>
          <p className="text-muted-foreground mt-2">
            {isSignUp 
              ? t('auth.signUpSubtitle', 'Start your meal planning journey')
              : t('auth.signInSubtitle', 'Sign in to continue planning meals')}
          </p>
        </div>

        {/* Auth Form Card */}
        <motion.div
          layout
          className="bg-card border border-border rounded-2xl shadow-lg p-6"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.email', 'Email')}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setFieldErrors(prev => ({ ...prev, email: undefined }));
                  }}
                  className={`pl-10 ${fieldErrors.email ? 'border-destructive' : ''}`}
                  disabled={isLoading}
                  autoComplete="email"
                />
              </div>
              {fieldErrors.email && (
                <p className="text-sm text-destructive">{fieldErrors.email}</p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.password', 'Password')}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setFieldErrors(prev => ({ ...prev, password: undefined }));
                  }}
                  className={`pl-10 pr-10 ${fieldErrors.password ? 'border-destructive' : ''}`}
                  disabled={isLoading}
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="text-sm text-destructive">{fieldErrors.password}</p>
              )}
            </div>

            {/* Confirm Password Field (Sign Up only) */}
            <AnimatePresence mode="wait">
              {isSignUp && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-2"
                >
                  <Label htmlFor="confirmPassword">{t('auth.confirmPassword', 'Confirm Password')}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setFieldErrors(prev => ({ ...prev, confirmPassword: undefined }));
                      }}
                      className={`pl-10 ${fieldErrors.confirmPassword ? 'border-destructive' : ''}`}
                      disabled={isLoading}
                      autoComplete="new-password"
                    />
                  </div>
                  {fieldErrors.confirmPassword && (
                    <p className="text-sm text-destructive">{fieldErrors.confirmPassword}</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error Message */}
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm"
                >
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )} 
            </AnimatePresence>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isSignUp ? t('auth.creatingAccount', 'Creating account...') : t('auth.signingIn', 'Signing in...')}
                </>
              ) : (
                isSignUp ? t('auth.signUp', 'Sign Up') : t('auth.signIn', 'Sign In')
              )}
            </Button>

            {/* Dev-only helper: creates a user via the service-role function (DEV only) */}
            {import.meta.env.DEV && (
              <div className="mt-3 text-center">
                <button
                  type="button"
                  onClick={handleDevCreateUser}
                  disabled={isDevCreating || !email || !password}
                  className="text-sm text-muted-foreground hover:underline"
                >
                  {isDevCreating ? 'Creating dev user...' : 'Dev: create test user (uses form email/password)'}
                </button>
                <p className="text-xs text-muted-foreground mt-2">Dev-only: uses the `dev-create-user` function. Ensure `VITE_DEV_BYPASS_SECRET` is set locally.</p>
              </div>
            )}
          </form>

          {/* Toggle Mode */}
          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">
              {isSignUp 
                ? t('auth.haveAccount', 'Already have an account?')
                : t('auth.noAccount', "Don't have an account?")}
            </span>{' '}
            <button
              type="button"
              onClick={toggleMode}
              className="text-primary font-medium hover:underline"
              disabled={isLoading}
            >
              {isSignUp ? t('auth.signIn', 'Sign In') : t('auth.signUp', 'Sign Up')}
            </button>
          </div>
        </motion.div>

        {/* Back to Home */}
        <div className="text-center mt-6">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← {t('auth.backToHome', 'Back to Home')}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
