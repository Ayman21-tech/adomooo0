import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type Theme = 'dark' | 'light';
export type OnboardingStep = 1 | 2 | 3 | 4 | 'complete';
export type Personality = 'rough' | 'friendly' | 'parent' | 'nerd';
export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'bn', label: 'বাংলা', flag: '🇧🇩' },
  { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
  { code: 'id', label: 'Bahasa', flag: '🇮🇩' },
  { code: 'ur', label: 'اردو', flag: '🇵🇰' },
  { code: 'th', label: 'ไทย', flag: '🇹🇭' },
] as const;

export type UserRole = 'student' | 'teacher';

export interface UserProfile {
  name: string;
  email: string;
  role: UserRole;
  age: number | null;
  class_level: string;
  school_name: string;
  selected_subjects: string[];
  preferred_language: string;
  default_language: 'bangla' | 'english';
  theme: Theme;
  personality: Personality;
  onboarding_step: OnboardingStep;
  low_data_mode: boolean;
}

const defaultProfile: UserProfile = {
  name: '',
  email: '',
  role: 'student',
  age: null,
  class_level: '',
  school_name: '',
  selected_subjects: [],
  preferred_language: 'en',
  default_language: 'english',
  theme: 'light',
  personality: 'friendly',
  onboarding_step: 1,
  low_data_mode: false,
};

interface UserContextType {
  user: UserProfile;
  loading: boolean;
  updateUser: (updates: Partial<UserProfile>) => void;
  resetUser: () => void;
  isOnboardingComplete: boolean;
  getCurrentStep: () => OnboardingStep;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const STORAGE_KEY = 'adomo_ai_user';

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        return { ...defaultProfile, ...parsed };
      }
    } catch (e) {
      console.error('Failed to load user profile:', e);
    }
    return defaultProfile;
  });

  const [loading, setLoading] = useState(true);

  // Listen for auth state changes — sync DB profile to local state
  // CRITICAL: never await inside the callback (deadlock), use fire-and-forget
  useEffect(() => {
    const syncProfileFromDb = async (userId: string) => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (profile) {
          setUser(prev => ({
            ...prev,
            name: profile.name || prev.name,
            email: profile.email || prev.email,
            role: profile.role || prev.role,
            class_level: profile.class_level || prev.class_level,
            school_name: profile.school_name || prev.school_name,
            selected_subjects: profile.selected_subjects || prev.selected_subjects,
            preferred_language: (profile as any).preferred_language || prev.preferred_language || 'en',
            default_language: (profile.default_language as 'bangla' | 'english') || prev.default_language,
            onboarding_step:
              profile.class_level && profile.selected_subjects && profile.selected_subjects.length > 0
                ? ('complete' as OnboardingStep)
                : prev.onboarding_step,
          }));
        }
      } catch (err) {
        console.error('Profile sync error:', err);
      } finally {
        setLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        resetUser();
        setLoading(false);
        return;
      }
      if ((event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        syncProfileFromDb(session.user.id);
      } else if (event === 'INITIAL_SESSION' && !session) {
        setLoading(false);
      }
    });

    // Also do initial restore
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        syncProfileFromDb(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Debounced save to localStorage
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      } catch (e) {
        console.error('Failed to save user profile:', e);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [user]);

  // Sync theme with document
  useEffect(() => {
    if (user.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [user.theme]);

  const updateUser = useCallback((updates: Partial<UserProfile>) => {
    setUser(prev => ({ ...prev, ...updates }));
  }, []);

  const resetUser = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(defaultProfile);
    document.documentElement.classList.remove('dark');
  }, []);

  const isOnboardingComplete = user.onboarding_step === 'complete';

  const getCurrentStep = useCallback((): OnboardingStep => {
    return user.onboarding_step;
  }, [user.onboarding_step]);

  return (
    <UserContext.Provider value={{ user, loading, updateUser, resetUser, isOnboardingComplete, getCurrentStep }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
