import { useState, useEffect } from 'react';
import { TrendingUp, Target, AlertTriangle, Eye, Calendar, Lightbulb, Zap, CheckCircle, Loader2, Flame, Brain, TrendingDown, Map } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useUser } from '@/contexts/UserContext';
import { useLearningActivity } from '@/hooks/useLearningActivity';
import { useStudyStreak } from '@/hooks/useStudyStreak';
import { useExamResults } from '@/hooks/useExamResults';
import { useLearningEngine } from '@/hooks/useLearningEngine';
import { getSubjectById } from '@/data/subjects';
import { cn } from '@/lib/utils';
import { t } from '@/i18n';
import { ConceptMapVisual } from '@/components/progress/ConceptMapVisual';
import { LearningPathCard } from '@/components/progress/LearningPathCard';
import { WeaknessDashboard } from '@/components/progress/WeaknessDashboard';
import { LearningDNACard } from '@/components/progress/LearningDNACard';
import { AdaptiveMemoryCard } from '@/components/progress/AdaptiveMemoryCard';
import { VerificationHistoryCard } from '@/components/progress/VerificationHistoryCard';

// Premium circular progress component
function CircularProgress({ value, size = 120, strokeWidth = 10 }: { 
  value: number; 
  size?: number; 
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90 progress-glow" width={size} height={size}>
        <circle
          className="text-muted"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <defs>
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--gradient-start))" />
            <stop offset="50%" stopColor="hsl(var(--gradient-mid))" />
            <stop offset="100%" stopColor="hsl(var(--gradient-end))" />
          </linearGradient>
        </defs>
        <circle
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke="url(#progressGradient)"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold gradient-text">{value}%</span>
        <span className="text-xs text-muted-foreground mt-0.5">{t('progress.title', 'en')}</span>
      </div>
    </div>
  );
}

