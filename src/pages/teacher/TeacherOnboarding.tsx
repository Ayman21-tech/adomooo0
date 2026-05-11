import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GraduationCap, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { categories, classLevels, getAllSubjects } from '@/data/subjects';
import { cn } from '@/lib/utils';

// Per-class subject mapping: { "Grade 5": ["mathematics", "english"], "Grade 8": ["physics", "chemistry"] }
type ClassSubjectMap = Record<string, string[]>;

export default function TeacherOnboarding() {
  const navigate = useNavigate();
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  // Step 1: Basic info
  const [name, setName] = useState(user.name || '');
  const [school, setSchool] = useState('');
  const [gender, setGender] = useState('');

  // Step 2: Select grades
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);

  // Step 3: Per-grade subject selection
  const [classSubjects, setClassSubjects] = useState<ClassSubjectMap>({});
  const [currentGradeIndex, setCurrentGradeIndex] = useState(0);

  const allSubjects = getAllSubjects();

  const toggleGrade = (grade: string) => {
    if (selectedGrades.includes(grade)) {
      setSelectedGrades(selectedGrades.filter(g => g !== grade));
      // Also remove subjects for this grade
      const updated = { ...classSubjects };
      delete updated[grade];
      setClassSubjects(updated);
    } else {
      setSelectedGrades([...selectedGrades, grade]);
    }
  };

  const toggleSubjectForGrade = (grade: string, subjectId: string) => {
    const current = classSubjects[grade] || [];
    if (current.includes(subjectId)) {
      setClassSubjects({ ...classSubjects, [grade]: current.filter(s => s !== subjectId) });
    } else {
      setClassSubjects({ ...classSubjects, [grade]: [...current, subjectId] });
    }
  };

  const handleSubmit = async () => {
    // Validate all grades have at least one subject
    for (const grade of selectedGrades) {
      if (!classSubjects[grade] || classSubjects[grade].length === 0) {
        toast({ title: 'Missing subjects', description: `Please select at least one subject for ${grade}.`, variant: 'destructive' });
        return;
      }
    }

    setLoading(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('Not authenticated');

      // Collect all unique subjects
      const allTeacherSubjects = [...new Set(Object.values(classSubjects).flat())];

      // Build the formatted ID string
      const classLines = selectedGrades.map(g => {
        const subNames = (classSubjects[g] || []).map(sid => {
          const sub = allSubjects.find(s => s.id === sid);
          return sub?.name || sid;
        });
        return `  ${g}: ${subNames.join(', ')}`;
      }).join('\n');

      const teacherIdDisplay = `Name: ${name}\nSchool: ${school}\nClasses:\n${classLines}\nGender: ${gender}`;

      // Insert teacher profile
      const { data: profileData, error: profileError } = await supabase
        .from('teacher_profiles')
        .insert({
          user_id: authUser.id,
          name,
          school_name: school,
          gender,
          teacher_id_display: teacherIdDisplay,
        })
        .select()
        .single();

      if (profileError) throw profileError;

      // Insert subjects into teacher_subjects table
      if (allTeacherSubjects.length > 0) {
        const subjectInserts = allTeacherSubjects.map(sid => ({ teacher_id: profileData.id, subject_id: sid }));
        await supabase.from('teacher_subjects').insert(subjectInserts);
      }

      // Insert class entries (one row per grade)
      const classInserts = selectedGrades.map(grade => ({
        teacher_id: profileData.id,
        class_level: grade,
        section_name: (classSubjects[grade] || []).join(','),
      }));

      const { error: classError } = await supabase.from('teacher_classes').insert(classInserts);
      if (classError) throw classError;

      // Update basic profile
      await supabase.from('profiles').update({ name, user_role: 'teacher' }).eq('user_id', authUser.id);

      toast({ title: 'Profile Created!', description: 'Welcome to Teacher Mode.' });
      navigate('/teacher/dashboard', { replace: true });
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Error', description: err.message || 'Failed to create profile', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const currentGrade = selectedGrades[currentGradeIndex];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-start p-4 pt-10">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Teacher Setup</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {step === 1 && 'Your basic information'}
            {step === 2 && 'Which grades do you teach?'}
            {step === 3 && `Select subjects for ${currentGrade}`}
          </p>
        </div>

        {/* Progress */}
        <div className="flex gap-1.5 px-4">
          {[1, 2, 3].map(s => (
            <div key={s} className={cn('h-1.5 flex-1 rounded-full transition-all', s <= step ? 'gradient-primary' : 'bg-muted')} />
          ))}
        </div>

        {/* Step 1: Name / School / Gender */}
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Mr. Rahman" className="rounded-xl h-12 input-premium" />
            </div>
            <div className="space-y-2">
              <Label>School Name</Label>
              <Input value={school} onChange={e => setSchool(e.target.value)} placeholder="e.g. Dhaka Residential Model College" className="rounded-xl h-12 input-premium" />
            </div>
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger className="rounded-xl h-12"><SelectValue placeholder="Select gender" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold mt-4" onClick={() => {
              if (!name.trim() || !school.trim() || !gender) {
                toast({ title: 'Incomplete', description: 'Please fill all fields.', variant: 'destructive' });
                return;
              }
              setStep(2);
            }}>
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}

        {/* Step 2: Select Grades */}
        {step === 2 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
            <p className="text-xs text-muted-foreground">Tap all the classes/grades you teach in.</p>
            <div className="grid grid-cols-2 gap-2 max-h-[350px] overflow-y-auto p-1">
              {classLevels.map(grade => {
                const isSelected = selectedGrades.includes(grade);
                return (
                  <button
                    key={grade}
                    type="button"
                    onClick={() => toggleGrade(grade)}
                    className={cn(
                      'p-3 rounded-xl border text-left flex items-center justify-between gap-2 transition-all text-sm font-medium',
                      isSelected ? 'bg-primary/10 border-primary text-primary' : 'bg-card hover:bg-muted'
                    )}
                  >
                    {grade}
                    {isSelected && <Check className="w-4 h-4 shrink-0" />}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2 mt-4">
              <Button variant="outline" className="w-1/3 rounded-xl" onClick={() => setStep(1)}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button className="w-2/3 rounded-xl gradient-primary text-primary-foreground font-semibold" onClick={() => {
                if (selectedGrades.length === 0) {
                  toast({ title: 'Select at least one', description: 'Choose the grades you teach.', variant: 'destructive' });
                  return;
                }
                setCurrentGradeIndex(0);
                setStep(3);
              }}>
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Per-grade subject selection */}
        {step === 3 && currentGrade && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Grade {currentGradeIndex + 1} of {selectedGrades.length}
              </span>
              <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {currentGrade}
              </span>
            </div>

            <p className="text-xs text-muted-foreground">Which subjects do you teach in <span className="font-semibold text-foreground">{currentGrade}</span>?</p>

            <div className="space-y-3 max-h-[320px] overflow-y-auto p-1">
              {categories.map(cat => {
                const catSubjects = cat.subjects;
                const anySelected = catSubjects.some(s => (classSubjects[currentGrade] || []).includes(s.id));
                return (
                  <div key={cat.id}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <span>{cat.icon}</span> {cat.name}
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {catSubjects.map(sub => {
                        const isActive = (classSubjects[currentGrade] || []).includes(sub.id);
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => toggleSubjectForGrade(currentGrade, sub.id)}
                            className={cn(
                              'px-3 py-2 rounded-lg border text-xs font-medium text-left transition-all',
                              isActive ? 'bg-primary/10 border-primary text-primary' : 'bg-card hover:bg-muted'
                            )}
                          >
                            {sub.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2 mt-4">
              <Button variant="outline" className="w-1/3 rounded-xl" onClick={() => {
                if (currentGradeIndex > 0) {
                  setCurrentGradeIndex(currentGradeIndex - 1);
                } else {
                  setStep(2);
                }
              }}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </Button>

              {currentGradeIndex < selectedGrades.length - 1 ? (
                <Button className="w-2/3 rounded-xl gradient-primary text-primary-foreground font-semibold" onClick={() => {
                  if (!classSubjects[currentGrade] || classSubjects[currentGrade].length === 0) {
                    toast({ title: 'Select subjects', description: `Pick at least one subject for ${currentGrade}.`, variant: 'destructive' });
                    return;
                  }
                  setCurrentGradeIndex(currentGradeIndex + 1);
                }}>
                  Next Grade <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button className="w-2/3 rounded-xl gradient-primary text-primary-foreground font-semibold" onClick={() => {
                  if (!classSubjects[currentGrade] || classSubjects[currentGrade].length === 0) {
                    toast({ title: 'Select subjects', description: `Pick at least one subject for ${currentGrade}.`, variant: 'destructive' });
                    return;
                  }
                  handleSubmit();
                }} disabled={loading}>
                  {loading ? 'Creating Profile...' : 'Finish Setup'}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
