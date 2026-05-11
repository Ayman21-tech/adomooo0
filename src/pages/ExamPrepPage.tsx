import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, RefreshCw, BookOpen, Loader2, AlertCircle, Copy, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSyllabus } from '@/hooks/useSyllabus';
import { useLearningEngine } from '@/hooks/useLearningEngine';
import { useExamResults } from '@/hooks/useExamResults';
import { useGamification } from '@/hooks/useGamification';
import { useUser } from '@/contexts/UserContext';
import { getSubjectById, getCategoryBySubjectId } from '@/data/subjects';
import { useState, useEffect, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { ExamSetup, type ExamConfig } from '@/components/exam/ExamSetup';
import { ExamSession, type ExamQuestion, type ExamResults as ExamResultsType } from '@/components/exam/ExamSession';
import { ExamResultsView } from '@/components/exam/ExamResults';

interface LocationState {
  subjectId: string;
  chapterId?: string;
  chapterName?: string;
}

const TOOL_CONFIG: Record<string, { title: string; emoji: string; description: string; supportsAI: boolean; isExamTool: boolean }> = {
  'notes':         { title: 'Study Notes',          emoji: '📖', description: 'AI-generated study notes from your book', supportsAI: true, isExamTool: false },
  'revise':        { title: 'Quick Revision',        emoji: '👁️', description: 'Key points + rapid quiz',               supportsAI: true, isExamTool: false },
  'visualize':     { title: 'Visualize',             emoji: '🧠', description: 'Concept diagrams and mind maps',        supportsAI: true, isExamTool: false },
  'fix-confusion': { title: 'Fix Confusion',         emoji: '💡', description: 'AI clarifies confusing concepts',       supportsAI: true, isExamTool: false },
  'abbreviations': { title: 'Abbreviations',         emoji: '📗', description: 'Terms, formulas, and full forms',       supportsAI: true, isExamTool: false },
  'practice-exam': { title: 'Practice Exam',         emoji: '🎓', description: 'Practice with hints and guidance',      supportsAI: false, isExamTool: true },
  'real-exam':     { title: 'Real Exam',             emoji: '⏱️', description: '40-minute timed exam simulation',       supportsAI: false, isExamTool: true },
  'question-lab':  { title: 'Question Lab',          emoji: '🔬', description: 'Generate custom questions',             supportsAI: false, isExamTool: true },
  'challenge':     { title: 'Daily Challenge',       emoji: '🏆', description: 'Daily XP challenge for streaks',        supportsAI: false, isExamTool: false },
  'think-train':   { title: 'Think Train',           emoji: '✨', description: 'Logic and reasoning exercises',         supportsAI: false, isExamTool: false },
  'progress':      { title: 'Detailed Progress',     emoji: '📈', description: 'Deep progress view for this subject',   supportsAI: false, isExamTool: false },
  'weakness-map':  { title: 'Weakness Map',          emoji: '🗺️', description: 'Identify weak topics',                 supportsAI: false, isExamTool: false },
  'timeline':      { title: 'Progress Timeline',     emoji: '📅', description: 'Your learning journey milestones',     supportsAI: false, isExamTool: false },
  'rank-predict':  { title: 'Rank Prediction',       emoji: '📊', description: 'Estimated performance ranking',         supportsAI: false, isExamTool: false },
  'report':        { title: 'Performance Report',    emoji: '📄', description: 'Exportable summary of progress',        supportsAI: false, isExamTool: false },
  'study-plan':    { title: 'Study Plan',            emoji: '📆', description: 'Personalized study schedule',           supportsAI: true, isExamTool: false },
  'discover':      { title: 'Discover Facts',        emoji: '💡', description: 'Fun syllabus-safe facts',               supportsAI: true, isExamTool: false },
  'quick-boost':   { title: 'Quick Boost',           emoji: '⚡', description: 'Speed revision drills',                 supportsAI: true, isExamTool: false },
  'ai-coach':      { title: 'AI Motivation Coach',   emoji: '❤️', description: 'Supportive encouragement',              supportsAI: true, isExamTool: false },
  'confidence':    { title: 'Build Confidence',      emoji: '😊', description: 'Small wins and easy challenges',        supportsAI: true, isExamTool: false },
};

const PREP_TOOL_IDS = new Set(['notes','revise','visualize','fix-confusion','abbreviations','study-plan','discover','quick-boost','ai-coach','confidence']);
const EXAM_TOOL_IDS = new Set(['practice-exam','real-exam','question-lab','challenge','think-train','progress','weakness-map','timeline','rank-predict','report']);

// ─── Copy Button ─────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button variant="ghost" size="sm" onClick={handleCopy} className="h-8 gap-1.5">
      {copied ? <CheckCheck className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied!' : 'Copy'}
    </Button>
  );
}

