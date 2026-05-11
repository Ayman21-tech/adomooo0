
-- ============================================
-- CONCEPT GRAPH: Knowledge graph for concepts & prerequisites
-- ============================================
CREATE TABLE public.concept_graph (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subject_id TEXT NOT NULL,
  concept_name TEXT NOT NULL,
  parent_concept_id UUID REFERENCES public.concept_graph(id) ON DELETE SET NULL,
  chapter_id UUID REFERENCES public.syllabus_library(id) ON DELETE SET NULL,
  difficulty_level INTEGER DEFAULT 5 CHECK (difficulty_level >= 1 AND difficulty_level <= 10),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.concept_graph ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own concepts" ON public.concept_graph FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own concepts" ON public.concept_graph FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own concepts" ON public.concept_graph FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own concepts" ON public.concept_graph FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_concept_graph_user_subject ON public.concept_graph(user_id, subject_id);
CREATE INDEX idx_concept_graph_parent ON public.concept_graph(parent_concept_id);
CREATE INDEX idx_concept_graph_chapter ON public.concept_graph(chapter_id);

-- ============================================
-- CONCEPT MASTERY: Per-concept mastery tracking
-- ============================================
CREATE TABLE public.concept_mastery (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  concept_id UUID NOT NULL REFERENCES public.concept_graph(id) ON DELETE CASCADE,
  mastery_score INTEGER DEFAULT 0 CHECK (mastery_score >= 0 AND mastery_score <= 100),
  attempts INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  streak INTEGER DEFAULT 0,
  last_scores JSONB DEFAULT '[]'::jsonb,
  difficulty_calibration FLOAT DEFAULT 1.0,
  is_weak BOOLEAN DEFAULT false,
  last_practiced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, concept_id)
);

ALTER TABLE public.concept_mastery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own mastery" ON public.concept_mastery FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own mastery" ON public.concept_mastery FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own mastery" ON public.concept_mastery FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX idx_concept_mastery_user ON public.concept_mastery(user_id);
CREATE INDEX idx_concept_mastery_concept ON public.concept_mastery(concept_id);
CREATE INDEX idx_concept_mastery_weak ON public.concept_mastery(user_id, is_weak) WHERE is_weak = true;

CREATE TRIGGER update_concept_mastery_updated_at
  BEFORE UPDATE ON public.concept_mastery
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- ADAPTIVE MEMORY: Short-term + long-term AI memory
-- ============================================
CREATE TABLE public.adaptive_memory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  memory_type TEXT NOT NULL DEFAULT 'short_term',
  subject_id TEXT,
  key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  relevance_score FLOAT DEFAULT 1.0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.adaptive_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own memory" ON public.adaptive_memory FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own memory" ON public.adaptive_memory FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own memory" ON public.adaptive_memory FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own memory" ON public.adaptive_memory FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_adaptive_memory_user_type ON public.adaptive_memory(user_id, memory_type);
CREATE INDEX idx_adaptive_memory_user_subject ON public.adaptive_memory(user_id, subject_id);
CREATE INDEX idx_adaptive_memory_expires ON public.adaptive_memory(expires_at) WHERE expires_at IS NOT NULL;

CREATE TRIGGER update_adaptive_memory_updated_at
  BEFORE UPDATE ON public.adaptive_memory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- AI VERIFICATION LOG: Self-verification of answers
-- ============================================
CREATE TABLE public.ai_verification_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  question TEXT NOT NULL,
  generated_answer TEXT NOT NULL,
  verification_result JSONB DEFAULT '{}'::jsonb,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_verification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own verifications" ON public.ai_verification_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own verifications" ON public.ai_verification_log FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_verification_user ON public.ai_verification_log(user_id);