// Premium trait indicator
function TraitIndicator({ label, value, icon: Icon, loading = false }: { 
  label: string; 
  value: number; 
  icon: React.ElementType;
  loading?: boolean;
}) {
  const getColor = () => {
    if (value >= 70) return 'text-green-500';
    if (value >= 40) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-card/50 backdrop-blur-sm border border-border/30 transition-all hover:border-primary/20">
      <div className={cn(
        'w-9 h-9 rounded-xl flex items-center justify-center',
        loading ? 'bg-muted' : value >= 70 ? 'bg-green-500/10' : value >= 40 ? 'bg-yellow-500/10' : 'bg-red-500/10'
      )}>
        <Icon className={cn('w-4 h-4', loading ? 'text-muted-foreground' : getColor())} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-sm font-medium">{label}</span>
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : (
            <span className={cn('text-sm font-bold', getColor())}>{value}%</span>
          )}
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div 
            className={cn(
              'h-full rounded-full transition-all duration-500',
              value >= 70 ? 'bg-green-500' : value >= 40 ? 'bg-yellow-500' : 'bg-red-500'
            )}
            style={{ width: loading ? '0%' : `${value}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// Activity bar for chart
function ActivityBar({ day, value, maxValue }: { day: string; value: number; maxValue: number }) {
  const height = maxValue > 0 ? (value / maxValue) * 100 : 0;
  
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="w-8 h-24 bg-muted/50 rounded-lg overflow-hidden flex items-end">
        <div 
          className="w-full gradient-primary transition-all duration-500 rounded-lg"
          style={{ height: `${Math.max(height, 8)}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground font-medium">{day}</span>
    </div>
  );
}

export function ProgressTab() {
  const { user } = useUser();
  const lang = user.default_language;
  const { streak, loading: streakLoading } = useStudyStreak();
  const { 
    loading: activityLoading,
    getOverallProgress, 
    getWeakSubjects, 
    getIgnoredSubjects, 
    getActivityByDay,
    activities,
    mastery
  } = useLearningActivity();
  const { results, loading: resultsLoading } = useExamResults();
  const { profile, conceptMap, learningPath, learningDNA, getStudentProfile, getConceptMap, getLearningPath, getLearningDNA, isLoading: engineLoading } = useLearningEngine();

  // Load adaptive profile, concept map, and learning path for first selected subject
  useEffect(() => {
    if (user.selected_subjects.length > 0) {
      const subjectId = user.selected_subjects[0];
      getStudentProfile(subjectId);
      getConceptMap(subjectId);
      getLearningPath(subjectId);
    }
    getLearningDNA();
  }, [user.selected_subjects, getStudentProfile, getConceptMap, getLearningPath, getLearningDNA]);

  const isLoading = activityLoading || streakLoading || resultsLoading;
  const overallProgress = getOverallProgress();
  const weakSubjects = getWeakSubjects();
  const ignoredSubjects = getIgnoredSubjects();
  const activityData = getActivityByDay(7);
  const maxActivity = Math.max(...activityData.map(d => d.count), 1);

  // Calculate traits from actual data
  const calculateTraits = () => {
    const streakDays = streak?.current_streak || 0;
    const totalDays = streak?.total_study_days || 0;
    const consistency = Math.min(100, Math.round(
      (streakDays * 10) + (totalDays * 2) + (activityData.filter(d => d.count > 0).length * 5)
    ));

    const totalCorrect = results.reduce((sum, r) => sum + r.correct_answers, 0);
    const totalQuestions = results.reduce((sum, r) => sum + r.total_questions, 0);
    const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

    const timedResults = results.filter(r => r.time_taken_seconds && r.time_taken_seconds > 0);
    let speed = 0;
    if (timedResults.length > 0) {
      const avgTimePerQuestion = timedResults.reduce((sum, r) => 
        sum + ((r.time_taken_seconds || 0) / r.total_questions), 0
      ) / timedResults.length;
      speed = Math.min(100, Math.max(0, Math.round(100 - ((avgTimePerQuestion - 20) / 40 * 100))));
    }

    const avgMastery = mastery.length > 0
      ? mastery.reduce((sum, m) => sum + (m.mastery_score || 0), 0) / mastery.length
      : 0;
    const clarity = Math.round(avgMastery);

    const recentActivity = activities.slice(0, 10);
    const recentScores = recentActivity.filter(a => a.score !== null).map(a => a.score || 0);
    const avgRecentScore = recentScores.length > 0 
      ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length 
      : 0;
    const confidence = Math.round((consistency * 0.3 + accuracy * 0.4 + avgRecentScore * 0.3));

    return { consistency, accuracy, speed, clarity, confidence };
  };

  const traits = calculateTraits();

  const dayLabels = lang === 'bangla' ? ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহ', 'শুক্র', 'শনি'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date().getDay();
  const orderedDays = activityData.map((_, i) => {
    const dayIndex = (today - 6 + i + 7) % 7;
    return dayLabels[dayIndex];
  });

  const recommendations = [];
  if (ignoredSubjects.length > 0) {
    const subjectName = getSubjectById(ignoredSubjects[0])?.name || (lang === 'bangla' ? 'একটি বিষয়' : 'a subject');
    recommendations.push({
      type: 'ignored',
      icon: Eye,
      text: lang === 'bangla' ? `আপনি ${subjectName} এক সপ্তাহেরও বেশি সময় ধরে পড়েননি` : `You haven't touched ${subjectName} in over a week`,
    });
  }
  if (weakSubjects.length > 0) {
    const subjectName = getSubjectById(weakSubjects[0].subjectId)?.name || (lang === 'bangla' ? 'একটি বিষয়' : 'a subject');
    recommendations.push({
      type: 'weak',
      icon: Target,
      text: lang === 'bangla' ? `${subjectName} তে ফোকাস করুন - মাত্র ${Math.round(weakSubjects[0].avgMastery)}% দক্ষতা` : `Focus on ${subjectName} - only ${Math.round(weakSubjects[0].avgMastery)}% mastery`,
    });
  }
  if (streak && streak.current_streak === 0) {
    recommendations.push({
      type: 'streak',
      icon: Zap,
      text: lang === 'bangla' ? 'আপনার স্ট্রিক তৈরি করতে পড়া শুরু করুন!' : 'Start a study session to build your streak!',
    });
  }
  if (recommendations.length === 0) {
    if (overallProgress >= 70) {
      recommendations.push({
        type: 'success',
        icon: CheckCircle,
        text: lang === 'bangla' ? 'চমৎকার অগ্রগতি! আপনি দারুণ করছেন!' : "Excellent progress! You're doing great!",
      });
    } else if (activities.length > 0) {
      recommendations.push({
        type: 'next',
        icon: Lightbulb,
        text: lang === 'bangla' ? 'গতি ধরে রাখুন। আপনার শেখার যাত্রা চালিয়ে যান।' : 'Keep up the momentum. Continue your learning journey.',
      });
    } else {
      recommendations.push({
        type: 'start',
        icon: Lightbulb,
        text: t('progress.startLearning', lang),
      });
    }
  }

  const hasNoData = activities.length === 0 && mastery.length === 0 && results.length === 0;

  return (
    <div className="space-y-4 pb-24">
      {/* Welcome & Overall Progress */}
      <Card className="border-border/40 bg-card/70 backdrop-blur-sm overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full blur-3xl -mr-20 -mt-20" />
        <CardContent className="pt-6 pb-6 relative">
          <div className="flex items-center gap-5">
            <CircularProgress value={overallProgress} size={110} strokeWidth={10} />
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold mb-1">
                {user.name ? t('progress.welcomeUser', lang, { name: user.name }) : t('progress.welcome', lang)}
              </h2>
              <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                {hasNoData 
                  ? t('progress.startLearning', lang)
                  : overallProgress > 50 
                    ? t('progress.greatProgress', lang) 
                    : t('progress.buildMomentum', lang)}
              </p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/10">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <span className="text-sm font-semibold text-orange-500">
                    {streakLoading ? '...' : `${streak?.current_streak || 0}${lang === 'bangla' ? 'দি' : 'd'}`}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-semibold text-green-500">{user.selected_subjects.length}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trait Indicators */}
      <Card className="border-border/40 bg-card/70 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-primary-foreground" />
            </div>
            {t('progress.skillsTraits', lang)}
            {hasNoData && (
              <Badge variant="secondary" className="text-xs ml-auto">{t('common.noData', lang)}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <TraitIndicator label={t('progress.consistency', lang)} value={traits.consistency} icon={Calendar} loading={isLoading} />
          <TraitIndicator label={t('progress.accuracy', lang)} value={traits.accuracy} icon={Target} loading={isLoading} />
          <TraitIndicator label={t('progress.speed', lang)} value={traits.speed} icon={Zap} loading={isLoading} />
          <TraitIndicator label={t('progress.conceptClarity', lang)} value={traits.clarity} icon={Lightbulb} loading={isLoading} />
          <TraitIndicator label={t('progress.confidence', lang)} value={traits.confidence} icon={CheckCircle} loading={isLoading} />
        </CardContent>
      </Card>

      {/* Activity Graph */}
      <Card className="border-border/40 bg-card/70 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-blue-500" />
            </div>
            {t('progress.last7Days', lang)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-end px-1">
            {activityData.map((data, i) => (
              <ActivityBar key={i} day={orderedDays[i]} value={data.count} maxValue={maxActivity} />
            ))}
          </div>
          {hasNoData && (
            <p className="text-xs text-muted-foreground text-center mt-4">
              {t('progress.noActivity', lang)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Learning DNA Profile */}
      <LearningDNACard dna={learningDNA} lang={lang} loading={engineLoading} />

      {/* Adaptive Memory Dashboard */}
      <AdaptiveMemoryCard
        shortTermMemories={profile?.short_term_memories || []}
        longTermMemories={profile?.long_term_memories || []}
        lang={lang}
        onMemoryCleared={() => {
          if (user.selected_subjects.length > 0) {
            getStudentProfile(user.selected_subjects[0]);
          }
        }}
      />

      {/* Verification History */}
      <VerificationHistoryCard lang={lang} />

      {/* Weakness Detection Dashboard */}
      {profile && profile.weak_concepts && profile.weak_concepts.length > 0 && (
        <WeaknessDashboard weakConcepts={profile.weak_concepts} lang={lang} />
      )}

      {/* Adaptive Intelligence Panel */}
      {profile && profile.total_concepts > 0 && (
        <Card className="border-border/40 bg-card/70 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Brain className="w-4 h-4 text-purple-500" />
              </div>
              {lang === 'bangla' ? 'অভিযোজিত শিক্ষা বিশ্লেষণ' : 'Adaptive Learning Analysis'}
              <Badge variant="secondary" className="text-xs ml-auto">
                {profile.mastered_count}/{profile.total_concepts} {lang === 'bangla' ? 'আয়ত্ত' : 'mastered'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Mastery overview bars */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: lang === 'bangla' ? 'শুরু হয়নি' : 'Not Started', value: profile.total_concepts - profile.mastered_count - (profile.weak_concepts.length || 0), color: 'bg-muted-foreground/30' },
                { label: lang === 'bangla' ? 'দুর্বল' : 'Weak', value: profile.weak_concepts.length, color: 'bg-destructive' },
                { label: lang === 'bangla' ? 'শিখছি' : 'Learning', value: Math.max(0, profile.total_concepts - profile.mastered_count - profile.weak_concepts.length), color: 'bg-yellow-500' },
                { label: lang === 'bangla' ? 'আয়ত্ত' : 'Mastered', value: profile.mastered_count, color: 'bg-green-500' },
              ].map((item, i) => (
                <div key={i} className="text-center">
                  <div className={`w-8 h-8 rounded-full mx-auto mb-1 flex items-center justify-center text-xs font-bold text-primary-foreground ${item.color}`}>
                    {item.value}
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-tight">{item.label}</p>
                </div>
              ))}
            </div>

            {/* Difficulty calibration indicator */}
            <div className="p-3 rounded-xl bg-background/50 border border-border/30">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-medium">{lang === 'bangla' ? 'অসুবিধা স্তর' : 'Difficulty Level'}</span>
                <Badge variant="outline" className="text-xs">
                  {profile.recommended_difficulty_label === 'easy' ? (lang === 'bangla' ? 'সহজ' : 'Easy')
                    : profile.recommended_difficulty_label === 'hard' ? (lang === 'bangla' ? 'কঠিন' : 'Hard')
                    : (lang === 'bangla' ? 'মাঝারি' : 'Medium')}
                </Badge>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500"
                  style={{ width: `${Math.round((profile.recommended_difficulty / 1.5) * 100)}%` }}
                />
              </div>
            </div>

            {/* Per-Concept Mastery Breakdown */}
            {profile.weak_concepts.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {lang === 'bangla' ? 'কনসেপ্ট দক্ষতা' : 'Concept Mastery'}
                </h4>
                {profile.weak_concepts.slice(0, 6).map((concept: any, i: number) => {
                  const trendIcon = concept.trend === 'improving' ? '↑' : concept.trend === 'declining' ? '↓' : '→';
                  const trendColor = concept.trend === 'improving' ? 'text-green-500' : concept.trend === 'declining' ? 'text-destructive' : 'text-muted-foreground';
                  const barColor = concept.weakness_level === 'critical' ? 'bg-destructive' 
                    : concept.weakness_level === 'weak' ? 'bg-orange-500' 
                    : concept.mastery >= 70 ? 'bg-green-500' : 'bg-yellow-500';
                  return (
                    <div key={i} className="flex items-center gap-3 py-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium truncate">{concept.name}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={cn('text-xs font-bold', trendColor)}>{trendIcon}</span>
                            <span className="text-xs font-bold">{concept.mastery}%</span>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className={cn('h-full rounded-full transition-all duration-500', barColor)} style={{ width: `${concept.mastery}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Trending down */}
            {profile.trending_down.slice(0, 2).map((concept: any, i: number) => (
              <div key={`td-${i}`} className="flex items-center justify-between p-3 rounded-xl bg-orange-500/5 border border-orange-500/20">
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-orange-500 shrink-0" />
                  <span className="text-sm font-medium">{concept.name}</span>
                </div>
                <Badge variant="secondary" className="text-xs shrink-0">
                  {concept.scores?.slice(-3).join(' → ')}
                </Badge>
              </div>
            ))}

            {/* Trending up — celebrate! */}
            {(profile as any).trending_up?.slice(0, 2).map((concept: any, i: number) => (
              <div key={`tu-${i}`} className="flex items-center justify-between p-3 rounded-xl bg-green-500/5 border border-green-500/20">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-500 shrink-0" />
                  <span className="text-sm font-medium">{concept.name}</span>
                </div>
                <Badge variant="outline" className="text-xs border-green-500/30 text-green-600 shrink-0">
                  📈 {concept.mastery}%
                </Badge>
              </div>
            ))}

            {/* Prerequisite gaps */}
            {profile.prerequisite_gaps.slice(0, 2).map((gap: any, i: number) => (
              <div key={`gap-${i}`} className="p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20">
                <div className="flex items-start gap-2">
                  <span className="text-sm mt-0.5">{gap.urgency === 'high' ? '🔴' : '🟡'}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{gap.concept}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {lang === 'bangla'
                        ? `"${gap.prerequisite}" আগে শিখতে হবে (${gap.prerequisite_mastery}% শেখা হয়েছে)`
                        : `"${gap.prerequisite}" needed first (${gap.prerequisite_mastery}% mastered)`}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {/* Reward signals */}
            {profile.rewards.length > 0 && (
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-1">
                {profile.rewards.slice(0, 3).map((reward: any, i: number) => (
                  <p key={i} className="text-sm font-medium">
                    {typeof reward === 'string' ? reward : `${reward.icon} ${reward.message}`}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Knowledge Graph Visual */}
      {conceptMap && conceptMap.total > 0 && (
        <Card className="border-border/40 bg-card/70 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                <Map className="w-4 h-4 text-indigo-500" />
              </div>
              {lang === 'bangla' ? 'কনসেপ্ট ম্যাপ' : 'Concept Map'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ConceptMapVisual conceptMap={conceptMap} lang={lang} />
          </CardContent>
        </Card>
      )}

      {/* Learning Path */}
      {learningPath && learningPath.total_concepts > 0 && (
        <LearningPathCard data={learningPath} lang={lang} />
      )}
      {(weakSubjects.length > 0 || ignoredSubjects.length > 0) && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <div className="w-8 h-8 rounded-xl bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-destructive" />
              </div>
              {t('progress.needsAttention', lang)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {weakSubjects.slice(0, 3).map(({ subjectId, avgMastery }) => {
              const subject = getSubjectById(subjectId);
              return (
                <div key={subjectId} className="flex items-center justify-between p-3 rounded-xl bg-background/50">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-destructive" />
                    <span className="text-sm font-medium">{subject?.name || subjectId}</span>
                  </div>
                  <Badge variant="destructive" className="text-xs">
                    {Math.round(avgMastery)}%
                  </Badge>
                </div>
              );
            })}
            {ignoredSubjects.slice(0, 3).map(subjectId => {
              const subject = getSubjectById(subjectId);
              return (
                <div key={subjectId} className="flex items-center justify-between p-3 rounded-xl bg-background/50">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{subject?.name || subjectId}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">{lang === 'bangla' ? 'পড়া হয়নি' : 'Not studied'}</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center">
              <Lightbulb className="w-4 h-4 text-primary-foreground" />
            </div>
            {t('progress.recommendations', lang)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {recommendations.map((rec, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-background/50">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <rec.icon className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm">{rec.text}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
