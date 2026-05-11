import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  GraduationCap, Timer, FlaskConical, Trophy, Brain,
  ChevronRight, ArrowLeft, AlertCircle, Upload
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUser } from '@/contexts/UserContext';
import { useSyllabus } from '@/hooks/useSyllabus';
import { useExamResults } from '@/hooks/useExamResults';
import { getSubjectById, getCategoryBySubjectId } from '@/data/subjects';
import { cn } from '@/lib/utils';
import { t } from '@/i18n';

const EXAM_SELECTION_KEY = 'exam_selection';

interface ExamSelection {
  subjectId: string;
  chapterId: string;
}

export function ExamTab() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useUser();
  const lang = user.default_language;
  const { chapters, loading: syllabusLoading, bookPages } = useSyllabus();
  const { results } = useExamResults();

  const examButtons = [
    { id: 'practice-exam', label: t('exam.practiceExam', lang), icon: GraduationCap, description: t('exam.practiceExamDesc', lang), color: 'bg-primary/20 text-primary' },
    { id: 'real-exam', label: t('exam.timedExam', lang), icon: Timer, description: t('exam.timedExamDesc', lang), color: 'bg-destructive/20 text-destructive' },
    { id: 'question-lab', label: t('exam.questionLab', lang), icon: FlaskConical, description: t('exam.questionLabDesc', lang), color: 'bg-secondary text-secondary-foreground' },
    { id: 'challenge', label: t('exam.dailyChallenge', lang), icon: Trophy, description: t('exam.dailyChallengeDesc', lang), color: 'bg-accent text-accent-foreground' },
    { id: 'think-train', label: t('exam.thinkTrain', lang), icon: Brain, description: t('exam.thinkTrainDesc', lang), color: 'bg-muted text-muted-foreground' },
  ];
  
  const getInitialSelection = (): ExamSelection => {
    const urlSubject = searchParams.get('subject');
    const urlChapter = searchParams.get('chapter');
    if (urlSubject) return { subjectId: urlSubject, chapterId: urlChapter || '' };
    try {
      const stored = localStorage.getItem(EXAM_SELECTION_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) { console.error('Error loading exam selection:', e); }
    return { subjectId: '', chapterId: '' };
  };
  
  const [selection, setSelection] = useState<ExamSelection>(getInitialSelection);
  const [showHub, setShowHub] = useState(false);
  const [showChapterSelect, setShowChapterSelect] = useState(false);
  const [pendingToolId, setPendingToolId] = useState<string | null>(null);

  const subjectChapters = chapters.filter(c => c.subject_id === selection.subjectId);
  const subjectBookPages = bookPages.filter(p => p.subject_id === selection.subjectId);
  const hasBookPages = subjectBookPages.length > 0;
  const subjectResults = results.filter(r => r.subject_id === selection.subjectId).slice(0, 3);

  useEffect(() => { if (selection.subjectId && hasBookPages) setShowHub(true); }, []);
  useEffect(() => {
    if (selection.subjectId) {
      localStorage.setItem(EXAM_SELECTION_KEY, JSON.stringify(selection));
      const params = new URLSearchParams();
      params.set('subject', selection.subjectId);
      if (selection.chapterId) params.set('chapter', selection.chapterId);
      setSearchParams(params, { replace: true });
    }
  }, [selection, setSearchParams]);

  const handleSubjectChange = (subjectId: string) => { setSelection({ subjectId, chapterId: '' }); setShowHub(false); setShowChapterSelect(false); setPendingToolId(null); };
  const handleChapterChange = (chapterId: string) => {
    setSelection(prev => ({ ...prev, chapterId }));
    setShowChapterSelect(false);
    if (pendingToolId) { navigateToTool(pendingToolId, chapterId); setPendingToolId(null); }
  };
  const handleStartExam = () => { if (!hasBookPages) { navigate('/home?tab=syllabus'); return; } setShowHub(true); };
  const navigateToTool = (toolId: string, chapterId?: string) => {
    const chapter = (chapterId || selection.chapterId) ? subjectChapters.find(c => c.id === (chapterId || selection.chapterId)) : null;
    navigate(`/exam/${toolId}?subject=${selection.subjectId}${(chapterId || selection.chapterId) ? `&chapter=${chapterId || selection.chapterId}` : ''}`, { 
      state: { subjectId: selection.subjectId, chapterId: chapterId || selection.chapterId || undefined, chapterName: chapter?.chapter_name } 
    });
  };
  const handleExamButtonClick = (buttonId: string) => {
    if (subjectChapters.length > 0 && !selection.chapterId) { setPendingToolId(buttonId); setShowChapterSelect(true); return; }
    navigateToTool(buttonId);
  };
  const handleGoBack = () => {
    if (showChapterSelect) { setShowChapterSelect(false); setPendingToolId(null); } 
    else if (showHub) { setShowHub(false); setSelection({ subjectId: '', chapterId: '' }); }
  };

  if (!showHub) {
    return (
      <div className="space-y-4 pb-20">
        <div className="text-center py-4">
          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl gradient-primary flex items-center justify-center">
            <GraduationCap className="w-8 h-8 text-primary-foreground" />
          </div>
          <h2 className="text-lg font-semibold mb-1">{t('exam.title', lang)}</h2>
          <p className="text-sm text-muted-foreground">{t('exam.subtitle', lang)}</p>
        </div>
        <Card className="glass-card border-border/50">
          <CardContent className="p-4 space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">{t('prep.selectSubject', lang)}</label>
              <Select value={selection.subjectId} onValueChange={handleSubjectChange}>
                <SelectTrigger className="input-premium"><SelectValue placeholder={t('prep.chooseSubject', lang)} /></SelectTrigger>
                <SelectContent>
                  {user.selected_subjects.map(subjectId => {
                    const subject = getSubjectById(subjectId);
                    const category = getCategoryBySubjectId(subjectId);
                    return <SelectItem key={subjectId} value={subjectId}>{category?.icon} {subject?.name}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            {selection.subjectId && !hasBookPages && (
              <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-xl flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center"><Upload className="w-6 h-6 text-destructive" /></div>
                <div>
                  <p className="font-medium text-destructive">{t('prep.uploadFirst', lang)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{lang === 'bangla' ? 'পরীক্ষা দেওয়ার আগে আপনার বইয়ের পৃষ্ঠা আপলোড করতে হবে।' : 'You need to upload your book pages before taking exams.'}</p>
                </div>
                <Button variant="outline" size="sm" className="border-destructive/50 text-destructive hover:bg-destructive/10" onClick={() => navigate('/home?tab=syllabus')}>
                  <Upload className="w-4 h-4 mr-2" />{t('books.uploadBookPages', lang)}
                </Button>
              </div>
            )}
            <Button className="w-full btn-premium text-primary-foreground" disabled={!selection.subjectId || !hasBookPages} onClick={handleStartExam}>
              {t('exam.startTesting', lang)}<ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
        {results.length > 0 && (
          <Card className="glass-card border-border/50">
            <CardHeader className="pb-2"><CardTitle className="text-sm">{t('exam.recentResults', lang)}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {results.slice(0, 3).map(result => {
                const subject = getSubjectById(result.subject_id);
                const percentage = Math.round((result.correct_answers / result.total_questions) * 100);
                return (
                  <div key={result.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                    <div><p className="text-sm font-medium">{subject?.name || 'Unknown'}</p><p className="text-xs text-muted-foreground">{result.exam_type}</p></div>
                    <Badge variant={percentage >= 70 ? 'default' : 'secondary'}>{percentage}%</Badge>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  const subject = getSubjectById(selection.subjectId);
  const chapter = selection.chapterId ? subjectChapters.find(c => c.id === selection.chapterId) : null;

  if (showChapterSelect && subjectChapters.length > 0) {
    const pendingTool = examButtons.find(b => b.id === pendingToolId);
    return (
      <div className="space-y-4 pb-20">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={handleGoBack}><ArrowLeft className="w-5 h-5" /></Button>
          <div className="flex-1">
            <h2 className="font-semibold">{subject?.name}</h2>
            <p className="text-xs text-muted-foreground">{lang === 'bangla' ? `${pendingTool?.label || 'এই পরীক্ষার'} জন্য অধ্যায় নির্বাচন করুন` : `Select a chapter for ${pendingTool?.label || 'this exam'}`}</p>
          </div>
          <Badge variant="outline" className="text-xs border-primary/30 text-primary">📝 {t('exam.testMode', lang)}</Badge>
        </div>
        <Card className="glass-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              {pendingTool && <pendingTool.icon className="w-5 h-5 text-primary" />}
              {t('prep.selectChapter', lang)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {subjectChapters.map(ch => (
              <Button key={ch.id} variant="outline" className="w-full justify-start text-left h-auto py-3 hover:border-primary/50 hover:bg-primary/5" onClick={() => handleChapterChange(ch.id)}>
                <GraduationCap className="w-4 h-4 mr-3 text-primary" />{ch.chapter_name}
              </Button>
            ))}
          </CardContent>
        </Card>
        <Button variant="ghost" className="w-full" onClick={handleGoBack}><ArrowLeft className="w-4 h-4 mr-2" />{t('exam.backToExamOptions', lang)}</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={handleGoBack}><ArrowLeft className="w-5 h-5" /></Button>
        <div className="flex-1">
          <h2 className="font-semibold">{subject?.name}</h2>
          <p className="text-xs text-muted-foreground">{chapter ? chapter.chapter_name : t('prep.allChapters', lang)}</p>
        </div>
        <Badge variant="outline" className="text-xs border-primary/30 text-primary">📝 {t('exam.testMode', lang)}</Badge>
      </div>
      {subjectChapters.length > 0 && (
        <Card className="glass-card border-border/50">
          <CardContent className="p-3">
            <Select value={selection.chapterId || '__all__'} onValueChange={(v) => handleChapterChange(v === '__all__' ? '' : v)}>
              <SelectTrigger className="input-premium"><SelectValue placeholder={t('prep.allChapters', lang)} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{t('prep.allChapters', lang)}</SelectItem>
                {subjectChapters.map(ch => <SelectItem key={ch.id} value={ch.id}>{ch.chapter_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}
      <Card className="glass-card border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><GraduationCap className="w-4 h-4 text-primary" />{t('exam.examOptions', lang)}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {examButtons.map(btn => (
              <Button key={btn.id} variant="outline" className="h-auto py-4 px-4 flex flex-col items-center gap-2 text-center hover:border-primary/50 hover:bg-primary/5 transition-all" onClick={() => handleExamButtonClick(btn.id)}>
                <div className={cn('p-3 rounded-xl', btn.color)}><btn.icon className="w-5 h-5" /></div>
                <div><span className="font-medium text-sm block">{btn.label}</span><span className="text-xs text-muted-foreground">{btn.description}</span></div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
      {subjectResults.length > 0 && (
        <Card className="glass-card border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t('exam.yourProgress', lang)}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {subjectResults.map(result => {
              const percentage = Math.round((result.correct_answers / result.total_questions) * 100);
              return (
                <div key={result.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                  <div><p className="text-sm font-medium">{result.exam_type}</p><p className="text-xs text-muted-foreground">{result.correct_answers}/{result.total_questions} {t('exam.correct', lang)}</p></div>
                  <Badge variant={percentage >= 70 ? 'default' : 'secondary'}>{percentage}%</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
      {!syllabusLoading && subjectChapters.length === 0 && (
        <Card className="glass-card border-border/50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">{t('prep.noChapters', lang)}</p>
                <p className="text-xs text-muted-foreground mt-1">{lang === 'bangla' ? 'অধ্যায় অনুযায়ী পরীক্ষা সাজাতে বই ট্যাবে অধ্যায় যোগ করুন।' : 'Add chapters in the Books tab to organize your exams by chapter.'}</p>
                <Button variant="link" size="sm" className="px-0 h-auto mt-2" onClick={() => navigate('/home?tab=syllabus')}>{t('prep.goToBooks', lang)}</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
