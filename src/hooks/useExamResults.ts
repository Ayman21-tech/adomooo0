import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export interface ExamResult {
  id: string;
  user_id: string;
  subject_id: string;
  chapter_id: string | null;
  exam_type: string;
  total_questions: number;
  correct_answers: number;
  time_taken_seconds: number | null;
  mistakes: Json | null;
  created_at: string;
}

export function useExamResults() {
  const [results, setResults] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) return;

      const { data, error } = await supabase
        .from('exam_results')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setResults(data as ExamResult[] || []);
    } catch (error) {
      console.error('Error fetching exam results:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const saveResult = async (
    subjectId: string,
    examType: string,
    totalQuestions: number,
    correctAnswers: number,
    timeTakenSeconds?: number,
    chapterId?: string,
    mistakes: unknown[] = []
  ) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) return null;

      const { data, error } = await supabase
        .from('exam_results')
        .insert({
          user_id: session.session.user.id,
          subject_id: subjectId,
          chapter_id: chapterId || null,
          exam_type: examType,
          total_questions: totalQuestions,
          correct_answers: correctAnswers,
          time_taken_seconds: timeTakenSeconds ?? null,
          mistakes: mistakes as Json,
        })
        .select()
        .single();

      if (error) throw error;
      setResults(prev => [data as ExamResult, ...prev]);
      return data;
    } catch (error) {
      console.error('Error saving exam result:', error);
      return null;
    }
  };

  const getResultsBySubject = (subjectId: string) => {
    return results.filter(r => r.subject_id === subjectId);
  };

  const getResultsByChapter = (chapterId: string) => {
    return results.filter(r => r.chapter_id === chapterId);
  };

  const getAverageScore = (subjectId?: string, chapterId?: string) => {
    let filtered = results;
    if (subjectId) filtered = filtered.filter(r => r.subject_id === subjectId);
    if (chapterId) filtered = filtered.filter(r => r.chapter_id === chapterId);
    
    if (filtered.length === 0) return 0;
    
    const totalScore = filtered.reduce((sum, r) => sum + (r.correct_answers / r.total_questions) * 100, 0);
    return Math.round(totalScore / filtered.length);
  };

  return {
    results,
    loading,
    saveResult,
    getResultsBySubject,
    getResultsByChapter,
    getAverageScore,
    refresh: fetchResults,
  };
}