// ─── AI Content Panel ─────────────────────────────────────────────────────────
function AIContentPanel({
  content,
  isLoading,
  onRegenerate,
  prepType,
}: {
  content: string;
  isLoading: boolean;
  onRegenerate: () => void;
  prepType: string;
}) {
  const config = TOOL_CONFIG[prepType];

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center animate-pulse">
          <span className="text-2xl">{config?.emoji || '🤖'}</span>
        </div>
        <div className="text-center">
          <p className="font-semibold mb-1">Generating {config?.title}...</p>
          <p className="text-sm text-muted-foreground">Analyzing your book and learning profile</p>
        </div>
        <div className="flex gap-1">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-primary animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl gradient-primary flex items-center justify-center">
          <span className="text-3xl">{config?.emoji || '📖'}</span>
        </div>
        <h3 className="font-semibold mb-2">{config?.title}</h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">{config?.description}</p>
        <Button onClick={onRegenerate} className="btn-premium text-primary-foreground gap-2">
          <span>{config?.emoji}</span>
          Generate {config?.title}
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <Badge variant="secondary" className="text-xs">
          {config?.emoji} AI Generated
        </Badge>
        <div className="flex gap-2">
          <CopyButton text={content} />
          <Button variant="ghost" size="sm" onClick={onRegenerate} className="h-8 gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        </div>
      </div>
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
}

