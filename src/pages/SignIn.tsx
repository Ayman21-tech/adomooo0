import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Sparkles, LogIn, UserPlus, GraduationCap, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { categories, classLevels, getAllSubjects } from '@/data/subjects';
import { cn } from '@/lib/utils';
import adomoLogo from '@/assets/protibha-logo.png';

type ClassSubjectMap = Record<string, string[]>;

export default function SignIn() {
  const navigate = useNavigate();
  const { updateUser, loading: contextLoading } = useUser();

  const [isSignUp, setIsSignUp] = useState(false);
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});

  // Teacher-specific state
  const [teacherStep, setTeacherStep] = useState(0); // 0=account, 1=info, 2=grades, 3=subjects
  const [schoolName, setSchoolName] = useState('');
  const [gender, setGender] = useState('');
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [classSubjects, setClassSubjects] = useState<ClassSubjectMap>({});
  const [currentGradeIdx, setCurrentGradeIdx] = useState(0);

  const allSubjects = getAllSubjects();

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await checkProfileAndRedirect(session.user.id);
        }
      } catch (err) {
        console.error('Auth init error:', err);
      } finally {
        setBootLoading(false);
      }
    };

    if (!contextLoading) {
      initAuth();
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        checkProfileAndRedirect(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [contextLoading]);

  const checkProfileAndRedirect = async (userId: string) => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      let { data: profile } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();

      if (!profile && authUser) {
        const { data: created } = await supabase.from('profiles').insert({
          user_id: userId, email: authUser.email || '',
          name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || '',
          role: authUser.user_metadata?.role || 'student',
        }).select().maybeSingle();
        profile = created;
      }

      if (!profile) { navigate('/onboarding/class', { replace: true }); return; }

      // Determine role: check profile.user_role first, then auth metadata as fallback
      const userRole = profile.user_role || profile.role || authUser?.user_metadata?.role || 'student';

      if (userRole === 'teacher') {
        try {
          const { data: tp } = await supabase.from('teacher_profiles').select('id').eq('user_id', userId).maybeSingle();
          updateUser({ role: 'teacher', name: profile.name, email: profile.email });
          navigate(tp ? '/teacher/dashboard' : '/teacher/onboarding', { replace: true });
        } catch {
          // teacher_profiles table might not exist yet — send to onboarding
          updateUser({ role: 'teacher', name: profile.name, email: profile.email });
          navigate('/teacher/onboarding', { replace: true });
        }
        return;
      }

      if (profile.class_level && profile.school_name && profile.selected_subjects?.length > 0) {
        updateUser({ name: profile.name, email: profile.email, class_level: profile.class_level, school_name: profile.school_name, selected_subjects: profile.selected_subjects, preferred_language: (profile as any).preferred_language || 'en', onboarding_step: 'complete' });
        navigate('/home', { replace: true });
      } else {
        updateUser({ name: profile.name, email: profile.email, class_level: profile.class_level || '', school_name: profile.school_name || '', selected_subjects: profile.selected_subjects || [], onboarding_step: profile.class_level ? (profile.school_name ? 4 : 3) : 2 });
        navigate('/onboarding/class', { replace: true });
      }
    } catch (err) {
      console.error('checkProfileAndRedirect error:', err);
      // Check auth metadata as last resort
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser?.user_metadata?.role === 'teacher') {
          updateUser({ role: 'teacher', name: authUser.user_metadata?.full_name || '', email: authUser.email || '' });
          navigate('/teacher/onboarding', { replace: true });
          return;
        }
      } catch {}
      navigate('/onboarding/class', { replace: true });
    }
  };

  const validateEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  // Student sign-up or sign-in submit
  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { name?: string; email?: string; password?: string } = {};
    if (isSignUp && !name.trim()) newErrors.name = 'Please enter your name';
    if (!email.trim()) newErrors.email = 'Please enter your email';
    else if (!validateEmail(email)) newErrors.email = 'Please enter a valid email';
    if (!password.trim()) newErrors.password = 'Please enter your password';
    else if (isSignUp && password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    setLoading(true); setErrors({});
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim(), role: 'student' } } });
        if (error) throw error;
        if (data.user && !data.session) { toast({ title: 'Account created', description: 'Please sign in.' }); setIsSignUp(false); return; }
        if (data.user && data.session) { updateUser({ name: name.trim(), email: email.trim(), role: 'student' }); await checkProfileAndRedirect(data.user.id); }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        if (data.user) await checkProfileAndRedirect(data.user.id);
      }
    } catch (error: any) {
      toast({ title: isSignUp ? 'Sign-up failed' : 'Sign-in failed', description: error.message || 'Authentication failed.', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  // Teacher sign-up: step 0 = account info, then steps 1-3 collect teacher data, final step creates everything
  const handleTeacherAccountStep = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) { toast({ title: 'Fill all fields', variant: 'destructive' }); return; }
    if (!validateEmail(email)) { toast({ title: 'Invalid email', variant: 'destructive' }); return; }
    if (password.length < 6) { toast({ title: 'Password too short', description: '6+ characters required.', variant: 'destructive' }); return; }
    setTeacherStep(1);
  };

  const handleTeacherFinish = async () => {
    for (const g of selectedGrades) {
      if (!classSubjects[g] || classSubjects[g].length === 0) {
        toast({ title: 'Missing subjects', description: `Select at least one subject for ${g}.`, variant: 'destructive' }); return;
      }
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim(), role: 'teacher' } } });
      if (error) throw error;
      if (!data.user) throw new Error('Account creation failed');

      // Create profile row
      await supabase.from('profiles').upsert({ user_id: data.user.id, email: email.trim(), name: name.trim(), user_role: 'teacher' }, { onConflict: 'user_id' });

      const allTeacherSubjects = [...new Set(Object.values(classSubjects).flat())];
      const classLines = selectedGrades.map(g => {
        const subNames = (classSubjects[g] || []).map(sid => allSubjects.find(s => s.id === sid)?.name || sid);
        return `  ${g}: ${subNames.join(', ')}`;
      }).join('\n');
      const teacherIdDisplay = `Name: ${name}\nSchool: ${schoolName}\nClasses:\n${classLines}\nGender: ${gender}`;

      const { data: tp, error: tpErr } = await supabase.from('teacher_profiles').insert({
        user_id: data.user.id, name, school_name: schoolName, gender, teacher_id_display: teacherIdDisplay,
      }).select().single();
      if (tpErr) throw tpErr;

      // Insert subjects into teacher_subjects table
      if (allTeacherSubjects.length > 0) {
        const subjectInserts = allTeacherSubjects.map(sid => ({ teacher_id: tp.id, subject_id: sid }));
        await supabase.from('teacher_subjects').insert(subjectInserts);
      }

      // Insert classes
      const classInserts = selectedGrades.map(g => ({ teacher_id: tp.id, class_level: g, section_name: (classSubjects[g] || []).join(',') }));
      await supabase.from('teacher_classes').insert(classInserts);

      updateUser({ name: name.trim(), email: email.trim(), role: 'teacher' });
      toast({ title: 'Welcome, Teacher!', description: 'Your profile has been created.' });
      navigate('/teacher/dashboard', { replace: true });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const toggleGrade = (g: string) => {
    if (selectedGrades.includes(g)) { setSelectedGrades(selectedGrades.filter(x => x !== g)); const u = { ...classSubjects }; delete u[g]; setClassSubjects(u); }
    else setSelectedGrades([...selectedGrades, g]);
  };

  const toggleSubjectForGrade = (grade: string, sid: string) => {
    const cur = classSubjects[grade] || [];
    setClassSubjects({ ...classSubjects, [grade]: cur.includes(sid) ? cur.filter(s => s !== sid) : [...cur, sid] });
  };

  const isValid = email.trim() && password.trim() && (!isSignUp || name.trim());

  if (bootLoading || contextLoading) {
    return (<div className="min-h-screen bg-background flex items-center justify-center"><div className="flex flex-col items-center gap-3"><img src={adomoLogo} alt="Adomo AI" className="w-16 h-16 object-contain animate-pulse" /><p className="text-sm text-muted-foreground">Loading…</p></div></div>);
  }

  // ---- TEACHER SIGN-UP MULTI-STEP ----
  if (isSignUp && role === 'teacher' && teacherStep > 0) {
    const currentGrade = selectedGrades[currentGradeIdx];
    return (
      <div className="min-h-screen bg-background bg-pattern noise flex flex-col">
        <div className="flex items-center justify-center pt-8 pb-2">
          <div className="flex flex-col items-center gap-2">
            <GraduationCap className="w-10 h-10 text-primary" />
            <h1 className="text-lg font-bold gradient-text">Teacher Sign Up</h1>
          </div>
        </div>
        <div className="flex-1 flex items-start justify-center px-4 pt-4 pb-8">
          <div className="w-full max-w-md space-y-5">
            {/* Progress */}
            <div className="flex gap-1.5">
              {[1, 2, 3].map(s => <div key={s} className={cn('h-1.5 flex-1 rounded-full transition-all', s <= teacherStep ? 'gradient-primary' : 'bg-muted')} />)}
            </div>

            {/* Step 1: School & Gender */}
            {teacherStep === 1 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                <h2 className="text-xl font-bold">School & Gender</h2>
                <div className="space-y-2"><Label>School Name</Label><Input value={schoolName} onChange={e => setSchoolName(e.target.value)} placeholder="e.g. Dhaka Residential Model College" className="rounded-xl h-12 input-premium" /></div>
                <div className="space-y-2"><Label>Gender</Label>
                  <Select value={gender} onValueChange={setGender}><SelectTrigger className="rounded-xl h-12"><SelectValue placeholder="Select gender" /></SelectTrigger><SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent></Select>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" className="w-1/3 rounded-xl" onClick={() => setTeacherStep(0)}><ChevronLeft className="w-4 h-4 mr-1" /> Back</Button>
                  <Button className="w-2/3 rounded-xl gradient-primary text-primary-foreground font-semibold" onClick={() => {
                    if (!schoolName.trim() || !gender) { toast({ title: 'Fill all fields', variant: 'destructive' }); return; }
                    setTeacherStep(2);
                  }}>Next <ChevronRight className="w-4 h-4 ml-1" /></Button>
                </div>
              </div>
            )}

            {/* Step 2: Select Grades */}
            {teacherStep === 2 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                <h2 className="text-xl font-bold">Which grades do you teach?</h2>
                <div className="grid grid-cols-2 gap-2 max-h-[320px] overflow-y-auto p-1">
                  {classLevels.map(g => (
                    <button key={g} type="button" onClick={() => toggleGrade(g)}
                      className={cn('p-3 rounded-xl border text-sm font-medium text-left flex items-center justify-between transition-all', selectedGrades.includes(g) ? 'bg-primary/10 border-primary text-primary' : 'bg-card hover:bg-muted')}>
                      {g} {selectedGrades.includes(g) && <Check className="w-4 h-4" />}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" className="w-1/3 rounded-xl" onClick={() => setTeacherStep(1)}><ChevronLeft className="w-4 h-4 mr-1" /> Back</Button>
                  <Button className="w-2/3 rounded-xl gradient-primary text-primary-foreground font-semibold" onClick={() => {
                    if (selectedGrades.length === 0) { toast({ title: 'Select at least one grade', variant: 'destructive' }); return; }
                    setCurrentGradeIdx(0); setTeacherStep(3);
                  }}>Next <ChevronRight className="w-4 h-4 ml-1" /></Button>
                </div>
              </div>
            )}

            {/* Step 3: Per-grade subjects */}
            {teacherStep === 3 && currentGrade && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold">Subjects for {currentGrade}</h2>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{currentGradeIdx + 1}/{selectedGrades.length}</span>
                </div>
                <div className="space-y-3 max-h-[300px] overflow-y-auto p-1">
                  {categories.map(cat => (
                    <div key={cat.id}>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{cat.icon} {cat.name}</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {cat.subjects.map(sub => {
                          const active = (classSubjects[currentGrade] || []).includes(sub.id);
                          return (<button key={sub.id} type="button" onClick={() => toggleSubjectForGrade(currentGrade, sub.id)}
                            className={cn('px-3 py-2 rounded-lg border text-xs font-medium text-left transition-all', active ? 'bg-primary/10 border-primary text-primary' : 'bg-card hover:bg-muted')}>{sub.name}</button>);
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" className="w-1/3 rounded-xl" onClick={() => { if (currentGradeIdx > 0) setCurrentGradeIdx(currentGradeIdx - 1); else setTeacherStep(2); }}><ChevronLeft className="w-4 h-4 mr-1" /> Back</Button>
                  {currentGradeIdx < selectedGrades.length - 1 ? (
                    <Button className="w-2/3 rounded-xl gradient-primary text-primary-foreground font-semibold" onClick={() => {
                      if (!classSubjects[currentGrade]?.length) { toast({ title: 'Select subjects', variant: 'destructive' }); return; }
                      setCurrentGradeIdx(currentGradeIdx + 1);
                    }}>Next Grade <ChevronRight className="w-4 h-4 ml-1" /></Button>
                  ) : (
                    <Button className="w-2/3 rounded-xl gradient-primary text-primary-foreground font-semibold" onClick={() => {
                      if (!classSubjects[currentGrade]?.length) { toast({ title: 'Select subjects', variant: 'destructive' }); return; }
                      handleTeacherFinish();
                    }} disabled={loading}>{loading ? 'Creating...' : 'Finish & Create Account'}</Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---- DEFAULT: Student sign-up / sign-in / Teacher step 0 (account) ----
  return (
    <div className="min-h-screen bg-background bg-pattern noise flex flex-col">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-12 -left-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-12 -right-24 h-72 w-72 rounded-full bg-purple-500/10 blur-3xl" />
      </div>

      <div className="flex items-center justify-center pt-8 pb-2">
        <div className="flex flex-col items-center gap-3">
          <img src={adomoLogo} alt="Adomo AI" className="w-16 h-16 object-contain drop-shadow-lg" />
          <h1 className="text-xl font-bold gradient-text">Adomo AI</h1>
        </div>
      </div>
      <div className="relative z-10 flex-1 flex items-start justify-center px-4 pt-4 pb-8">
        <div className="w-full max-w-md space-y-5">
          <div className="glass-card rounded-3xl border border-border/60 p-5 sm:p-6 shadow-xl">
          <div className="text-center space-y-1.5">
            <h2 className="text-2xl font-bold">{isSignUp ? 'Create Account' : 'Welcome Back'}</h2>
            <p className="text-sm text-muted-foreground">{isSignUp ? 'Start your journey' : 'Sign in to continue'}</p>
          </div>

          {isSignUp && (
            <div className="mt-4 flex bg-muted/50 p-1 rounded-2xl w-full max-w-[240px] mx-auto">
              <button type="button" onClick={() => { setRole('student'); setTeacherStep(0); }}
                className={cn('flex-1 py-2 text-sm font-medium rounded-xl transition-all', role === 'student' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground')}>Student</button>
              <button type="button" onClick={() => { setRole('teacher'); setTeacherStep(0); }}
                className={cn('flex-1 py-2 text-sm font-medium rounded-xl transition-all', role === 'teacher' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground')}>Teacher</button>
            </div>
          )}

          <form onSubmit={role === 'student' || !isSignUp ? handleStudentSubmit : (e) => { e.preventDefault(); handleTeacherAccountStep(); }} className="mt-5 space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium text-muted-foreground">{role === 'teacher' ? 'Teacher Name' : 'Full Name'}</Label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    {role === 'teacher' ? <GraduationCap className="h-4 w-4 text-primary" /> : <UserPlus className="h-4 w-4 text-primary" />}
                  </div>
                  <Input id="name" type="text" placeholder={role === 'teacher' ? 'e.g. Mr. Rahman' : 'Your full name'} value={name}
                    onChange={(e) => { setName(e.target.value); if (errors.name) setErrors(prev => ({ ...prev, name: undefined })); }}
                    className="pl-14 h-14 rounded-2xl input-premium text-base" disabled={loading} />
                </div>
                {errors.name && <p className="text-sm text-destructive pl-1">{errors.name}</p>}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-muted-foreground">Email Address</Label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center"><Mail className="h-4 w-4 text-primary" /></div>
                <Input id="email" type="email" placeholder="your.email@example.com" value={email}
                  onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors(prev => ({ ...prev, email: undefined })); }}
                  className="pl-14 h-14 rounded-2xl input-premium text-base" disabled={loading} autoComplete="email" />
              </div>
              {errors.email && <p className="text-sm text-destructive pl-1">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-muted-foreground">Password</Label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center"><Lock className="h-4 w-4 text-primary" /></div>
                <Input id="password" type={showPassword ? 'text' : 'password'} placeholder={isSignUp ? 'Create a password (6+ chars)' : 'Enter your password'} value={password}
                  onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors(prev => ({ ...prev, password: undefined })); }}
                  className="pl-14 pr-14 h-14 rounded-2xl input-premium text-base" disabled={loading} autoComplete={isSignUp ? 'new-password' : 'current-password'} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors">
                  {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </button>
              </div>
              {errors.password && <p className="text-sm text-destructive pl-1">{errors.password}</p>}
            </div>

            <Button type="submit" size="lg" disabled={!isValid || loading} className="w-full h-14 text-lg font-semibold rounded-2xl btn-premium text-primary-foreground">
              <span className="relative z-10 flex items-center justify-center gap-2">
                {loading ? 'Processing...' : (isSignUp ? (role === 'teacher' ? 'Next: School & Classes' : 'Create Account') : 'Sign In')}
                {!loading && (isSignUp ? (role === 'teacher' ? <ChevronRight className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />) : <LogIn className="w-4 h-4" />)}
                {!loading && role === 'student' && <Sparkles className="w-4 h-4" />}
              </span>
            </Button>
          </form>

          <div className="text-center pt-2">
            <p className="text-sm text-muted-foreground">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}
              <button type="button" onClick={() => { setIsSignUp(!isSignUp); setErrors({}); setTeacherStep(0); setRole('student'); }} className="ml-1.5 text-primary font-semibold hover:underline">
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </button>
            </p>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 rounded-2xl bg-muted/30 p-2 text-center">
            <div className="rounded-xl bg-background/70 px-2 py-2">
              <p className="text-[11px] text-muted-foreground">Study Mode</p>
              <p className="text-xs font-semibold">Adaptive AI</p>
            </div>
            <div className="rounded-xl bg-background/70 px-2 py-2">
              <p className="text-[11px] text-muted-foreground">Language</p>
              <p className="text-xs font-semibold">Bangla + English</p>
            </div>
            <div className="rounded-xl bg-background/70 px-2 py-2">
              <p className="text-[11px] text-muted-foreground">Support</p>
              <p className="text-xs font-semibold">24/7</p>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
