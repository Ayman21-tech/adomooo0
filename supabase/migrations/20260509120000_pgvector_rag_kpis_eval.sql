-- pgvector + book chunk RAG, teacher KPI view, golden eval catalog (no secrets)

CREATE EXTENSION IF NOT EXISTS vector;

-- Chunked book text with embeddings (Google text-embedding-004 → 768 dims)
CREATE TABLE IF NOT EXISTS public.book_page_chunks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  book_page_id UUID NOT NULL REFERENCES public.book_pages (id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL,
  chapter_name TEXT,
  page_number INTEGER,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding vector(768) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (book_page_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_book_page_chunks_user_subject ON public.book_page_chunks (user_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_book_page_chunks_page ON public.book_page_chunks (book_page_id);

-- HNSW index for cosine similarity search
CREATE INDEX IF NOT EXISTS idx_book_page_chunks_embedding_hnsw
  ON public.book_page_chunks
  USING hnsw (embedding vector_cosine_ops);

ALTER TABLE public.book_page_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own book chunks"
  ON public.book_page_chunks FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own book chunks"
  ON public.book_page_chunks FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Semantic search: only current user's chunks for the subject (text param for PostgREST → vector cast)
CREATE OR REPLACE FUNCTION public.match_book_chunks (
  query_embedding text,
  match_count integer,
  filter_subject_id text
)
RETURNS TABLE (
  id uuid,
  book_page_id uuid,
  chunk_index integer,
  content text,
  chapter_name text,
  page_number integer,
  similarity double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.book_page_id,
    c.chunk_index,
    c.content,
    c.chapter_name,
    c.page_number,
    (1 - (c.embedding <=> (query_embedding::vector(768))))::double precision AS similarity
  FROM public.book_page_chunks c
  WHERE c.user_id = auth.uid()
    AND c.subject_id = filter_subject_id
  ORDER BY c.embedding <=> (query_embedding::vector(768))
  LIMIT LEAST(COALESCE(match_count, 8), 24);
$$;

REVOKE ALL ON FUNCTION public.match_book_chunks (text, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_book_chunks (text, integer, text) TO authenticated;

-- Teachers can read linked students' concept mastery (for KPIs / dashboards)
DROP POLICY IF EXISTS "Users can view own mastery" ON public.concept_mastery;
DROP POLICY IF EXISTS "Users can create own mastery" ON public.concept_mastery;
DROP POLICY IF EXISTS "Users can update own mastery" ON public.concept_mastery;

CREATE POLICY "Users and teachers can view concept mastery rows"
  ON public.concept_mastery FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.teacher_profiles tp
      JOIN public.student_teacher_links stl ON stl.teacher_id = tp.id
      WHERE tp.user_id = auth.uid()
        AND stl.student_user_id = concept_mastery.user_id
    )
  );

CREATE POLICY "Users insert own concept mastery"
  ON public.concept_mastery FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own concept mastery"
  ON public.concept_mastery FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Golden-set catalog for offline / manual LLM+RAG evaluation (seed via SQL or service role)
CREATE TABLE IF NOT EXISTS public.golden_eval_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_id TEXT,
  question TEXT NOT NULL,
  reference_snippet TEXT,
  expected_page_numbers INTEGER[] DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.golden_eval_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read golden eval items"
  ON public.golden_eval_items FOR SELECT TO authenticated
  USING (true);

-- Per-session RAG quality (optional telemetry; students write own rows)
CREATE TABLE IF NOT EXISTS public.tutor_rag_traces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL,
  user_query_preview TEXT,
  vector_chunks_used INTEGER NOT NULL DEFAULT 0,
  lexical_pages_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tutor_rag_traces_user_created ON public.tutor_rag_traces (user_id, created_at DESC);

ALTER TABLE public.tutor_rag_traces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own rag traces"
  ON public.tutor_rag_traces FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users select own rag traces"
  ON public.tutor_rag_traces FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Teacher-facing KPIs: one row per linked student (30-day window aggregates)
CREATE OR REPLACE VIEW public.teacher_student_kpis
WITH (security_invoker = true) AS
SELECT
  tp.id AS teacher_profile_id,
  tp.user_id AS teacher_user_id,
  stl.student_user_id,
  COUNT(DISTINCT la.id) FILTER (
    WHERE la.created_at >= (now() - interval '30 days')
  )::bigint AS activities_30d,
  COALESCE(
    SUM(la.duration_minutes) FILTER (
      WHERE la.created_at >= (now() - interval '30 days')
    ),
    0
  )::bigint AS study_minutes_30d,
  MAX(la.created_at) FILTER (
    WHERE la.created_at >= (now() - interval '30 days')
  ) AS last_activity_at,
  (
    SELECT ROUND(AVG(sm.mastery_score)::numeric)
    FROM public.subject_mastery sm
    WHERE sm.user_id = stl.student_user_id
      AND sm.mastery_score IS NOT NULL
  ) AS avg_chapter_mastery,
  (
    SELECT COUNT(*)::bigint
    FROM public.exam_results er
    WHERE er.user_id = stl.student_user_id
      AND er.created_at >= (now() - interval '30 days')
  ) AS exams_30d,
  (
    SELECT ROUND(AVG(
      (er.correct_answers::numeric / NULLIF(er.total_questions, 0)) * 100
    )::numeric)
    FROM public.exam_results er
    WHERE er.user_id = stl.student_user_id
      AND er.created_at >= (now() - interval '30 days')
      AND er.total_questions > 0
  ) AS avg_exam_score_pct_30d
FROM public.teacher_profiles tp
JOIN public.student_teacher_links stl ON stl.teacher_id = tp.id
LEFT JOIN public.learning_activity la ON la.user_id = stl.student_user_id
GROUP BY tp.id, tp.user_id, stl.student_user_id;

GRANT SELECT ON public.teacher_student_kpis TO authenticated;
