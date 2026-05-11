-- Drop old restrictive policies that only allow own-user access
DROP POLICY IF EXISTS "Users can view own mastery" ON public.subject_mastery;
DROP POLICY IF EXISTS "Users can view own activity" ON public.learning_activity;
DROP POLICY IF EXISTS "Users can view own exam results" ON public.exam_results;

-- Teachers can view linked student mastery data (also allows own access)
CREATE POLICY "Users and teachers can view mastery"
ON public.subject_mastery FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM teacher_profiles tp
    JOIN student_teacher_links stl ON stl.teacher_id = tp.id
    WHERE tp.user_id = auth.uid() AND stl.student_user_id = subject_mastery.user_id
  )
);

-- Teachers can view linked student activity (also allows own access)
CREATE POLICY "Users and teachers can view activity"
ON public.learning_activity FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM teacher_profiles tp
    JOIN student_teacher_links stl ON stl.teacher_id = tp.id
    WHERE tp.user_id = auth.uid() AND stl.student_user_id = learning_activity.user_id
  )
);

-- Teachers can view linked student exam results (also allows own access)
CREATE POLICY "Users and teachers can view exams"
ON public.exam_results FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM teacher_profiles tp
    JOIN student_teacher_links stl ON stl.teacher_id = tp.id
    WHERE tp.user_id = auth.uid() AND stl.student_user_id = exam_results.user_id
  )
);