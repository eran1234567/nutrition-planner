import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface UserProfile {
  id: string;
  user_id: string;
  display_name: string | null;
  age: number | null;
  locale: string | null;
  units: 'imperial' | 'metric' | null;
  onboarding_completed: boolean | null;
}

export interface UserPreferences {
  id: string;
  profile_id: string | null;
  diet_type: string | null;
  allergies: string[] | null;
  dislikes: string[] | null;
  calorie_target: number | null;
  protein_target: number | null;
  carbs_target: number | null;
  fat_target: number | null;
  meals_per_day: number | null;
  plan_duration: number | null;
  medical_diabetes_friendly: boolean | null;
  medical_kidney_friendly: boolean | null;
  medical_heart_healthy: boolean | null;
  medical_low_sodium: boolean | null;
  medical_disclaimer_accepted: boolean | null;
  cuisines_preferred: string[] | null;
  budget_level: string | null;
  max_cook_time: number | null;
}

export function useUserData() {
  const { user, isAuthenticated } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setPreferences(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
      }

      if (!profileData) {
        setProfile(null);
        setPreferences(null);
        return;
      }

      setProfile(profileData as UserProfile);

      // Fetch preferences using profile_id
      const { data: prefsData, error: prefsError } = await supabase
        .from('preferences')
        .select('*')
        .eq('profile_id', profileData.id)
        .maybeSingle();

      if (prefsError) {
        console.error('Error fetching preferences:', prefsError);
      }

      setPreferences((prefsData as UserPreferences) ?? null);
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const saveProfile = async (data: Partial<UserProfile>): Promise<UserProfile | null> => {
    if (!user) return null;

    try {
      // First check if profile exists
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      let result: UserProfile | null = null;

      if (existing) {
        // Update existing profile
        const { data: updated, error: updateError } = await supabase
          .from('profiles')
          .update(data)
          .eq('user_id', user.id)
          .select('*')
          .single();

        if (updateError) throw updateError;
        result = updated as UserProfile;
      } else {
        // Create new profile
        const { data: created, error: insertError } = await supabase
          .from('profiles')
          .insert({ user_id: user.id, ...(data as any) })
          .select('*')
          .single();

        if (insertError) throw insertError;
        result = created as UserProfile;
      }

      if (result) {
        setProfile(result);
      }
      return result;
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Failed to save profile');
      return null;
    }
  };

  const resolveProfileId = async (): Promise<string | null> => {
    if (!user) return null;
    if (profile?.id) return profile.id;

    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;
    return data?.id ?? null;
  };

  const savePreferences = async (
    data: Partial<Omit<UserPreferences, 'id' | 'profile_id'>>,
    explicitProfileId?: string
  ) => {
    if (!user) return null;

    try {
      // Use explicit profile ID if provided, otherwise resolve it
      const profileId = explicitProfileId || await resolveProfileId();
      if (!profileId) {
        console.error('No profile ID available for saving preferences');
        return null;
      }

      const { data: existing, error: existingError } = await supabase
        .from('preferences')
        .select('id')
        .eq('profile_id', profileId)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existing) {
        const { data: updated, error } = await supabase
          .from('preferences')
          .update(data as any)
          .eq('profile_id', profileId)
          .select('*')
          .single();

        if (error) throw error;
        setPreferences(updated as UserPreferences);
        return updated;
      }

      // Create new preferences
      const { data: created, error } = await supabase
        .from('preferences')
        .insert({ ...(data as any), profile_id: profileId })
        .select('*')
        .single();

      if (error) throw error;
      setPreferences(created as UserPreferences);
      return created;
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error('Failed to save preferences');
      return null;
    }
  };

  return {
    profile,
    preferences,
    loading,
    saveProfile,
    savePreferences,
    refetch: fetchUserData,
  };
}