// ─── Exam Flow State ──────────────────────────────────────────────────────────
type ExamFlowState = 'setup' | 'loading' | 'session' | 'results';

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ExamPrepPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const state = location.state as LocationState | null;
  const { user } = useUser();
  const { awardXP } = useGamification();
  const prepType = location.pathname.split('/').pop() || '';
  const mode = location.pathname.startsWith('/prep/') ? 'prep' : 'exam';

  const { chapters } = useSyllabus();
  const { generatePrepContent, prepContent, isPrepLoading, generateExamQuestions, generateExamFeedback, logPerformance, runIntelligenceCycle } = useLearningEngine();
  const { saveResult } = useExamResults();

  const subjectId = state?.subjectId || searchParams.get('subject') || '';
  const initialChapterId = state?.chapterId || searchParams.get('chapter') || '';
  const [selectedChapterId, setSelectedChapterId] = useState(initialChapterId);
  const [hasGenerated, setHasGenerated] = useState(false);

  // Exam flow state
  const [examFlowState, setExamFlowState] = useState<ExamFlowState>('setup');
  const [examQuestions, setExamQuestions] = useState<ExamQuestion[]>([]);
  const [examConfig, setExamConfig] = useState<ExamConfig | null>(null);
  const [examResults, setExamResults] = useState<ExamResultsType | null>(null);
  const [aiFeedback, setAiFeedback] = useState('');
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);

  const config = TOOL_CONFIG[prepType];
  const subject = subjectId ? getSubjectById(subjectId) : null;
  const category = subjectId ? getCategoryBySubjectId(subjectId) : null;
  const subjectChapters = chapters.filter(c => c.subject_id === subjectId);
  const currentChapter = selectedChapterId ? subjectChapters.find(c => c.id === selectedChapterId) : null;
  const isExamTool = config?.isExamTool || false;

  // Auto-generate for AI-supported prep types
  const handleGenerate = useCallback(async () => {
    if (!subjectId || !config?.supportsAI) return;
    setHasGenerated(true);
    const result = await generatePrepContent(
      subjectId,
      selectedChapterId || null,
      prepType,
      user.default_language
    );
    if (result?.error === 'no_content') {
      toast({
        title: 'No book content found',
        description: 'Please upload book pages in the Books tab first.',
        variant: 'destructive',
      });
    } else if (result?.error) {
      toast({
        title: 'Generation failed',
        description: 'Please try again.',
        variant: 'destructive',
      });
    }
  }, [subjectId, selectedChapterId, prepType, user.default_language, generatePrepContent, config?.supportsAI]);

  // Auto-trigger generation when entering AI-supported page
  useEffect(() => {
    if (config?.supportsAI && subjectId && !hasGenerated) {
      handleGenerate();
    }
  }, [prepType, subjectId, selectedChapterId]);

  // Update URL when chapter changes
  useEffect(() => {
    if (subjectId) {
      const params = new URLSearchParams(searchParams);
      if (selectedChapterId) params.set('chapter', selectedChapterId);
      else params.delete('chapter');
      window.history.replaceState({}, '', `${location.pathname}?${params.toString()}`);
    }
  }, [selectedChapterId, subjectId]);

  const handleChapterChange = (chapterId: string) => {
    setSelectedChapterId(chapterId === '__all__' ? '' : chapterId);
    setHasGenerated(false);
  };

  const handleBackToHub = () => {
    navigate(`/home?tab=${mode === 'prep' ? 'prep' : 'exam'}&subject=${subjectId}${selectedChapterId ? `&chapter=${selectedChapterId}` : ''}`);
  };

  // ─── Exam Flow Handlers ─────────────────────────────────────────────────────
  const handleExamStart = async (config: ExamConfig) => {
    setExamConfig(config);
    setIsGeneratingQuestions(true);
    setExamFlowState('loading');

    const result = await generateExamQuestions(
      subjectId,
      selectedChapterId || null,
      config.examType,
      config.questionCount,
      user.default_language,
      config.questionTypes,
      config.questionTypeCounts,
    );

    setIsGeneratingQuestions(false);

    if (!result || result.error) {
      toast({
        title: result?.error === 'no_content' ? 'No book content found' : 'Question generation failed',
        description: result?.message || 'Please try again.',
        variant: 'destructive',
      });
      setExamFlowState('setup');
      return;
    }

    if (!result.questions || result.questions.length === 0) {
      toast({
        title: 'No questions generated',
        description: 'Try a different chapter or upload more book pages.',
        variant: 'destructive',
      });
      setExamFlowState('setup');
      return;
    }

    setExamQuestions(result.questions);
    setExamFlowState('session');
  };

  const handleExamFinish = async (results: ExamResultsType) => {
    setExamResults(results);
    setExamFlowState('results');

    // Award XP based on performance
    const xpToAward = results.correctAnswers * 10; // 10 XP per correct answer
    if (xpToAward > 0) {
      await awardXP(xpToAward, `Exam Completion: ${subject?.name || 'Subject'} (${results.examType})`);
    }

    // Save result to database
    await saveResult(
      subjectId,
      results.examType,
      results.totalQuestions,
      results.correctAnswers,
      results.timeTakenSeconds,
      selectedChapterId || undefined,
      results.mistakes
    );

    // Log concept mastery for each question topic
    if (results.questions && results.answers) {
      for (let i = 0; i < results.questions.length; i++) {
        const q = results.questions[i];
        const a = results.answers[i];
        if (q.topic && a) {
          // Score: 100 if correct, 0 if wrong
          const score = a.isCorrect ? 100 : 0;
          // Use topic as concept identifier - the backend will match to concept_graph
          logPerformance(q.topic, score, a.timeSpent).catch(() => {});
        }
      }
    }

    // Run intelligence cycle with exam summary
    runIntelligenceCycle(
      subjectId,
      `Completed ${results.examType} exam: ${results.correctAnswers}/${results.totalQuestions} correct`,
      `Exam results: ${Math.round((results.correctAnswers / results.totalQuestions) * 100)}% accuracy. Mistakes in: ${results.mistakes.map(m => m.topic).join(', ') || 'none'}`,
      results.timeTakenSeconds,
    ).catch(() => {});

    // Generate AI feedback
    setIsLoadingFeedback(true);
    const feedbackResult = await generateExamFeedback(
      subjectId,
      {
        totalQuestions: results.totalQuestions,
        correctAnswers: results.correctAnswers,
        timeTaken: results.timeTakenSeconds,
        mistakes: results.mistakes,
        examType: results.examType,
      },
      user.default_language
    );
    const adaptive = feedbackResult?.adaptive_summary;
    const adaptiveFocus = adaptive
      ? [
          '',
          '---',
          'Adaptive Focus',
          `- Recommended Difficulty: ${adaptive.recommended_label || 'medium'}`,
          `- Weak Concepts: ${(adaptive.weak_concepts || []).slice(0, 3).map((w: any) => w.name).join(', ') || 'N/A'}`,
          `- Priority Actions: ${(adaptive.next_best_actions || []).slice(0, 3).map((a: any) => a.target || a.type).join(', ') || 'N/A'}`,
        ].join('\n')
      : '';

    setAiFeedback((feedbackResult?.feedback || '') + (adaptiveFocus ? '\n\n' + adaptiveFocus : ''));
    setIsLoadingFeedback(false);
  };

  const handleExamRetry = () => {
    setExamResults(null);
    setAiFeedback('');
    setExamFlowState('setup');
  };

  const handleExamBack = () => {
    if (examFlowState === 'session') {
      // Confirm before leaving mid-exam
      if (window.confirm('Are you sure you want to leave? Your progress will be lost.')) {
        setExamFlowState('setup');
      }
    } else if (examFlowState === 'results') {
      setExamFlowState('setup');
    } else {
      handleBackToHub();
    }
  };

  const invalidForMode = (mode === 'prep' && !PREP_TOOL_IDS.has(prepType)) || (mode === 'exam' && !EXAM_TOOL_IDS.has(prepType));

  if (!config || invalidForMode) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-sm w-full">
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground mb-4">Unknown preparation type: "{prepType}"</p>
            <Button onClick={() => navigate('/home')}>Go Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!subject) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-sm w-full">
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground mb-4">Please select a subject first</p>
            <Button onClick={() => navigate('/home')}>Go to Exam Prep</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── EXAM TOOL RENDERING ──────────────────────────────────────────────────
  if (isExamTool) {
    // Loading state
    if (examFlowState === 'loading') {
      return (
        <div className="min-h-screen bg-background bg-pattern flex items-center justify-center">
          <div className="text-center page-enter">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl gradient-primary flex items-center justify-center animate-pulse">
              <span className="text-3xl">{config.emoji}</span>
            </div>
            <h3 className="text-lg font-semibold mb-2">Generating Your Exam...</h3>
            <p className="text-sm text-muted-foreground mb-6">AI is creating adaptive questions from your book content</p>
            <div className="flex gap-1.5 justify-center">
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className="w-3 h-3 rounded-full bg-primary animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        </div>
      );
    }

    // Exam session
    if (examFlowState === 'session' && examQuestions.length > 0) {
      return (
        <ExamSession
          questions={examQuestions}
          examType={examConfig?.examType || prepType}
          subjectName={subject.name}
          chapterName={currentChapter?.chapter_name}
          difficultyLevel="adaptive"
          weakAreasTargeted={[]}
          timeLimitMinutes={examConfig?.timeLimitMinutes}
          onFinish={handleExamFinish}
          onBack={handleExamBack}
          isPractice={examConfig?.examType === 'practice-exam'}
        />
      );
    }

    // Results
    if (examFlowState === 'results' && examResults) {
      return (
        <ExamResultsView
          results={examResults}
          aiFeedback={aiFeedback}
          isLoadingFeedback={isLoadingFeedback}
          onRetry={handleExamRetry}
          onBack={() => setExamFlowState('setup')}
          subjectName={subject.name}
        />
      );
    }

    // Setup (default for exam tools)
    return (
      <div className="min-h-screen bg-background bg-pattern">
        <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
          <div className="container flex items-center justify-between h-14 px-4">
            <Button variant="ghost" size="icon" onClick={handleBackToHub}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 text-center">
              <span className="font-semibold">{config.emoji} {config.title}</span>
            </div>
            <div className="w-9" />
          </div>
        </header>

        <main className="container px-4 py-4 max-w-3xl">
          {/* Chapter selector */}
          {subjectChapters.length > 0 && (
            <Card className="glass-card border-border/50 mb-4">
              <CardContent className="p-3">
                <Select value={selectedChapterId || '__all__'} onValueChange={handleChapterChange}>
                  <SelectTrigger className="input-premium">
                    <SelectValue placeholder="Select chapter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Chapters</SelectItem>
                    {subjectChapters.map(chapter => (
                      <SelectItem key={chapter.id} value={chapter.id}>
                        {chapter.chapter_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          <ExamSetup
            subjectName={subject.name}
            chapterName={currentChapter?.chapter_name}
            onStart={handleExamStart}
            onBack={handleBackToHub}
            isLoading={isGeneratingQuestions}
          />
        </main>
      </div>
    );
  }

  // ─── PREP TOOL RENDERING (unchanged) ──────────────────────────────────────
  const currentIndex = subjectChapters.findIndex(c => c.id === selectedChapterId);
  const prevChapter = currentIndex > 0 ? subjectChapters[currentIndex - 1] : null;
  const nextChapter = currentIndex < subjectChapters.length - 1 ? subjectChapters[currentIndex + 1] : null;

  return (
    <div className="min-h-screen bg-background bg-pattern">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="container flex items-center justify-between h-14 px-4">
          <Button variant="ghost" size="icon" onClick={handleBackToHub}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 text-center">
            <span className="font-semibold">{config.emoji} {config.title}</span>
          </div>
          {config.supportsAI && (
            <Button variant="ghost" size="icon" onClick={handleGenerate} disabled={isPrepLoading}>
              <RefreshCw className={cn('w-4 h-4', isPrepLoading && 'animate-spin')} />
            </Button>
          )}
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden md:block w-64 border-r border-border bg-background/50 h-[calc(100vh-3.5rem)] sticky top-14 overflow-y-auto">
          <div className="p-4">
            <h3 className="font-semibold text-sm mb-3">Chapters</h3>
            <div className="space-y-1">
              <button
                onClick={() => handleChapterChange('__all__')}
                className={cn(
                  'w-full text-left p-2 rounded-lg text-sm transition-colors',
                  !selectedChapterId ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                )}
              >
                All Chapters
              </button>
              {subjectChapters.map(chapter => (
                <button
                  key={chapter.id}
                  onClick={() => handleChapterChange(chapter.id)}
                  className={cn(
                    'w-full text-left p-2 rounded-lg text-sm transition-colors',
                    selectedChapterId === chapter.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                  )}
                >
                  {chapter.chapter_name}
                </button>
              ))}
              {subjectChapters.length === 0 && (
                <p className="text-xs text-muted-foreground p-2">
                  No chapters yet. Visit Books tab to add chapters.
                </p>
              )}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 container px-4 py-4 max-w-3xl">
          {/* Subject & Chapter Info */}
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{category?.icon || '📖'}</span>
                <div className="flex-1">
                  <h2 className="font-semibold">{subject.name}</h2>
              <Badge variant="outline" className="text-[10px] mt-1">{mode === 'prep' ? 'Preparation Mode' : 'Exam Mode'}</Badge>
                  <p className="text-sm text-muted-foreground">
                    {currentChapter?.chapter_name || 'All chapters'}
                  </p>
                </div>
                {config.supportsAI && (
                  <Badge variant="outline" className="text-xs border-primary/30 text-primary shrink-0">
                    🤖 AI Powered
                  </Badge>
                )}
              </div>

              {/* Mobile chapter selector */}
              <div className="md:hidden">
                <Select value={selectedChapterId || '__all__'} onValueChange={handleChapterChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select chapter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Chapters</SelectItem>
                    {subjectChapters.map(chapter => (
                      <SelectItem key={chapter.id} value={chapter.id}>
                        {chapter.chapter_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Content Area */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">{config.emoji}</span>
                {config.title}
              </CardTitle>
              <p className="text-sm text-muted-foreground">{config.description}</p>
            </CardHeader>
            <CardContent>
              {config.supportsAI ? (
                <AIContentPanel
                  content={prepContent}
                  isLoading={isPrepLoading}
                  onRegenerate={handleGenerate}
                  prepType={prepType}
                />
              ) : (
                <div className="text-center py-12 bg-muted/50 rounded-lg">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl gradient-primary flex items-center justify-center">
                    <span className="text-2xl">{config.emoji}</span>
                  </div>
                  <h3 className="font-semibold mb-2">Coming Soon</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    {config.title} with adaptive AI support is being built. Stay tuned!
                  </p>
                  <Badge className="mt-4" variant="secondary">
                    {currentChapter ? `Focused on: ${currentChapter.chapter_name}` : 'All chapters selected'}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* No book content warning */}
          {!isPrepLoading && config.supportsAI && !prepContent && hasGenerated && (
            <Card className="mb-4 border-destructive/20 bg-destructive/5">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-destructive">No book content found</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Upload your textbook pages in the Books tab for AI to generate content.
                    </p>
                    <Button
                      variant="link"
                      size="sm"
                      className="px-0 h-auto mt-2 text-destructive"
                      onClick={() => navigate('/home?tab=syllabus')}
                    >
                      <BookOpen className="w-3 h-3 mr-1" />
                      Go to Books tab
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Chapter Navigation */}
          {subjectChapters.length > 0 && selectedChapterId && (
            <div className="flex justify-between gap-4 mb-4">
              <Button
                variant="outline"
                disabled={!prevChapter}
                onClick={() => prevChapter && handleChapterChange(prevChapter.id)}
                className="flex-1"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                {prevChapter?.chapter_name || 'Previous'}
              </Button>
              <Button
                variant="outline"
                disabled={!nextChapter}
                onClick={() => nextChapter && handleChapterChange(nextChapter.id)}
                className="flex-1"
              >
                {nextChapter?.chapter_name || 'Next'}
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}

          <Button variant="ghost" className="w-full" onClick={handleBackToHub}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Prep Hub
          </Button>
        </main>
      </div>
    </div>
  );
}

