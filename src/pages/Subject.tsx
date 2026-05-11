import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, MessageCircle, Bookmark, Upload, FileText, Loader2, AlertTriangle, X, Gauge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { ThemeToggle } from '@/components/ThemeToggle';
import { getSubjectById, getCategoryBySubjectId } from '@/data/subjects';
import { AIChatPanel } from '@/components/subject/AIChatPanel';
import { LessonList } from '@/components/subject/LessonList';
import { StudyStreakCard } from '@/components/subject/StudyStreakCard';
import { BookmarksPanel } from '@/components/subject/BookmarksPanel';
import { useStudyStreak } from '@/hooks/useStudyStreak';
import { useSyllabus } from '@/hooks/useSyllabus';
import { useLearningEngine } from '@/hooks/useLearningEngine';
import { supabase } from '@/integrations/supabase/client';

export default function Subject() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState('lessons');
  const { recordStudySession } = useStudyStreak();
  const { getSyllabusStatus, loading: syllabusLoading, getChaptersBySubject, getBookPagesBySubject } = useSyllabus();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [weaknessAlertDismissed, setWeaknessAlertDismissed] = useState(false);
  const { getWeakConcepts, getStudentProfile, storeMemory, profile } = useLearningEngine();
  const [criticalWeakConcepts, setCriticalWeakConcepts] = useState<any[]>([]);
  const [difficultyOverride, setDifficultyOverride] = useState<number | null>(null);
  const subject = id ? getSubjectById(id) : undefined;
  const category = id ? getCategoryBySubjectId(id) : undefined;
  const syllabusStatus = id ? getSyllabusStatus(id) : { uploaded: false, chapterCount: 0 };
  const subjectChapters = useMemo(() => (id ? getChaptersBySubject(id) : []), [id, getChaptersBySubject]);
  const subjectPages = useMemo(() => (id ? getBookPagesBySubject(id) : []), [id, getBookPagesBySubject]);
  const selectedLesson = subjectChapters.find((c) => c.id === selectedLessonId);

  // Check if any page has completed OCR
  const completedOCRPages = subjectPages.filter(p => p.ocr_status === 'completed');
  const pendingOCRPages = subjectPages.filter(p => p.ocr_status === 'pending' || p.ocr_status === 'processing');
  const hasCompletedOCR = completedOCRPages.length > 0;
  const hasUploadedPages = subjectPages.length > 0;

  useEffect(() => {
    // Check session and listen for auth changes
    const checkAuth = (session: any) => {
      setIsAuthenticated(!!session);
      if (session && id) {
        getStudentProfile(id).catch(() => {});
        getWeakConcepts(id).then(weak => {
          const critical = weak.filter(w => w.weakness_level === 'critical' || w.weakness_level === 'weak');
          setCriticalWeakConcepts(critical);
        }).catch(() => {});
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => checkAuth(session));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      checkAuth(session);
    });

    recordStudySession();
    return () => { subscription.unsubscribe(); };
  }, [recordStudySession, id, getWeakConcepts]);

  if (!subject) {
    return (
      <div className="min-h-screen bg-background bg-mesh flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Subject not found</p>
          <Button onClick={() => navigate('/home')} className="rounded-xl">Go Home</Button>
        </div>
      </div>
    );
  }

  // Gate: require uploaded book pages with completed OCR
  const showSyllabusGate = !syllabusLoading && (!hasUploadedPages || !hasCompletedOCR);

  return (
    <div className="min-h-screen bg-background bg-mesh noise">
      {/* Floating orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 -right-20 w-60 h-60 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-40 -left-20 w-80 h-80 rounded-full bg-gradient-to-br from-primary/5 to-purple-500/10 blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 glass-card border-b border-border/30">
        <div className="container flex items-center justify-between h-16 px-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/home')}
            className="rounded-xl hover:bg-primary/10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <h1 className="font-semibold text-sm truncate max-w-[200px]">{subject.name}</h1>
            <p className="text-xs text-muted-foreground">{category?.name}</p>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 container px-4 py-6 pb-24 page-enter">
        {/* Subject Header Card */}
        <div className="relative overflow-hidden rounded-3xl p-6 mb-6 bg-card/50 backdrop-blur-sm border border-border/30">
          <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl -mr-20 -mt-20" />
          <div className="relative flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-4xl">
              {category?.icon || '📖'}
            </div>
            <div>
              <h2 className="text-xl font-bold">{subject.name}</h2>
              <p className="text-sm text-muted-foreground">{category?.name}</p>
              {hasCompletedOCR && (
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-primary">
                    {completedOCRPages.length} pages ready • {syllabusStatus.chapterCount} chapters
                  </p>
                  {profile && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Badge 
                          variant="outline" 
                          className="text-[10px] cursor-pointer border-primary/30 hover:bg-primary/10 transition-colors gap-1"
                        >
                          <Gauge className="w-3 h-3" />
                          {difficultyOverride !== null
                            ? (difficultyOverride <= 0.7 ? 'Easy' : difficultyOverride >= 1.2 ? 'Hard' : 'Medium')
                            : (profile.recommended_difficulty_label === 'easy' ? 'Easy'
                              : profile.recommended_difficulty_label === 'hard' ? 'Hard' : 'Medium')}
                        </Badge>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-4" side="bottom" align="start">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold">Difficulty Level</p>
                            <Badge variant="secondary" className="text-xs">
                              {difficultyOverride !== null
                                ? (difficultyOverride <= 0.7 ? 'Easy' : difficultyOverride >= 1.2 ? 'Hard' : 'Medium')
                                : (profile.recommended_difficulty_label || 'Medium')}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            AI auto-calibrates, but you can override it.
                          </p>
                          <Slider
                            value={[difficultyOverride ?? profile.recommended_difficulty ?? 1.0]}
                            min={0.5}
                            max={1.5}
                            step={0.1}
                            onValueChange={([v]) => {
                              setDifficultyOverride(v);
                              if (id) {
                                storeMemory('long_term', 'difficulty_override', { level: v }, id);
                              }
                            }}
                          />
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>Easy</span>
                            <span>Medium</span>
                            <span>Hard</span>
                          </div>
                          {difficultyOverride !== null && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="w-full text-xs"
                              onClick={() => {
                                setDifficultyOverride(null);
                                if (id) {
                                  storeMemory('long_term', 'difficulty_override', { level: null }, id);
                                }
                              }}
                            >
                              Reset to AI auto
                            </Button>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Weakness Alert Banner */}
        {!weaknessAlertDismissed && criticalWeakConcepts.length > 0 && !showSyllabusGate && (
          <div className="mb-6 p-4 rounded-2xl bg-destructive/10 border border-destructive/30 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-destructive">
                {criticalWeakConcepts.length} weak concept{criticalWeakConcepts.length > 1 ? 's' : ''} detected
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {criticalWeakConcepts.slice(0, 3).map(c => c.name).join(', ')}
                {criticalWeakConcepts.length > 3 ? ` +${criticalWeakConcepts.length - 3} more` : ''}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-primary gap-1 px-2 mt-1.5"
                onClick={() => {
                  setSelectedLessonId(null);
                  setActiveTab('chat');
                }}
              >
                Review with AI Tutor →
              </Button>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={() => setWeaknessAlertDismissed(true)}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}

        {/* Book Upload Gate */}
        {showSyllabusGate ? (
          <div className="bg-card/50 backdrop-blur-sm border-2 border-dashed border-primary/30 rounded-3xl p-8 text-center">
            <div className="w-20 h-20 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-6 glow-lg">
              {hasUploadedPages && pendingOCRPages.length > 0 ? (
                <Loader2 className="w-10 h-10 text-primary-foreground animate-spin" />
              ) : (
                <FileText className="w-10 h-10 text-primary-foreground" />
              )}
            </div>
            <h3 className="text-xl font-bold mb-2">
              {hasUploadedPages && pendingOCRPages.length > 0
                ? 'Processing Your Book Pages...'
                : 'Upload Your Book Pages First'}
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto leading-relaxed">
              {hasUploadedPages && pendingOCRPages.length > 0
                ? `${pendingOCRPages.length} page(s) are being processed. Please wait a moment and refresh.`
                : `To start learning ${subject.name}, upload photos of your textbook pages. The AI will read and learn from your exact book.`}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button 
                onClick={() => navigate('/home?tab=syllabus')}
                className="rounded-2xl gap-2 btn-premium text-primary-foreground press"
              >
                <Upload className="w-4 h-4" />
                {hasUploadedPages ? 'Upload More Pages' : 'Upload Book Pages'}
              </Button>
              <Button 
                variant="outline"
                onClick={() => navigate('/home')}
                className="rounded-2xl"
              >
                Go Back
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Study Streak */}
            {isAuthenticated && (
              <div className="mb-6">
                <StudyStreakCard />
              </div>
            )}

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6 h-auto p-1.5 bg-muted/30 backdrop-blur-sm rounded-2xl border border-border/30">
                <TabsTrigger 
                  value="lessons" 
                  className="flex flex-col gap-1 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-xl transition-all"
                >
                  <BookOpen className="w-4 h-4" />
                  <span className="text-xs">Lessons</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="chat" 
                  className="flex flex-col gap-1 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-xl transition-all"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span className="text-xs">AI Tutor</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="notes" 
                  className="flex flex-col gap-1 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-xl transition-all"
                >
                  <Bookmark className="w-4 h-4" />
                  <span className="text-xs">Notes</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="lessons" className="mt-0">
                <LessonList 
                  subjectId={subject.id} 
                  subjectName={subject.name}
                  onSelectLesson={(lessonId) => {
                    setSelectedLessonId(lessonId);
                    setActiveTab('chat');
                  }}
                />
              </TabsContent>

              <TabsContent value="chat" className="mt-0">
                {isAuthenticated ? (
                  <AIChatPanel 
                    subjectName={subject.name}
                    subjectId={subject.id}
                    lessonContext={`This student is studying ${subject.name} in the ${category?.name} category.${selectedLesson ? ` Focus chapter: ${selectedLesson.chapter_name}.` : ''}`}
                  />
                ) : (
                  <div className="bg-card/50 backdrop-blur-sm border border-border/30 rounded-2xl p-8 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <MessageCircle className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">Sign in to Chat with AI Tutor</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Create an account to unlock personalized AI tutoring for {subject.name}
                    </p>
                    <Button onClick={() => navigate('/signin')} className="rounded-2xl btn-premium text-primary-foreground press">
                      Sign In
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="notes" className="mt-0">
                {isAuthenticated ? (
                  <BookmarksPanel 
                    subjectId={subject.id}
                    subjectName={subject.name}
                  />
                ) : (
                  <div className="bg-card/50 backdrop-blur-sm border border-border/30 rounded-2xl p-8 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <Bookmark className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">Sign in to Save Notes</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Create an account to save bookmarks and notes for {subject.name}
                    </p>
                    <Button onClick={() => navigate('/signin')} className="rounded-2xl btn-premium text-primary-foreground press">
                      Sign In
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
}
