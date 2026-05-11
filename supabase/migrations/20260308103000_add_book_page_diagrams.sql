-- Persistent diagram memory extracted from uploaded textbook pages
CREATE TABLE IF NOT EXISTS public.book_page_diagrams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_id UUID NOT NULL REFERENCES public.book_pages(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL,
  chapter_id UUID NULL REFERENCES public.syllabus_library(id) ON DELETE SET NULL,
  chapter_name TEXT NULL,
  page_number INTEGER NULL,
  diagram_index INTEGER NOT NULL DEFAULT 0,
  title TEXT NULL,
  diagram_type TEXT NULL,
  caption TEXT NULL,
  labels TEXT[] DEFAULT '{}',
  extracted_text TEXT NULL,
  summary TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (page_id, diagram_index)
);

ALTER TABLE public.book_page_diagrams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own book page diagrams" ON public.book_page_diagrams;
CREATE POLICY "Users can view own book page diagrams"
ON public.book_page_diagrams FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own book page diagrams" ON public.book_page_diagrams;
CREATE POLICY "Users can create own book page diagrams"
ON public.book_page_diagrams FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own book page diagrams" ON public.book_page_diagrams;
CREATE POLICY "Users can update own book page diagrams"
ON public.book_page_diagrams FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own book page diagrams" ON public.book_page_diagrams;
CREATE POLICY "Users can delete own book page diagrams"
ON public.book_page_diagrams FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_book_page_diagrams_user_subject_page
  ON public.book_page_diagrams(user_id, subject_id, page_number);

CREATE INDEX IF NOT EXISTS idx_book_page_diagrams_page_id
  ON public.book_page_diagrams(page_id);

CREATE INDEX IF NOT EXISTS idx_book_page_diagrams_text_search
  ON public.book_page_diagrams
  USING gin(to_tsvector('simple', coalesce(summary, '') || ' ' || coalesce(extracted_text, '')));

DROP TRIGGER IF EXISTS update_book_page_diagrams_updated_at ON public.book_page_diagrams;
CREATE TRIGGER update_book_page_diagrams_updated_at
BEFORE UPDATE ON public.book_page_diagrams
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
