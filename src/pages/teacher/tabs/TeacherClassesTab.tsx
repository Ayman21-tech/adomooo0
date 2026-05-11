import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Users, ChevronRight, ArrowLeft, BrainCircuit, TrendingUp, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StudentProfile {
  user_id: string;
  name: string;
  class_level: string;
  school_name: string;
  email: string;
}

interface StudentStats {
  masteredCount: number;
  weakConcepts: Array<{ name: string; mastery: number }>;
  bestSubject: string;
  avgMastery: number;
}

export function TeacherClassesTab() {
  const [view, setView] = useState<'list' | 'student'>('list');
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);
  const [studentStats, setStudentStats] = useState<StudentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from('teacher_profiles').select('id').eq('user_id', user.id).single();
      if (!profile) return;

      const { data: links } = await supabase.from('student_teacher_links').select('student_user_id').eq('teacher_id', profile.id);
      if (!links || links.length === 0) {
        setStudents([]);
        return;
      }

      const studentIds = links.map(l => l.student_user_id);
      const { data: profiles } = await supabase.from('profiles').select('*').in('user_id', studentIds);
      
      setStudents(profiles || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentStats = async (userId: string) => {
    setStatsLoading(true);
    try {
      const { data: mastery } = await supabase
        .from('concept_mastery')
        .select('*, concept:concept_graph(concept_name, subject_id)')
        .eq('user_id', userId);

      if (!mastery) {
        setStudentStats({ masteredCount: 0, weakConcepts: [], bestSubject: 'N/A', avgMastery: 0 });
        return;
      }

      let totalScore = 0;
      let mastered = 0;
      const weak: any[] = [];
      const subjectScores: Record<string, { total: number; count: number }> = {};

      mastery.forEach((m: any) => {
        totalScore += m.mastery_score;
        if (m.mastery_score >= 80) mastered++;
        if (m.is_weak || m.mastery_score < 40) {
          weak.push({ name: m.concept?.concept_name || 'Unknown', mastery: m.mastery_score });
        }

        const sub = m.concept?.subject_id || 'general';
        if (!subjectScores[sub]) subjectScores[sub] = { total: 0, count: 0 };
        subjectScores[sub].total += m.mastery_score;
        subjectScores[sub].count++;
      });

      let bestSub = 'N/A';
      let bestAvg = -1;
      for (const sub in subjectScores) {
        const avg = subjectScores[sub].total / subjectScores[sub].count;
        if (avg > bestAvg) {
          bestAvg = avg;
          bestSub = sub;
        }
      }

      weak.sort((a, b) => a.mastery - b.mastery);

      setStudentStats({
        masteredCount: mastered,
        weakConcepts: weak.slice(0, 5),
        bestSubject: bestSub,
        avgMastery: mastery.length > 0 ? Math.round(totalScore / mastery.length) : 0,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setStatsLoading(false);
    }
  };

  const openStudent = (student: StudentProfile) => {
    setSelectedStudent(student);
    setView('student');
    fetchStudentStats(student.user_id);
  };

  if (loading) {
    return <div className="animate-pulse space-y-4"><div className="h-20 bg-muted rounded-2xl"></div></div>;
  }

  if (view === 'student' && selectedStudent) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" className="gap-2 rounded-xl" onClick={() => setView('list')}>
          <ArrowLeft className="w-4 h-4" /> Back to Students
        </Button>
        
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full gradient-primary flex items-center justify-center text-xl font-bold text-primary-foreground">
            {selectedStudent.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold">{selectedStudent.name}</h2>
            <p className="text-sm text-muted-foreground">{selectedStudent.class_level} | {selectedStudent.school_name}</p>
          </div>
        </div>

        {statsLoading || !studentStats ? (
          <div className="animate-pulse space-y-4">
            <div className="h-24 bg-muted rounded-2xl"></div>
            <div className="h-40 bg-muted rounded-2xl"></div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Card className="rounded-2xl border-primary/20 bg-primary/5">
                <CardContent className="p-4 flex flex-col items-center justify-center text-center space-y-1">
                  <TrendingUp className="w-5 h-5 text-primary mb-1" />
                  <p className="text-xs font-medium text-muted-foreground">Avg Mastery</p>
                  <h3 className="text-2xl font-bold">{studentStats.avgMastery}%</h3>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border-primary/20 bg-primary/5">
                <CardContent className="p-4 flex flex-col items-center justify-center text-center space-y-1">
                  <BrainCircuit className="w-5 h-5 text-primary mb-1" />
                  <p className="text-xs font-medium text-muted-foreground">Best Subject</p>
                  <h3 className="text-lg font-bold uppercase truncate w-full px-2">{studentStats.bestSubject}</h3>
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-2xl border-destructive/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                  <h3 className="font-semibold text-destructive">Critical Weaknesses</h3>
                </div>
                {studentStats.weakConcepts.length > 0 ? (
                  <div className="space-y-3">
                    {studentStats.weakConcepts.map((w, i) => (
                      <div key={i} className="flex justify-between items-center bg-destructive/5 p-3 rounded-xl border border-destructive/10">
                        <span className="text-sm font-medium">{w.name}</span>
                        <span className="text-xs font-bold text-destructive">{w.mastery}%</span>
                      </div>
                    ))}
                    <div className="mt-4 p-3 bg-muted/50 rounded-xl">
                      <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">AI Recommendation</p>
                      <p className="text-sm">Assign extra practice on these foundational concepts. When communicating, use simpler visual examples rather than complex formulas.</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No critical weaknesses detected! Student is performing well.</p>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardContent className="p-4 flex justify-between items-center">
                <span className="text-sm font-medium">Concepts Mastered</span>
                <span className="font-bold text-primary">{studentStats.masteredCount}</span>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    );
  }

  // Group students by class
  const groupedStudents: Record<string, StudentProfile[]> = {};
  students.forEach(s => {
    const cls = s.class_level || 'Unknown Class';
    if (!groupedStudents[cls]) groupedStudents[cls] = [];
    groupedStudents[cls].push(s);
  });

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1 mb-6">
        <h2 className="text-2xl font-bold tracking-tight">My Classes</h2>
        <p className="text-muted-foreground text-sm">Select a student to view performance</p>
      </div>

      {students.length === 0 ? (
        <Card className="border-dashed rounded-2xl">
          <CardContent className="p-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Users className="w-7 h-7 text-primary" />
            </div>
            <p className="text-sm font-medium">No students linked</p>
            <p className="text-xs text-muted-foreground">Share your Teacher ID with students so they can join your classes.</p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(groupedStudents).map(([cls, group]) => (
          <div key={cls} className="space-y-3">
            <h3 className="font-semibold text-lg px-1">{cls}</h3>
            {group.map(student => (
              <Card key={student.user_id} className="rounded-2xl cursor-pointer hover:border-primary/40 transition-all press" onClick={() => openStudent(student)}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-sm font-bold text-primary-foreground">
                    {student.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{student.name}</p>
                    <p className="text-xs text-muted-foreground">{student.school_name || 'No school'}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </CardContent>
              </Card>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
