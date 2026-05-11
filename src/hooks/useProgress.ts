import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Progress {
  id: string;
  subject_id: string;
  lesson_id: string | null;
  completed: boolean;
  score: number | null;
  time_spent_minutes: number;
  completed_at: string | null;
}

export function useProgress(subjectId?: string) {
  const [progress, setProgress] = useState<Progress[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProgress = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      let query = supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', user.id);

      if (subjectId) {
        query = query.eq('subject_id', subjectId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching progress:', error);
      } else {
        setProgress(data || []);
      }
    } catch (error) {
      console.error('Error fetching progress:', error);
    } finally {
      setLoading(false);
    }
  }, [subjectId]);

  const updateProgress = useCallback(async (
    subjectId: string,
    lessonId: string,
    updates: {
      completed?: boolean;
      score?: number;
      time_spent_minutes?: number;
    }
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await supabase
        .from('user_progress')
        .upsert({
          user_id: user.id,
          subject_id: subjectId,
          lesson_id: lessonId,
          ...updates,
          completed_at: updates.completed ? new Date().toISOString() : null,
        }, {
          onConflict: 'user_id,lesson_id',
        });

      if (error) throw error;

      fetchProgress();
      return true;
    } catch (error) {
      console.error('Error updating progress:', error);
      return false;
    }
  }, [fetchProgress]);

  const getSubjectProgress = useCallback((subjectId: string) => {
    const subjectProgress = progress.filter(p => p.subject_id === subjectId);
    const completed = subjectProgress.filter(p => p.completed).length;
    const total = subjectProgress.length || 1;
    return {
      completed,
      total,
      percentage: Math.round((completed / total) * 100),
    };
  }, [progress]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  return {
    progress,
    loading,
    updateProgress,
    getSubjectProgress,
    refreshProgress: fetchProgress,
  };
}
