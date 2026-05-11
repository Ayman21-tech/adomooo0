
-- Allow students to search teacher profiles by name/school/gender for linking
CREATE POLICY "Anyone authenticated can search teacher profiles" ON public.teacher_profiles FOR SELECT TO authenticated USING (true);

-- Allow students to read profiles of other students in their teacher's class (for teacher viewing)
CREATE POLICY "Teachers can view student profiles" ON public.profiles FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.teacher_profiles tp
    JOIN public.student_teacher_links stl ON stl.teacher_id = tp.id
    WHERE tp.user_id = auth.uid() AND stl.student_user_id = profiles.user_id
  )
);
