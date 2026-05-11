CREATE TABLE IF NOT EXISTS public.homework_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID REFERENCES public.teacher_profiles(id) ON DELETE CASCADE NOT NULL,
    class_name TEXT, -- Optional: if null, applies to all classes
    title TEXT NOT NULL,
    content TEXT,
    type TEXT DEFAULT 'homework', -- 'homework' or 'announcement'
    subject_id TEXT,
    image_urls JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.homework_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can view homework" ON public.homework_assignments FOR SELECT USING (true);
CREATE POLICY "Teachers can insert homework" ON public.homework_assignments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.teacher_profiles WHERE id = teacher_id AND user_id = auth.uid())
);
CREATE POLICY "Teachers can delete homework" ON public.homework_assignments FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.teacher_profiles WHERE id = teacher_id AND user_id = auth.uid())
);

CREATE TABLE IF NOT EXISTS public.teacher_student_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    receiver_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    content TEXT,
    message_type TEXT DEFAULT 'text', -- 'text', 'image', 'voice'
    media_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.teacher_student_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own messages" ON public.teacher_student_messages FOR SELECT USING (
  auth.uid() = sender_user_id OR auth.uid() = receiver_user_id
);
CREATE POLICY "Users can send messages" ON public.teacher_student_messages FOR INSERT WITH CHECK (
  auth.uid() = sender_user_id
);

-- Ensure chat-media storage bucket exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'chat-media');
CREATE POLICY "Authenticated users can upload media" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'chat-media' AND auth.role() = 'authenticated'
);

