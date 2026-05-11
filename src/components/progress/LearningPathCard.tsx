import { ArrowRight, Lock, CheckCircle, AlertTriangle, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface LearningPathData {
  path: Array<{
    order: number;
    id: string;
    name: string;
    difficulty: number;
    mastery: number | null;
    status: string;
    trend: string;
    is_weak: boolean;
    is_ready: boolean;
    is_blocked: boolean;
    blocked_by: string[];
  }>;
  next_topic: {
    id: string;
    name: string;
    difficulty: number;
    mastery: number | null;
    is_weak: boolean;
  } | null;
  total_concepts: number;
  mastered_count: number;
  completion_percentage: number;
  ready_count: number;
  blocked_count: number;
}

interface LearningPathCardProps {
  data: LearningPathData;
  lang: string;
}

export function LearningPathCard({ data, lang }: LearningPathCardProps) {
  if (data.total_concepts === 0) return null;

  const { path, next_topic } = data;

  return (
    <Card className="border-border/40 bg-card/70 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <ArrowRight className="w-4 h-4 text-blue-500" />
          </div>
          {lang === 'bangla' ? 'শেখার পথ' : 'Learning Path'}
          <Badge variant="secondary" className="text-xs ml-auto">
            {data.completion_percentage}% {lang === 'bangla' ? 'সম্পূর্ণ' : 'complete'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Next recommended topic */}
        {next_topic && (
          <div className="p-3 rounded-xl bg-primary/10 border border-primary/30">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-primary">
                {lang === 'bangla' ? 'পরবর্তী বিষয়' : 'Next Recommended Topic'}
              </span>
            </div>
            <p className="text-sm font-bold">{next_topic.name}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-[10px]">
                {lang === 'bangla' ? 'কঠিনতা' : 'Difficulty'}: {next_topic.difficulty}/10
              </Badge>
              {next_topic.is_weak && (
                <Badge variant="destructive" className="text-[10px]">
                  {lang === 'bangla' ? 'দুর্বল' : 'Weak area'}
                </Badge>
              )}
              {next_topic.mastery !== null && (
                <Badge variant="secondary" className="text-[10px]">
                  {next_topic.mastery}% {lang === 'bangla' ? 'শেখা' : 'mastery'}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">{data.mastered_count}/{data.total_concepts} {lang === 'bangla' ? 'আয়ত্ত' : 'mastered'}</span>
            <span className="text-muted-foreground">{data.ready_count} {lang === 'bangla' ? 'প্রস্তুত' : 'ready'} · {data.blocked_count} {lang === 'bangla' ? 'অবরুদ্ধ' : 'blocked'}</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${data.completion_percentage}%` }} />
          </div>
        </div>

        {/* Path steps (show first 8) */}
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {path.slice(0, 12).map((step) => (
            <div
              key={step.id}
              className={cn(
                'flex items-center gap-2 p-2 rounded-lg text-sm transition-all',
                step.status === 'mastered' && 'bg-green-500/5 border border-green-500/20',
                step.is_ready && step.status !== 'mastered' && 'bg-primary/5 border border-primary/20',
                step.is_blocked && 'bg-muted/30 border border-border/20 opacity-60',
                !step.is_ready && !step.is_blocked && step.status !== 'mastered' && 'bg-background/50 border border-border/20',
              )}
            >
              {/* Status icon */}
              <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0">
                {step.status === 'mastered' ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : step.is_blocked ? (
                  <Lock className="w-4 h-4 text-muted-foreground" />
                ) : step.is_weak ? (
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                ) : step.is_ready ? (
                  <Sparkles className="w-4 h-4 text-primary" />
                ) : (
                  <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
                )}
              </div>

              {/* Name */}
              <span className={cn(
                'flex-1 truncate text-xs font-medium',
                step.status === 'mastered' && 'line-through text-muted-foreground',
              )}>
                {step.name}
              </span>

              {/* Mastery */}
              {step.mastery !== null && (
                <span className="text-[10px] text-muted-foreground shrink-0">{step.mastery}%</span>
              )}

              {/* Blocked by */}
              {step.is_blocked && step.blocked_by.length > 0 && (
                <span className="text-[10px] text-muted-foreground shrink-0 max-w-[80px] truncate" title={step.blocked_by.join(', ')}>
                  ← {step.blocked_by[0]}
                </span>
              )}
            </div>
          ))}
          {path.length > 12 && (
            <p className="text-center text-xs text-muted-foreground py-1">
              +{path.length - 12} {lang === 'bangla' ? 'আরও বিষয়' : 'more topics'}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
