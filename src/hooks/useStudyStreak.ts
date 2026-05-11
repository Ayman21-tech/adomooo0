import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface StudyStreak {
  current_streak: number;
  longest_streak: number;
  last_study_date: string | null;
  total_study_days: number;
}

export function useStudyStreak() {
  const [streak, setStreak] = useState<StudyStreak | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStreak = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('study_streaks')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching streak:', error);
      }
      
      if (data) {
        setStreak(data);
      }
    } catch (error) {
      console.error('Error fetching streak:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const recordStudySession = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date().toISOString().split('T')[0];
      
      const { data: existingStreak } = await supabase
        .from('study_streaks')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!existingStreak) return;

      const lastStudyDate = existingStreak.last_study_date;
      let newCurrentStreak = existingStreak.current_streak;
      let newTotalDays = existingStreak.total_study_days;

      if (lastStudyDate !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (lastStudyDate === yesterdayStr) {
          newCurrentStreak += 1;
        } else if (lastStudyDate !== today) {
          newCurrentStreak = 1;
        }
        newTotalDays += 1;

        const { data: updated, error } = await supabase
          .from('study_streaks')
          .update({
            current_streak: newCurrentStreak,
            longest_streak: Math.max(existingStreak.longest_streak, newCurrentStreak),
            last_study_date: today,
            total_study_days: newTotalDays,
          })
          .eq('user_id', user.id)
          .select()
          .single();

        if (!error && updated) {
          setStreak(updated);
        }
      }
    } catch (error) {
      console.error('Error recording study session:', error);
    }
  }, []);

  useEffect(() => {
    fetchStreak();
  }, [fetchStreak]);

  return {
    streak,
    loading,
    recordStudySession,
    refreshStreak: fetchStreak,
  };
}
