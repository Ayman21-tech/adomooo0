import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ConceptNode {
  id: string;
  name: string;
  difficulty: number;
  parent_id: string | null;
  mastery: number | null;
  is_weak: boolean;
  streak: number;
  trend: 'improving' | 'declining' | 'stable';
  status: 'mastered' | 'weak' | 'learning' | 'not_started';
  metadata?: { keywords?: string[]; type?: string };
}

export interface ConceptMap {
  nodes: ConceptNode[];
  total: number;
  mastered: number;
  weak: number;
  learning: number;
  not_started: number;
}

export interface WeakConcept {
  id: string;
  name: string;
  mastery: number;
  subject: string;
  trend: 'improving' | 'declining' | 'stable';
  weakness_level: 'critical' | 'weak' | 'borderline' | 'ok';
  difficulty: number;
  attempts: number;
}

export interface PrereqGap {
  concept: string;
  concept_mastery: number;
  prerequisite: string;
  prerequisite_mastery: number;
  urgency: 'high' | 'medium';
}

export interface RewardSignal {
  type: string;
  message: string;
  icon: string;
}

export interface StudentProfile {
  weak_concepts: WeakConcept[];
  trending_down: Array<{ id: string; name: string; mastery: number; scores: number[] }>;
  trending_up: Array<{ id: string; name: string; mastery: number; scores: number[] }>;
  prerequisite_gaps: PrereqGap[];
  recommended_difficulty: number;
  recommended_difficulty_label: 'easy' | 'medium' | 'hard';
  short_term_memories: Array<{ key: string; value: any }>;
  long_term_memories: Array<{ key: string; value: any }>;
  learning_style: string | null;
  recent_struggles: any[];
  rewards: RewardSignal[];
  mastered_count: number;
  critical_weak_count: number;
  total_concepts: number;
  streak_days: number;
  daily_sessions_today: number;
}

export interface PerformanceResult {
  updated: boolean;
  new_mastery: number;
  is_weak: boolean;
  difficulty_calibration: number;
  streak: number;
  trend: 'improving' | 'declining' | 'stable';
  weakness_level: 'critical' | 'weak' | 'borderline' | 'ok';
}

