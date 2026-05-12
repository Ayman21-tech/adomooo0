ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'student';

CREATE TABLE IF NOT EXISTS public.teacher_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    teacher_id_display TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    school_name TEXT NOT NULL,
    gender TEXT NOT NULL,
    subjects_taught TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.teacher_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teacher profiles are viewable by everyone" ON public.teacher_profiles FOR SELECT USING (true);
CREATE POLICY "Users can create their own teacher profile" ON public.teacher_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own teacher profile" ON public.teacher_profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.teacher_classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_profile_id UUID REFERENCES public.teacher_profiles(id) ON DELETE CASCADE NOT NULL,
    class_name TEXT NOT NULL,
    section_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(teacher_profile_id, class_name, section_name)
);

ALTER TABLE public.teacher_classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Classes are viewable by everyone" ON public.teacher_classes FOR SELECT USING (true);
CREATE POLICY "Teachers can insert their classes" ON public.teacher_classes FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.teacher_profiles WHERE id = teacher_profile_id AND user_id = auth.uid())
);
CREATE POLICY "Teachers can update their classes" ON public.teacher_classes FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.teacher_profiles WHERE id = teacher_profile_id AND user_id = auth.uid())
);
CREATE POLICY "Teachers can delete their classes" ON public.teacher_classes FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.teacher_profiles WHERE id = teacher_profile_id AND user_id = auth.uid())
);

CREATE TABLE IF NOT EXISTS public.student_teacher_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    teacher_id UUID REFERENCES public.teacher_profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(student_user_id, teacher_id)
);

ALTER TABLE public.student_teacher_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see their own teacher links" ON public.student_teacher_links FOR SELECT USING (
  auth.uid() = student_user_id OR
  EXISTS (SELECT 1 FROM public.teacher_profiles WHERE id = teacher_id AND user_id = auth.uid())
);
CREATE POLICY "Students can link themselves to teachers" ON public.student_teacher_links FOR INSERT WITH CHECK (auth.uid() = student_user_id);
CREATE POLICY "Students can delete their links" ON public.student_teacher_links FOR DELETE USING (auth.uid() = student_user_id);

