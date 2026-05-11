import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import type { Json } from '@/integrations/supabase/types';

export interface LearningActivity {
  id: string;
  user_id: string;
  subject_id: string;
  chapter_id: string | null;
  activity_type: string;
  duration_minutes: number | null;
  score: number | null;
  metadata: Json | null;
  created_at: string;
}

export interface SubjectMastery {
  id: string;
  user_id: string;
  subject_id: string;
  chapter_id: string | null;
  mastery_score: number | null;
  weakness_tags: string[] | null;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useLearningActivity() {
  const { user } = useUser();
  const [activities, setActivities] = useState<LearningActivity[]>([]);
  const [mastery, setMastery] = useState<SubjectMastery[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) return;

      const [activitiesRes, masteryRes] = await Promise.all([
        supabase
          .from('learning_activity')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('subject_mastery')
          .select('*'),
      ]);

      if (activitiesRes.error) throw activitiesRes.error;
      if (masteryRes.error) throw masteryRes.error;

      setActivities(activitiesRes.data as LearningActivity[] || []);
      setMastery(masteryRes.data as SubjectMastery[] || []);
    } catch (error) {
      console.error('Error fetching learning activity:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const logActivity = async (
    subjectId: string,
    activityType: string,
    durationMinutes = 0,
    score?: number,
    chapterId?: string,
    metadata: Record<string, unknown> = {}
  ) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) return null;

      const { data, error } = await supabase
        .from('learning_activity')
        .insert({
          user_id: session.session.user.id,
          subject_id: subjectId,
          chapter_id: chapterId || null,
          activity_type: activityType,
          duration_minutes: durationMinutes,
          score: score ?? null,
          metadata: metadata as Json,
        })
        .select()
        .single();

      if (error) throw error;
      setActivities(prev => [data as LearningActivity, ...prev]);
      return data;
    } catch (error) {
      console.error('Error logging activity:', error);
      return null;
    }
  };

  const updateMastery = async (subjectId: string, chapterId: string | null, masteryScore: number, weaknessTags: string[] = []) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) return null;

      const existing = mastery.find(m => m.subject_id === subjectId && m.chapter_id === chapterId);

      if (existing) {
        const { data, error } = await supabase
          .from('subject_mastery')
          .update({
            mastery_score: masteryScore,
            weakness_tags: weaknessTags,
            last_activity_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        setMastery(prev => prev.map(m => m.id === existing.id ? data as SubjectMastery : m));
        return data;
      } else {
        const { data, error } = await supabase
          .from('subject_mastery')
          .insert({
            user_id: session.session.user.id,
            subject_id: subjectId,
            chapter_id: chapterId,
            mastery_score: masteryScore,
            weakness_tags: weaknessTags,
            last_activity_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) throw error;
        setMastery(prev => [...prev, data as SubjectMastery]);
        return data;
      }
    } catch (error) {
      console.error('Error updating mastery:', error);
      return null;
    }
  };

  // Calculate subject-level statistics
  const getSubjectStats = (subjectId: string) => {
    const subjectActivities = activities.filter(a => a.subject_id === subjectId);
    const subjectMastery = mastery.filter(m => m.subject_id === subjectId);
    
    const avgMastery = subjectMastery.length > 0
      ? subjectMastery.reduce((sum, m) => sum + (m.mastery_score || 0), 0) / subjectMastery.length
      : 0;

    const lastActivity = subjectActivities[0]?.created_at;
    const daysSinceActivity = lastActivity
      ? Math.floor((Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const totalTime = subjectActivities.reduce((sum, a) => sum + (a.duration_minutes || 0), 0);

    return {
      avgMastery: Math.round(avgMastery),
      lastActivity,
      daysSinceActivity,
      totalTime,
      activityCount: subjectActivities.length,
      isIgnored: daysSinceActivity !== null && daysSinceActivity > 7,
    };
  };

  // Get weak subjects (mastery < 40%)
  const getWeakSubjects = () => {
    const subjectScores = new Map<string, number[]>();
    
    mastery.forEach(m => {
      const scores = subjectScores.get(m.subject_id) || [];
      scores.push(m.mastery_score || 0);
      subjectScores.set(m.subject_id, scores);
    });

    return Array.from(subjectScores.entries())
      .map(([subjectId, scores]) => ({
        subjectId,
        avgMastery: scores.reduce((a, b) => a + b, 0) / scores.length,
      }))
      .filter(s => s.avgMastery < 40);
  };

  // Get ignored subjects (selected but no activity in 7+ days)
  const getIgnoredSubjects = () => {
    return user.selected_subjects.filter(subjectId => {
      const stats = getSubjectStats(subjectId);
      return stats.isIgnored || stats.activityCount === 0;
    });
  };

  // Get overall progress
  const getOverallProgress = () => {
    const masteryScores = mastery
      .map(m => m.mastery_score)
      .filter((score): score is number => typeof score === 'number' && !Number.isNaN(score));

    if (masteryScores.length > 0) {
      const avgMastery = masteryScores.reduce((sum, score) => sum + score, 0) / masteryScores.length;
      return Math.round(avgMastery);
    }

    // Fallback: if mastery rows are not populated yet, infer progress from scored activities.
    const activityScores = activities
      .map(a => a.score)
      .filter((score): score is number => typeof score === 'number' && !Number.isNaN(score));

    if (activityScores.length > 0) {
      const avgActivityScore = activityScores.reduce((sum, score) => sum + score, 0) / activityScores.length;
      return Math.round(avgActivityScore);
    }

    return 0;
  };

  // Get activity for last N days
  const getRecentActivity = (days: number) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return activities.filter(a => new Date(a.created_at) >= cutoff);
  };

  // Get activity by day for chart
  const getActivityByDay = (days: number) => {
    const result: { date: string; count: number; minutes: number }[] = [];
    const now = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayActivities = activities.filter(a => 
        a.created_at.split('T')[0] === dateStr
      );
      
      result.push({
        date: dateStr,
        count: dayActivities.length,
        minutes: dayActivities.reduce((sum, a) => sum + (a.duration_minutes || 0), 0),
      });
    }
    
    return result;
  };

  return {
    activities,
    mastery,
    loading,
    logActivity,
    updateMastery,
    getSubjectStats,
    getWeakSubjects,
    getIgnoredSubjects,
    getOverallProgress,
    getRecentActivity,
    getActivityByDay,
    refresh: fetchData,
  };
}
