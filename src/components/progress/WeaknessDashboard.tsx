import { useNavigate } from 'react-router-dom';
import { AlertTriangle, TrendingDown, TrendingUp, Minus, Activity, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getSubjectById } from '@/data/subjects';
import { cn } from '@/lib/utils';
import type { WeakConcept } from '@/hooks/useLearningEngine';

interface WeaknessDashboardProps {
  weakConcepts: WeakConcept[];
  lang: string;
}

function getLevelConfig(level: string) {
  switch (level) {
    case 'critical':
      return { label: 'Critical', color: 'bg-destructive text-destructive-foreground', barColor: 'bg-destructive', pulse: true };
    case 'weak':
      return { label: 'Weak', color: 'bg-orange-500 text-white', barColor: 'bg-orange-500', pulse: false };
    case 'borderline':
      return { label: 'Borderline', color: 'bg-yellow-500 text-white', barColor: 'bg-yellow-500', pulse: false };
    default:
      return { label: 'OK', color: 'bg-muted text-muted-foreground', barColor: 'bg-muted-foreground', pulse: false };
  }
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'improving') return <TrendingUp className="w-3.5 h-3.5 text-green-500" />;
  if (trend === 'declining') return <TrendingDown className="w-3.5 h-3.5 text-destructive" />;
  return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
}

export function WeaknessDashboard({ weakConcepts, lang }: WeaknessDashboardProps) {
  const navigate = useNavigate();

  if (weakConcepts.length === 0) return null;

  // Group by subject
  const grouped = weakConcepts.reduce<Record<string, WeakConcept[]>>((acc, c) => {
    const key = c.subject || 'unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(c);
    return acc;
  }, {});

  const criticalCount = weakConcepts.filter(c => c.weakness_level === 'critical').length;
  const weakCount = weakConcepts.filter(c => c.weakness_level === 'weak').length;

  return (
    <Card className="border-destructive/30 bg-destructive/5 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <div className={cn(
            'w-8 h-8 rounded-xl bg-destructive/10 flex items-center justify-center',
            criticalCount > 0 && 'animate-pulse'
          )}>
            <AlertTriangle className="w-4 h-4 text-destructive" />
          </div>
          {lang === 'bangla' ? 'দুর্বলতা সনাক্তকরণ' : 'Weakness Detection'}
          <div className="ml-auto flex gap-1.5">
            {criticalCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {criticalCount} {lang === 'bangla' ? 'জটিল' : 'critical'}
              </Badge>
            )}
            {weakCount > 0 && (
              <Badge variant="secondary" className="text-xs bg-orange-500/10 text-orange-600">
                {weakCount} {lang === 'bangla' ? 'দুর্বল' : 'weak'}
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(grouped).map(([subjectId, concepts]) => {
          const subject = getSubjectById(subjectId);
          const sorted = [...concepts].sort((a, b) => a.mastery - b.mastery);

          return (
            <div key={subjectId} className="space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {subject?.name || subjectId}
                </span>
              </div>

              {sorted.map((concept) => {
                const config = getLevelConfig(concept.weakness_level);
                return (
                  <div
                    key={concept.id}
                    className={cn(
                      'p-3 rounded-xl bg-background/60 border border-border/30 transition-all',
                      config.pulse && 'border-destructive/40'
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {config.pulse && (
                          <span className="relative flex h-2.5 w-2.5 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive" />
                          </span>
                        )}
                        <span className="text-sm font-medium truncate">{concept.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <TrendIcon trend={concept.trend} />
                        <Badge className={cn('text-[10px] px-1.5 py-0', config.color)}>
                          {config.label}
                        </Badge>
                        <span className="text-xs font-bold">{concept.mastery}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-2">
                      <div
                        className={cn('h-full rounded-full transition-all duration-500', config.barColor)}
                        style={{ width: `${Math.max(concept.mastery, 3)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">
                        {concept.attempts} {lang === 'bangla' ? 'চেষ্টা' : 'attempts'}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs text-primary gap-1 px-2"
                        onClick={() => navigate(`/subject/${subjectId}`)}
                      >
                        {lang === 'bangla' ? 'পর্যালোচনা' : 'Review'}
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Summary tip */}
        <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
          <div className="flex items-start gap-2">
            <Activity className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              {lang === 'bangla'
                ? 'দুর্বল ধারণাগুলো স্বয়ংক্রিয়ভাবে সনাক্ত হয়। প্রতিটি চর্চা, পরীক্ষা ও টিউটরিং সেশনের পর আপডেট হয়।'
                : 'Weak concepts are automatically detected from practice, exams, and tutoring sessions. Focus on critical areas first for fastest improvement.'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
