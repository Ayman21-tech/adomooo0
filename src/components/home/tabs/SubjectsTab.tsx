import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Search, ChevronRight, AlertTriangle, Clock, TrendingUp, Sparkles, CheckCircle, Upload, Brain } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useUser } from '@/contexts/UserContext';
import { useLearningActivity } from '@/hooks/useLearningActivity';
import { useSyllabus } from '@/hooks/useSyllabus';
import { getSubjectById, getCategoryBySubjectId } from '@/data/subjects';
import { cn } from '@/lib/utils';
import { t } from '@/i18n';
import { supabase } from '@/integrations/supabase/client';

type FilterType = 'all' | 'weak' | 'strong' | 'not-started';

export function SubjectsTab() {
  const navigate = useNavigate();
  const { user } = useUser();
  const lang = user.default_language;
  const { getSubjectStats, getWeakSubjects, getIgnoredSubjects } = useLearningActivity();
  const { getSyllabusStatus, getBookPagesBySubject } = useSyllabus();
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [conceptMasteryBySubject, setConceptMasteryBySubject] = useState<Record<string, { total: number; mastered: number; weak: number; avgMastery: number }>>({});

  // Fetch concept mastery data per subject
  useEffect(() => {
    const fetchConceptMastery = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Get all concepts for user
      const { data: concepts } = await supabase
        .from('concept_graph')
        .select('id, subject_id')
        .eq('user_id', session.user.id);

      if (!concepts || concepts.length === 0) return;

      const conceptIds = concepts.map(c => c.id);
      const { data: masteryData } = await supabase
        .from('concept_mastery')
        .select('concept_id, mastery_score, is_weak')
        .eq('user_id', session.user.id)
        .in('concept_id', conceptIds);

      // Build per-subject summary
      const masteryMap = new Map((masteryData || []).map(m => [m.concept_id, m]));
      const bySubject: Record<string, { total: number; mastered: number; weak: number; totalScore: number; scoredCount: number }> = {};

      for (const concept of concepts) {
        const sid = concept.subject_id;
        if (!bySubject[sid]) bySubject[sid] = { total: 0, mastered: 0, weak: 0, totalScore: 0, scoredCount: 0 };
        bySubject[sid].total++;
        const m = masteryMap.get(concept.id);
        if (m) {
          bySubject[sid].scoredCount++;
          bySubject[sid].totalScore += m.mastery_score || 0;
          if ((m.mastery_score || 0) >= 70) bySubject[sid].mastered++;
          if (m.is_weak) bySubject[sid].weak++;
        }
      }

      const result: Record<string, { total: number; mastered: number; weak: number; avgMastery: number }> = {};
      for (const [sid, data] of Object.entries(bySubject)) {
        result[sid] = {
          total: data.total,
          mastered: data.mastered,
          weak: data.weak,
          avgMastery: data.scoredCount > 0 ? Math.round(data.totalScore / data.scoredCount) : 0,
        };
      }
      setConceptMasteryBySubject(result);
    };
    fetchConceptMastery();
  }, []);

  const weakSubjectIds = getWeakSubjects().map(s => s.subjectId);
  const ignoredSubjectIds = getIgnoredSubjects();
  const neededNowSubjects = user.selected_subjects.filter(id => weakSubjectIds.includes(id) || ignoredSubjectIds.includes(id));

  const filteredSubjects = user.selected_subjects.filter(subjectId => {
    const subject = getSubjectById(subjectId);
    if (!subject) return false;
    if (searchQuery && !subject.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    const stats = getSubjectStats(subjectId);
    switch (filter) {
      case 'weak': return weakSubjectIds.includes(subjectId);
      case 'strong': return stats.avgMastery >= 70;
      case 'not-started': return stats.activityCount === 0;
      default: return true;
    }
  });

  const SubjectCard = ({ subjectId, showNeeded = false }: { subjectId: string; showNeeded?: boolean }) => {
    const subject = getSubjectById(subjectId);
    const category = getCategoryBySubjectId(subjectId);
    const stats = getSubjectStats(subjectId);
    const syllabusStatus = getSyllabusStatus(subjectId);
    const bookPages = getBookPagesBySubject(subjectId);
    const completedPages = bookPages.filter(p => p.ocr_status === 'completed');
    const hasBook = completedPages.length > 0;
    const isWeak = weakSubjectIds.includes(subjectId);
    const isIgnored = ignoredSubjectIds.includes(subjectId);
    const cm = conceptMasteryBySubject[subjectId];
    if (!subject) return null;

    return (
      <Card 
        className={cn('transition-all duration-300 card-hover cursor-pointer border-border/30 bg-card/50 backdrop-blur-sm overflow-hidden group', isWeak && 'border-destructive/30', isIgnored && !isWeak && 'border-yellow-500/30')}
        onClick={() => navigate(`/subject/${subjectId}`)}
      >
        <CardContent className="p-4 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-2xl">{category?.icon || '📖'}</div>
              <div>
                <h3 className="font-semibold text-sm">{subject.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {hasBook 
                    ? `${completedPages.length} pages • ${syllabusStatus.chapterCount} chapters`
                    : (lang === 'bangla' ? 'বই আপলোড করুন' : 'Upload book pages')}
                </p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-xl bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {/* Book status indicator */}
            {hasBook ? (
              <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-600 hover:bg-green-500/20">
                <CheckCircle className="w-3 h-3 mr-1" />
                {lang === 'bangla' ? 'বই আছে' : 'Book ready'}
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs bg-orange-500/10 text-orange-600 hover:bg-orange-500/20">
                <Upload className="w-3 h-3 mr-1" />
                {lang === 'bangla' ? 'বই নেই' : 'No book'}
              </Badge>
            )}
            {stats.avgMastery > 0 && (
              <Badge variant={stats.avgMastery >= 70 ? 'default' : stats.avgMastery >= 40 ? 'secondary' : 'destructive'} className={cn('text-xs', stats.avgMastery >= 70 && 'bg-green-500/10 text-green-500 hover:bg-green-500/20')}>
                <TrendingUp className="w-3 h-3 mr-1" />{stats.avgMastery}%
              </Badge>
            )}
            {isWeak && <Badge variant="destructive" className="text-xs bg-destructive/10 text-destructive hover:bg-destructive/20"><AlertTriangle className="w-3 h-3 mr-1" />{t('subjects.weak', lang)}</Badge>}
            {isIgnored && !isWeak && <Badge variant="secondary" className="text-xs"><Clock className="w-3 h-3 mr-1" />{stats.daysSinceActivity}{lang === 'bangla' ? 'দি আগে' : 'd ago'}</Badge>}
            {cm && cm.total > 0 && (
              <Badge variant="secondary" className="text-xs bg-purple-500/10 text-purple-600 hover:bg-purple-500/20">
                <Brain className="w-3 h-3 mr-1" />{cm.mastered}/{cm.total}
              </Badge>
            )}
            {showNeeded && <Badge className="text-xs gradient-primary text-primary-foreground border-0"><Sparkles className="w-3 h-3 mr-1" />{t('subjects.focus', lang)}</Badge>}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-5 pb-24">
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center"><Search className="w-4 h-4 text-primary" /></div>
        <Input placeholder={t('subjects.searchPlaceholder', lang)} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-14 h-12 rounded-2xl input-premium" />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {(['all', 'weak', 'strong', 'not-started'] as FilterType[]).map((f) => (
          <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)} className={cn('whitespace-nowrap rounded-xl transition-all press', filter === f && 'gradient-primary border-0 glow-sm')}>
            {f === 'all' && t('common.all', lang)}
            {f === 'weak' && t('subjects.weak', lang)}
            {f === 'strong' && t('subjects.strong', lang)}
            {f === 'not-started' && t('subjects.notStarted', lang)}
          </Button>
        ))}
      </div>
      {neededNowSubjects.length > 0 && filter === 'all' && !searchQuery && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-yellow-500/10 flex items-center justify-center"><AlertTriangle className="w-3.5 h-3.5 text-yellow-500" /></div>
            {t('progress.needsAttention', lang)}
          </h2>
          <div className="grid grid-cols-1 gap-3">{neededNowSubjects.slice(0, 3).map(subjectId => <SubjectCard key={subjectId} subjectId={subjectId} showNeeded />)}</div>
        </div>
      )}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center"><BookOpen className="w-3.5 h-3.5 text-primary" /></div>
          {filter === 'all' ? t('subjects.title', lang) : `${filter.replace('-', ' ')} ${lang === 'bangla' ? 'বিষয়' : 'Subjects'}`}
          <Badge variant="secondary" className="ml-1 text-xs">{filteredSubjects.length}</Badge>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{filteredSubjects.map(subjectId => <SubjectCard key={subjectId} subjectId={subjectId} />)}</div>
        {filteredSubjects.length === 0 && (
          <Card className="p-8 text-center border-border/30 bg-card/50 backdrop-blur-sm">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4"><BookOpen className="w-8 h-8 text-muted-foreground" /></div>
            <p className="text-muted-foreground">{t('subjects.noSubjects', lang)}</p>
          </Card>
        )}
      </div>
    </div>
  );
}