// ─── Core call helper ─────────────────────────────────────────────────────────
async function callLearningEngine(action: string, params: Record<string, any>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/learning-engine`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action, ...params }),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Learning engine error (${response.status})`);
  }

  return response.json();
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useLearningEngine() {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [conceptMap, setConceptMap] = useState<ConceptMap | null>(null);
  const [learningPath, setLearningPath] = useState<any | null>(null);
  const [learningDNA, setLearningDNA] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [prepContent, setPrepContent] = useState<string>('');
  const [isPrepLoading, setIsPrepLoading] = useState(false);

  const getStudentProfile = useCallback(async (subjectId: string): Promise<StudentProfile | null> => {
    try {
      setIsLoading(true);
      const result = await callLearningEngine('get-student-profile', { subject_id: subjectId });
      setProfile(result);
      return result;
    } catch (error) {
      console.error('Failed to get student profile:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logPerformance = useCallback(async (
    conceptId: string,
    score: number,
    timeSpent?: number
  ): Promise<PerformanceResult | null> => {
    try {
      const result = await callLearningEngine('log-performance', {
        concept_id: conceptId,
        score,
        time_spent: timeSpent,
      });
      return result;
    } catch (error) {
      console.error('Failed to log performance:', error);
      return null;
    }
  }, []);

  const buildKnowledgeGraph = useCallback(async (
    subjectId: string,
    chapterId: string,
    chapterText: string
  ) => {
    try {
      return await callLearningEngine('build-knowledge-graph', {
        subject_id: subjectId,
        chapter_id: chapterId,
        chapter_text: chapterText,
      });
    } catch (error) {
      console.error('Failed to build knowledge graph:', error);
      return null;
    }
  }, []);

  const verifyAnswer = useCallback(async (
    question: string,
    generatedAnswer: string,
    bookContext?: string
  ) => {
    try {
      return await callLearningEngine('verify-answer', {
        question,
        generated_answer: generatedAnswer,
        book_context: bookContext,
      });
    } catch (error) {
      console.error('Failed to verify answer:', error);
      return null;
    }
  }, []);

  const storeMemory = useCallback(async (
    memoryType: 'short_term' | 'long_term',
    key: string,
    value: any,
    subjectId?: string
  ) => {
    try {
      return await callLearningEngine('store-memory', {
        memory_type: memoryType,
        memory_key: key,
        memory_value: value,
        subject_id: subjectId,
      });
    } catch (error) {
      console.error('Failed to store memory:', error);
      return null;
    }
  }, []);

  const getConceptMap = useCallback(async (subjectId: string): Promise<ConceptMap | null> => {
    try {
      setIsLoading(true);
      const result = await callLearningEngine('get-concept-map', { subject_id: subjectId });
      setConceptMap(result);
      return result;
    } catch (error) {
      console.error('Failed to get concept map:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const generatePrepContent = useCallback(async (
    subjectId: string,
    chapterId: string | null,
    prepType: string,
    language: string = 'english'
  ): Promise<{ content: string; error?: string } | null> => {
    try {
      setIsPrepLoading(true);
      setPrepContent('');
      const result = await callLearningEngine('generate-prep-content', {
        subject_id: subjectId,
        chapter_id: chapterId || null,
        prep_type: prepType,
        language,
      });
      if (result.content) {
        setPrepContent(result.content);
      }
      return result;
    } catch (error) {
      console.error('Failed to generate prep content:', error);
      return null;
    } finally {
      setIsPrepLoading(false);
    }
  }, []);

  const getWeakConcepts = useCallback(async (subjectId: string) => {
    const p = await getStudentProfile(subjectId);
    return p?.weak_concepts || [];
  }, [getStudentProfile]);

  const generateExamQuestions = useCallback(async (
    subjectId: string,
    chapterId: string | null,
    examType: string,
    questionCount: number,
    language: string = 'english',
    questionTypes?: string[],
    questionTypeCounts?: Record<string, number>,
  ) => {
    try {
      return await callLearningEngine('generate-exam-questions', {
        subject_id: subjectId,
        chapter_id: chapterId,
        exam_type: examType,
        question_count: questionCount,
        language,
        question_types: questionTypes,
        question_type_counts: questionTypeCounts,
      });
    } catch (error) {
      console.error('Failed to generate exam questions:', error);
      return null;
    }
  }, []);

  const runIntelligenceCycle = useCallback(async (
    subjectId: string,
    userMessage: string,
    assistantAnswer: string,
    responseTimeSeconds?: number,
    bookContext?: string,
  ) => {
    try {
      return await callLearningEngine('run-intelligence-cycle', {
        subject_id: subjectId,
        user_message: userMessage,
        assistant_answer: assistantAnswer,
        response_time_seconds: responseTimeSeconds,
        book_context: bookContext,
      });
    } catch (error) {
      console.error('Failed to run intelligence cycle:', error);
      return null;
    }
  }, []);
  const generateExamFeedback = useCallback(async (
    subjectId: string,
    examData: {
      totalQuestions: number;
      correctAnswers: number;
      timeTaken: number;
      mistakes: any[];
      examType: string;
    },
    language: string = 'english'
  ) => {
    try {
      return await callLearningEngine('generate-exam-feedback', {
        subject_id: subjectId,
        exam_data: examData,
        language,
      });
    } catch (error) {
      console.error('Failed to generate exam feedback:', error);
      return null;
    }
  }, []);

  const getLearningPath = useCallback(async (subjectId: string) => {
    try {
      setIsLoading(true);
      const result = await callLearningEngine('get-learning-path', { subject_id: subjectId });
      setLearningPath(result);
      return result;
    } catch (error) {
      console.error('Failed to get learning path:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getLearningDNA = useCallback(async () => {
    try {
      const result = await callLearningEngine('get-learning-dna', {});
      setLearningDNA(result);
      return result;
    } catch (error) {
      console.error('Failed to get learning DNA:', error);
      return null;
    }
  }, []);

  return {
    profile,
    conceptMap,
    learningPath,
    learningDNA,
    prepContent,
    isLoading,
    isPrepLoading,
    getStudentProfile,
    logPerformance,
    buildKnowledgeGraph,
    verifyAnswer,
    storeMemory,
    getConceptMap,
    getLearningPath,
    getLearningDNA,
    generatePrepContent,
    getWeakConcepts,
    generateExamQuestions,
    generateExamFeedback,
    runIntelligenceCycle,
  };
}

