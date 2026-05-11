import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Users, BookOpen, Activity } from 'lucide-react';

export function TeacherDashboardTab() {
  const [stats, setStats] = useState({
    totalClasses: 0,
    totalStudents: 0,
    activeHomeworks: 0,
    studyMinutes30d: 0,
    avgMasteryAcrossStudents: null as number | null,
    avgExamPct30d: null as number | null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase.from('teacher_profiles').select('id').eq('user_id', user.id).single();
        if (!profile) return;

        const { count: classCount } = await supabase.from('teacher_classes').select('*', { count: 'exact', head: true }).eq('teacher_profile_id', profile.id);
        const { count: studentCount } = await supabase.from('student_teacher_links').select('*', { count: 'exact', head: true }).eq('teacher_id', profile.id);

        const { data: kpiRows } = await supabase
          .from('teacher_student_kpis')
          .select('study_minutes_30d, avg_chapter_mastery, avg_exam_score_pct_30d')
          .eq('teacher_user_id', user.id);

        let studyMinutes30d = 0;
        const masteries: number[] = [];
        const examPcts: number[] = [];
        for (const row of kpiRows || []) {
          studyMinutes30d += Number(row.study_minutes_30d) || 0;
          if (row.avg_chapter_mastery != null) masteries.push(Number(row.avg_chapter_mastery));
          if (row.avg_exam_score_pct_30d != null) examPcts.push(Number(row.avg_exam_score_pct_30d));
        }
        const avgMasteryAcrossStudents = masteries.length
          ? Math.round(masteries.reduce((a, b) => a + b, 0) / masteries.length)
          : null;
        const avgExamPct30d = examPcts.length
          ? Math.round(examPcts.reduce((a, b) => a + b, 0) / examPcts.length)
          : null;

        setStats({
          totalClasses: classCount || 0,
          totalStudents: studentCount || 0,
          activeHomeworks: 0,
          studyMinutes30d,
          avgMasteryAcrossStudents,
          avgExamPct30d,
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-24 bg-muted animate-pulse rounded-2xl"></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-24 bg-muted animate-pulse rounded-2xl"></div>
          <div className="h-24 bg-muted animate-pulse rounded-2xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1 mb-6">
        <h2 className="text-2xl font-bold tracking-tight">Overview</h2>
        <p className="text-muted-foreground text-sm">Your teaching statistics</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="rounded-2xl border-primary/20">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Total Students</p>
            <h3 className="text-3xl font-bold">{stats.totalStudents}</h3>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-primary/20">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-orange-500" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Classes</p>
            <h3 className="text-3xl font-bold">{stats.totalClasses}</h3>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Activity className="w-6 h-6 text-primary" />
            <h3 className="text-lg font-semibold">Class Performance (30 days)</h3>
          </div>
          {stats.totalStudents > 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                SQL-backed KPIs from linked students: study time, average chapter mastery, and recent exam performance.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div className="rounded-xl bg-background/60 border border-border/50 p-3">
                  <p className="text-muted-foreground text-xs">Study minutes</p>
                  <p className="text-xl font-bold">{stats.studyMinutes30d}</p>
                </div>
                <div className="rounded-xl bg-background/60 border border-border/50 p-3">
                  <p className="text-muted-foreground text-xs">Avg chapter mastery</p>
                  <p className="text-xl font-bold">
                    {stats.avgMasteryAcrossStudents != null ? `${stats.avgMasteryAcrossStudents}%` : '—'}
                  </p>
                </div>
                <div className="rounded-xl bg-background/60 border border-border/50 p-3">
                  <p className="text-muted-foreground text-xs">Avg exam score (30d)</p>
                  <p className="text-xl font-bold">
                    {stats.avgExamPct30d != null ? `${stats.avgExamPct30d}%` : '—'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">No students linked yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Share your Teacher ID with students so they can link to your class.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
