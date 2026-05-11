import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { toast } from '@/hooks/use-toast';
import { Trophy, Star, TrendingUp } from 'lucide-react';

interface GamificationContextType {
  totalXp: number;
  level: number;
  recentXpGain: number | null;
}

const GamificationContext = createContext<GamificationContextType | undefined>(undefined);

export function GamificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const [totalXp, setTotalXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [recentXpGain, setRecentXpGain] = useState<number | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    // Fetch initial profile stats
    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('total_xp, current_level')
        .eq('user_id', user.id)
        .single();

      if (!error && data) {
        setTotalXp(data.total_xp || 0);
        setLevel(data.current_level || 1);
      }
    };

    fetchProfile();

    // Subscribe to XP transactions for live notifications
    const xpChannel = supabase
      .channel('xp-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'xp_transactions',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const gain = payload.new.amount;
          setRecentXpGain(gain);
          
          // Update local state
          setTotalXp(prev => prev + gain);
          
          // Show toast
          toast({
            title: `+${gain} XP Earned!`,
            description: payload.new.reason,
            variant: 'default',
          });

          // Reset gain after animation
          setTimeout(() => setRecentXpGain(null), 3000);
        }
      )
      .subscribe();

    // Subscribe to Badge unlocks
    const badgeChannel = supabase
      .channel('badge-unlocks')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_badges',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          // Fetch badge details
          const { data: badge } = await supabase
            .from('badges')
            .select('name, icon_url')
            .eq('id', payload.new.badge_id)
            .single();

          if (badge) {
            toast({
              title: 'Achievement Unlocked!',
              description: `You've earned the "${badge.name}" badge! ${badge.icon_url || '🏆'}`,
              variant: 'default',
            });
          }
        }
      )
      .subscribe();

    // Also listen for level ups in profile updates
    const profileChannel = supabase
      .channel('profile-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new.current_level > payload.old.current_level) {
            setLevel(payload.new.current_level);
            toast({
              title: 'Level Up!',
              description: `Congratulations! You've reached Level ${payload.new.current_level}! 🎉`,
              variant: 'default',
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(xpChannel);
      supabase.removeChannel(badgeChannel);
      supabase.removeChannel(profileChannel);
    };
  }, [user?.id]);

  return (
    <GamificationContext.Provider value={{ totalXp, level, recentXpGain }}>
      {children}
    </GamificationContext.Provider>
  );
}

export function useGamificationStats() {
  const context = useContext(GamificationContext);
  if (context === undefined) {
    throw new Error('useGamificationStats must be used within a GamificationProvider');
  }
  return context;
}
