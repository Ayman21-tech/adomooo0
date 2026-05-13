
-- Add user_role to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_role text NOT NULL DEFAULT 'student';

-- Teacher profiles
CREATE TABLE public.teacher_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  school_name text NOT NULL DEFAULT '',
  gender text NOT NULL DEFAULT '',
  teacher_id_display text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE public.teacher_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own teacher profile" ON public.teacher_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own teacher profile" ON public.teacher_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own teacher profile" ON public.teacher_profiles FOR UPDATE USING (auth.uid() = user_id);

-- Teacher classes
CREATE TABLE public.teacher_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teacher_profiles(id) ON DELETE CASCADE,
  class_level text NOT NULL,
  section_name text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.teacher_classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers can view own classes" ON public.teacher_classes FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.teacher_profiles WHERE id = teacher_id AND user_id = auth.uid())
);
CREATE POLICY "Teachers can insert own classes" ON public.teacher_classes FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.teacher_profiles WHERE id = teacher_id AND user_id = auth.uid())
);
CREATE POLICY "Teachers can update own classes" ON public.teacher_classes FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.teacher_profiles WHERE id = teacher_id AND user_id = auth.uid())
);
CREATE POLICY "Teachers can delete own classes" ON public.teacher_classes FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.teacher_profiles WHERE id = teacher_id AND user_id = auth.uid())
);

-- Teacher subjects
CREATE TABLE public.teacher_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teacher_profiles(id) ON DELETE CASCADE,
  subject_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.teacher_subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers can view own subjects" ON public.teacher_subjects FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.teacher_profiles WHERE id = teacher_id AND user_id = auth.uid())
);
CREATE POLICY "Teachers can insert own subjects" ON public.teacher_subjects FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.teacher_profiles WHERE id = teacher_id AND user_id = auth.uid())
);
CREATE POLICY "Teachers can delete own subjects" ON public.teacher_subjects FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.teacher_profiles WHERE id = teacher_id AND user_id = auth.uid())
);

-- Student-teacher links
CREATE TABLE public.student_teacher_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.teacher_profiles(id) ON DELETE CASCADE,
  linked_subjects text[] DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_user_id, teacher_id)
);
ALTER TABLE public.student_teacher_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students can view own links" ON public.student_teacher_links FOR SELECT USING (auth.uid() = student_user_id);
CREATE POLICY "Students can insert own links" ON public.student_teacher_links FOR INSERT WITH CHECK (auth.uid() = student_user_id);
CREATE POLICY "Students can delete own links" ON public.student_teacher_links FOR DELETE USING (auth.uid() = student_user_id);
CREATE POLICY "Teachers can view their student links" ON public.student_teacher_links FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.teacher_profiles WHERE id = teacher_id AND user_id = auth.uid())
);

-- Homework assignments
CREATE TABLE public.homework_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teacher_profiles(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.teacher_classes(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'homework',
  title text NOT NULL DEFAULT '',
  content text DEFAULT '',
  image_urls jsonb DEFAULT '[]'::jsonb,
  subject_id text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.homework_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers can manage own homework" ON public.homework_assignments FOR ALL USING (
  EXISTS (SELECT 1 FROM public.teacher_profiles WHERE id = teacher_id AND user_id = auth.uid())
);
CREATE POLICY "Students can view homework from linked teachers" ON public.homework_assignments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.student_teacher_links WHERE teacher_id = homework_assignments.teacher_id AND student_user_id = auth.uid())
);

-- Teacher-student messages
CREATE TABLE public.teacher_student_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text DEFAULT '',
  message_type text NOT NULL DEFAULT 'text',
  media_url text DEFAULT NULL,
  read_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.teacher_student_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own messages" ON public.teacher_student_messages FOR SELECT USING (
  auth.uid() = sender_user_id OR auth.uid() = receiver_user_id
);
CREATE POLICY "Users can send messages" ON public.teacher_student_messages FOR INSERT WITH CHECK (auth.uid() = sender_user_id);
CREATE POLICY "Users can update own received messages" ON public.teacher_student_messages FOR UPDATE USING (auth.uid() = receiver_user_id);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.teacher_student_messages;

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('homework-attachments', 'homework-attachments', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-media', 'chat-media', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('copy-checker', 'copy-checker', true) ON CONFLICT (id) DO NOTHING;

-- Storage RLS
CREATE POLICY "Authenticated users can upload homework attachments" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'homework-attachments');
CREATE POLICY "Anyone can view homework attachments" ON storage.objects FOR SELECT USING (bucket_id = 'homework-attachments');
CREATE POLICY "Authenticated users can upload chat media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'chat-media');
CREATE POLICY "Authenticated users can view chat media" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'chat-media');
CREATE POLICY "Authenticated users can upload copy checker files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'copy-checker');
CREATE POLICY "Authenticated users can view copy checker files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'copy-checker');
