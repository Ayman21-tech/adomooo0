import { useState, useEffect } from 'react';
import {
  Trophy, Target, TrendingUp, Clock, BarChart3,
  CheckCircle2, XCircle, ChevronDown, ChevronUp,
  RefreshCw, ArrowLeft, BookOpen, Loader2, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import type { ExamResults as ExamResultsType } from './ExamSession';

interface ExamResultsViewProps {
  results: ExamResultsType;
  aiFeedback: string;
  isLoadingFeedback: boolean;
  onRetry: () => void;
  onBack: () => void;
  subjectName: string;
}

export function ExamResultsView({
  results,
  aiFeedback,
  isLoadingFeedback,
  onRetry,
  onBack,
  subjectName,
}: ExamResultsViewProps) {
  const [showReview, setShowReview] = useState(false);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);

  const percentage = Math.round((results.correctAnswers / results.totalQuestions) * 100);
  const minutes = Math.floor(results.timeTakenSeconds / 60);
  const seconds = results.timeTakenSeconds % 60;

  const avgTimePerQuestion = Math.round(results.timeTakenSeconds / results.totalQuestions);

  // Performance tiers
  const tier = percentage >= 90 ? { label: 'Excellent!', emoji: '🏆', color: 'text-success' }
    : percentage >= 75 ? { label: 'Great Job!', emoji: '⭐', color: 'text-primary' }
    : percentage >= 50 ? { label: 'Good Effort!', emoji: '👍', color: 'text-warning' }
    : { label: 'Keep Practicing!', emoji: '💪', color: 'text-destructive' };

  // Difficulty breakdown
  const diffBreakdown = { easy: { total: 0, correct: 0 }, medium: { total: 0, correct: 0 }, hard: { total: 0, correct: 0 } };
  results.questions.forEach(q => {
    const ans = results.answers.find(a => a.questionId === q.id);
    const diff = q.difficulty as keyof typeof diffBreakdown;
    if (diffBreakdown[diff]) {
      diffBreakdown[diff].total++;
      if (ans?.isCorrect) diffBreakdown[diff].correct++;
    }
  });

  // Topic breakdown
  const topicMap = new Map<string, { total: number; correct: number }>();
  results.questions.forEach(q => {
    const ans = results.answers.find(a => a.questionId === q.id);
    const existing = topicMap.get(q.topic) || { total: 0, correct: 0 };
    existing.total++;
    if (ans?.isCorrect) existing.correct++;
    topicMap.set(q.topic, existing);
  });

  return (
    <div className="min-h-screen bg-background bg-pattern">
      <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border/50">
        <div className="container flex items-center justify-between h-14 px-4 max-w-3xl">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <span className="font-semibold text-sm">Exam Results</span>
          <div className="w-9" />
        </div>
      </header>

      <main className="container px-4 py-6 max-w-3xl pb-24 space-y-4">
        {/* Hero Score */}
        <Card className="glass-card border-border/50 overflow-hidden">
          <div className="relative p-6 text-center">
            <div className="absolute top-0 left-0 right-0 h-1 gradient-primary" />
            <div className="text-5xl mb-2">{tier.emoji}</div>
            <h2 className={cn('text-2xl font-bold mb-1', tier.color)}>{tier.label}</h2>
            <p className="text-muted-foreground text-sm mb-4">{subjectName}</p>

            <div className="relative w-32 h-32 mx-auto mb-4">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                <circle
                  cx="50" cy="50" r="42" fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${percentage * 2.64} 264`}
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold">{percentage}%</span>
                <span className="text-xs text-muted-foreground">{results.correctAnswers}/{results.totalQuestions}</span>
              </div>
            </div>

            <div className="flex justify-center gap-6 text-sm">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span>{minutes}m {seconds}s</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-muted-foreground" />
                <span>~{avgTimePerQuestion}s/q</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          {(['easy', 'medium', 'hard'] as const).map(diff => {
            const data = diffBreakdown[diff];
            const pct = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
            const emoji = diff === 'easy' ? '🟢' : diff === 'medium' ? '🟡' : '🔴';
            return (
              <Card key={diff} className="glass-card border-border/50">
                <CardContent className="p-3 text-center">
                  <span className="text-lg">{emoji}</span>
                  <p className="text-xs text-muted-foreground capitalize mt-1">{diff}</p>
                  <p className="text-lg font-bold">{pct}%</p>
                  <p className="text-[10px] text-muted-foreground">{data.correct}/{data.total}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Topic Breakdown */}
        {topicMap.size > 1 && (
          <Card className="glass-card border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" /> Topic Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {Array.from(topicMap.entries()).map(([topic, data]) => {
                const pct = Math.round((data.correct / data.total) * 100);
                return (
                  <div key={topic}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="truncate mr-2">{topic}</span>
                      <span className={cn('text-xs font-medium', pct >= 70 ? 'text-success' : pct >= 40 ? 'text-warning' : 'text-destructive')}>
                        {data.correct}/{data.total}
                      </span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* AI Feedback */}
        <Card className="glass-card border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> 🤖 AI Performance Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingFeedback ? (
              <div className="flex flex-col items-center py-8 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Analyzing your performance...</p>
              </div>
            ) : aiFeedback ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{aiFeedback}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Feedback not available right now. Keep practicing!
              </p>
            )}
          </CardContent>
        </Card>

        {/* Question Review Toggle */}
        <Button
          variant="outline"
          className="w-full rounded-xl"
          onClick={() => setShowReview(!showReview)}
        >
          <BookOpen className="w-4 h-4 mr-2" />
          {showReview ? 'Hide' : 'Review'} All Questions
          {showReview ? <ChevronUp className="w-4 h-4 ml-2" /> : <ChevronDown className="w-4 h-4 ml-2" />}
        </Button>

        {/* Question Review */}
        {showReview && (
          <div className="space-y-3 animate-in slide-in-from-top-2">
            {results.questions.map((q, i) => {
              const ans = results.answers.find(a => a.questionId === q.id);
              const isExpanded = expandedQuestion === q.id;
              const isCorrect = ans?.isCorrect;

              return (
                <Card
                  key={q.id}
                  className={cn(
                    'glass-card border cursor-pointer transition-all',
                    isCorrect ? 'border-success/20' : 'border-destructive/20'
                  )}
                  onClick={() => setExpandedQuestion(isExpanded ? null : q.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      {isCorrect ?
                        <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" /> :
                        <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                      }
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">Q{i + 1}. {q.question}</p>
                        {!isCorrect && ans && (
                          <p className="text-xs text-destructive mt-1">
                            Your answer: {q.options[ans.selectedOption!]}
                          </p>
                        )}
                        {isExpanded && (
                          <div className="mt-3 space-y-2 animate-in fade-in">
                            {q.options.map((opt, oi) => (
                              <div key={oi} className={cn(
                                'text-xs p-2 rounded-lg',
                                oi === q.correct_answer && 'bg-success/10 text-success font-medium',
                                oi === ans?.selectedOption && oi !== q.correct_answer && 'bg-destructive/10 text-destructive',
                              )}>
                                {String.fromCharCode(65 + oi)}. {opt}
                                {oi === q.correct_answer && ' ✓'}
                              </div>
                            ))}
                            <div className="bg-muted/50 rounded-lg p-2.5 mt-2">
                              <p className="text-xs text-muted-foreground">💡 {q.explanation}</p>
                            </div>
                          </div>
                        )}
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1 rounded-xl" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <Button className="flex-1 btn-premium text-primary-foreground rounded-xl" onClick={onRetry}>
            <RefreshCw className="w-4 h-4 mr-2" /> Try Again
          </Button>
        </div>
      </main>
    </div>
  );
}
