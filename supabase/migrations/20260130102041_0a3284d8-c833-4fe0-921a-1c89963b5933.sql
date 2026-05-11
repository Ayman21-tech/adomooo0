-- Syllabus library table (persists until class promotion)
CREATE TABLE public.syllabus_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  class_level TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  chapter_order INTEGER NOT NULL DEFAULT 0,
  chapter_name TEXT NOT NULL,
  topics TEXT[] DEFAULT '{}',
  is_archived BOOLEAN DEFAULT false,
  upload_type TEXT DEFAULT 'manual', -- 'image', 'text', 'manual'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Book pages library table
CREATE TABLE public.book_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  class_level TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  chapter_id UUID REFERENCES public.syllabus_library(id) ON DELETE SET NULL,
  chapter_name TEXT, -- fallback if chapter_id is null
  page_number INTEGER,
  image_url TEXT NOT NULL,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Learning activity log
CREATE TABLE public.learning_activity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subject_id TEXT NOT NULL,
  chapter_id UUID REFERENCES public.syllabus_library(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL, -- 'study_session', 'notes_generated', 'practice_completed', 'exam_attempt', 'revision'
  duration_minutes INTEGER DEFAULT 0,
  score INTEGER, -- for practice/exam
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Subject mastery scores
CREATE TABLE public.subject_mastery (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subject_id TEXT NOT NULL,
  chapter_id UUID REFERENCES public.syllabus_library(id) ON DELETE CASCADE,
  mastery_score INTEGER DEFAULT 0, -- 0-100
  weakness_tags TEXT[] DEFAULT '{}',
  last_activity_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, subject_id, chapter_id)
);

-- Exam results table
CREATE TABLE public.exam_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subject_id TEXT NOT NULL,
  chapter_id UUID REFERENCES public.syllabus_library(id) ON DELETE SET NULL,
  exam_type TEXT NOT NULL, -- 'practice', 'real', 'challenge', 'quick_boost'
  total_questions INTEGER NOT NULL,
  correct_answers INTEGER NOT NULL,
  time_taken_seconds INTEGER,
  mistakes JSONB DEFAULT '[]', -- array of mistake details
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add personality to profiles if not exists
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS personality TEXT DEFAULT 'friendly',
ADD COLUMN IF NOT EXISTS age INTEGER;

-- Enable RLS on all new tables
ALTER TABLE public.syllabus_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_mastery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;

-- Syllabus library policies
CREATE POLICY "Users can view own syllabus" ON public.syllabus_library FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own syllabus" ON public.syllabus_library FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own syllabus" ON public.syllabus_library FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own syllabus" ON public.syllabus_library FOR DELETE USING (auth.uid() = user_id);

-- Book pages policies
CREATE POLICY "Users can view own book pages" ON public.book_pages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own book pages" ON public.book_pages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own book pages" ON public.book_pages FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own book pages" ON public.book_pages FOR DELETE USING (auth.uid() = user_id);

-- Learning activity policies
CREATE POLICY "Users can view own activity" ON public.learning_activity FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own activity" ON public.learning_activity FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Subject mastery policies
CREATE POLICY "Users can view own mastery" ON public.subject_mastery FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own mastery" ON public.subject_mastery FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own mastery" ON public.subject_mastery FOR UPDATE USING (auth.uid() = user_id);

-- Exam results policies
CREATE POLICY "Users can view own exam results" ON public.exam_results FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own exam results" ON public.exam_results FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_syllabus_user_class ON public.syllabus_library(user_id, class_level);
CREATE INDEX idx_book_pages_user ON public.book_pages(user_id, class_level, subject_id);
CREATE INDEX idx_activity_user ON public.learning_activity(user_id, subject_id);
CREATE INDEX idx_mastery_user ON public.subject_mastery(user_id, subject_id);
CREATE INDEX idx_exam_results_user ON public.exam_results(user_id, subject_id);

-- Update timestamp trigger for syllabus_library
CREATE TRIGGER update_syllabus_updated_at
BEFORE UPDATE ON public.syllabus_library
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update timestamp trigger for subject_mastery
CREATE TRIGGER update_mastery_updated_at
BEFORE UPDATE ON public.subject_mastery
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for book pages
INSERT INTO storage.buckets (id, name, public) VALUES ('book-pages', 'book-pages', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for book-pages bucket
CREATE POLICY "Users can view own book page images" ON storage.objects FOR SELECT USING (bucket_id = 'book-pages' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can upload own book page images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'book-pages' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update own book page images" ON storage.objects FOR UPDATE USING (bucket_id = 'book-pages' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own book page images" ON storage.objects FOR DELETE USING (bucket_id = 'book-pages' AND auth.uid()::text = (storage.foldername(name))[1]);