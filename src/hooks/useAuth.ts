import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useMealPlanStore } from '@/stores/mealPlanStore';
import { useAppStore } from '@/stores/appStore';

// NOTE: This hook is used in many components (ProtectedRoute + pages).
// With React StrictMode, effects can mount/unmount/mount during dev, and multiple
// callers would otherwise register multiple auth listeners. Those listeners can
// race and temporarily set session/userId to null, wiping user-scoped persisted
// stores (e.g., macro calculator inputs).
//
// To keep persisted state stable, we initialize auth listeners only once per app.
let authListenerInitialized = false;

export const useAuth = () => {
  const { 
    user, 
    session, 
    profile, 
    isLoading, 
    setUser, 
    setSession, 
    setProfile, 
    setIsLoading 
  } = useAuthStore();

  // Track previous user ID to detect user changes
  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Initialize auth listeners exactly once for the whole app.
    // (Do not unsubscribe on component unmount; this avoids StrictMode double-invoke
    // breaking the singleton listener in development.)
    if (authListenerInitialized) return;
    authListenerInitialized = true;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const newUserId = session?.user?.id ?? null;
        prevUserIdRef.current = newUserId;

        // Update meal plan store with current user ID - this handles data isolation
        useMealPlanStore.getState().setCurrentUserId(newUserId);

        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer profile fetch with setTimeout to avoid deadlock
        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id);
          }, 0);
        } else {
          setProfile(null);
        }
        setIsLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const userId = session?.user?.id ?? null;
      prevUserIdRef.current = userId;
      
      // Set user ID in meal plan store for data isolation
      useMealPlanStore.getState().setCurrentUserId(userId);
      
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setIsLoading(false);
    });
    // Intentionally no cleanup (see singleton note above)
    void subscription;
  }, [setUser, setSession, setProfile, setIsLoading]);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (!error && data) {
      setProfile(data);
    }
  };

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    return { error };
  };

  const signOut = async () => {
    try {
      // Reset auth state first to ensure immediate UI feedback
      useAuthStore.getState().reset();
      
      // Reset meal plan store to clear user-specific data
      useMealPlanStore.getState().resetPlanState();
      // Also set user ID to null so storage key switches
      useMealPlanStore.getState().setCurrentUserId(null);
      
      // Clear selected meals from app store
      useAppStore.getState().clearSelectedMeals();
      
      // Clear pending onboarding data from localStorage
      localStorage.removeItem('pendingOnboarding');
      
      const { error } = await supabase.auth.signOut();
      return { error };
    } catch (error) {
      if (import.meta.env.DEV) console.error('Sign out error:', error);
      return { error: error as Error };
    }
  };

  return {
    user,
    session,
    profile,
    isLoading,
    signUp,
    signIn,
    signOut,
    isAuthenticated: !!session
  };
};
