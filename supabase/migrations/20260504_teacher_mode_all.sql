-- =============================================
-- TEACHER MODE: Run this in Supabase SQL Editor
-- =============================================

-- 1. Add role column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'student';

-- 2. Teacher profiles table
CREATE TABLE IF NOT EXISTS public.teacher_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    teacher_id_display TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    school_name TEXT NOT NULL,
    gender TEXT NOT NULL DEFAULT '',
    subjects_taught TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.teacher_profiles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='teacher_profiles' AND policyname='Teacher profiles are viewable by everyone') THEN
    CREATE POLICY "Teacher profiles are viewable by everyone" ON public.teacher_profiles FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='teacher_profiles' AND policyname='Users can create their own teacher profile') THEN
    CREATE POLICY "Users can create their own teacher profile" ON public.teacher_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='teacher_profiles' AND policyname='Users can update their own teacher profile') THEN
    CREATE POLICY "Users can update their own teacher profile" ON public.teacher_profiles FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- 3. Teacher classes table
CREATE TABLE IF NOT EXISTS public.teacher_classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_profile_id UUID REFERENCES public.teacher_profiles(id) ON DELETE CASCADE NOT NULL,
    class_name TEXT NOT NULL,
    section_name TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.teacher_classes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='teacher_classes' AND policyname='Classes are viewable by everyone') THEN
    CREATE POLICY "Classes are viewable by everyone" ON public.teacher_classes FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='teacher_classes' AND policyname='Teachers can insert their classes') THEN
    CREATE POLICY "Teachers can insert their classes" ON public.teacher_classes FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.teacher_profiles WHERE id = teacher_profile_id AND user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='teacher_classes' AND policyname='Teachers can delete their classes') THEN
    CREATE POLICY "Teachers can delete their classes" ON public.teacher_classes FOR DELETE USING (
      EXISTS (SELECT 1 FROM public.teacher_profiles WHERE id = teacher_profile_id AND user_id = auth.uid())
    );
  END IF;
END $$;

-- 4. Student-teacher links
CREATE TABLE IF NOT EXISTS public.student_teacher_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    teacher_id UUID REFERENCES public.teacher_profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(student_user_id, teacher_id)
);

ALTER TABLE public.student_teacher_links ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='student_teacher_links' AND policyname='Users can see their own teacher links') THEN
    CREATE POLICY "Users can see their own teacher links" ON public.student_teacher_links FOR SELECT USING (
      auth.uid() = student_user_id OR EXISTS (SELECT 1 FROM public.teacher_profiles WHERE id = teacher_id AND user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='student_teacher_links' AND policyname='Students can link themselves to teachers') THEN
    CREATE POLICY "Students can link themselves to teachers" ON public.student_teacher_links FOR INSERT WITH CHECK (auth.uid() = student_user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='student_teacher_links' AND policyname='Students can delete their links') THEN
    CREATE POLICY "Students can delete their links" ON public.student_teacher_links FOR DELETE USING (auth.uid() = student_user_id);
  END IF;
END $$;

-- 5. Homework assignments
CREATE TABLE IF NOT EXISTS public.homework_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID REFERENCES public.teacher_profiles(id) ON DELETE CASCADE NOT NULL,
    class_name TEXT,
    title TEXT NOT NULL,
    content TEXT,
    type TEXT DEFAULT 'homework',
    subject_id TEXT,
    image_urls JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.homework_assignments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='homework_assignments' AND policyname='Everyone can view homework') THEN
    CREATE POLICY "Everyone can view homework" ON public.homework_assignments FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='homework_assignments' AND policyname='Teachers can insert homework') THEN
    CREATE POLICY "Teachers can insert homework" ON public.homework_assignments FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.teacher_profiles WHERE id = teacher_id AND user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='homework_assignments' AND policyname='Teachers can delete homework') THEN
    CREATE POLICY "Teachers can delete homework" ON public.homework_assignments FOR DELETE USING (
      EXISTS (SELECT 1 FROM public.teacher_profiles WHERE id = teacher_id AND user_id = auth.uid())
    );
  END IF;
END $$;

-- 6. Chat messages
CREATE TABLE IF NOT EXISTS public.teacher_student_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    receiver_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    content TEXT,
    message_type TEXT DEFAULT 'text',
    media_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.teacher_student_messages ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='teacher_student_messages' AND policyname='Users can view their own messages') THEN
    CREATE POLICY "Users can view their own messages" ON public.teacher_student_messages FOR SELECT USING (
      auth.uid() = sender_user_id OR auth.uid() = receiver_user_id
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='teacher_student_messages' AND policyname='Users can send messages') THEN
    CREATE POLICY "Users can send messages" ON public.teacher_student_messages FOR INSERT WITH CHECK (auth.uid() = sender_user_id);
  END IF;
END $$;

-- 7. Storage bucket for chat media
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-media', 'chat-media', true) ON CONFLICT (id) DO NOTHING;
