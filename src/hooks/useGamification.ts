import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon_url: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  earned_at?: string;
}

export interface LeaderboardEntry {
  user_id: string;
  name: string;
  total_xp: number;
  current_level: number;
  rank: number;
}

export function useGamification() {
  const { user } = useUser();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchUserBadges = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('user_badges')
        .select(`
          earned_at,
          badges (
            id, name, description, icon_url, rarity
          )
        `)
        .eq('user_id', user.id);

      if (error) throw error;
      
      const formattedBadges = data.map((item: any) => ({
        ...item.badges,
        earned_at: item.earned_at
      }));
      
      setBadges(formattedBadges);
    } catch (error) {
      console.error('Error fetching badges:', error);
    }
  }, [user?.id]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('leaderboard')
        .select('*')
        .limit(50);

      if (error) throw error;
      setLeaderboard(data as LeaderboardEntry[]);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const awardXP = useCallback(async (amount: number, reason: string) => {
    if (!user?.id) return;
    try {
      const { error } = await supabase.rpc('award_xp', {
        target_user_id: user.id,
        xp_amount: amount,
        xp_reason: reason
      });

      if (error) throw error;
      // Refresh user context or profile if needed
    } catch (error) {
      console.error('Error awarding XP:', error);
    }
  }, [user?.id]);

  return {
    badges,
    leaderboard,
    isLoading,
    fetchUserBadges,
    fetchLeaderboard,
    awardXP
  };
}
