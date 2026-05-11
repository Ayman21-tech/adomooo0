import { Dna, Zap, Brain, Clock, Target, Heart, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface LearningDNA {
  type: string;
  primary_style: string;
  secondary_style: string | null;
  learning_speed: string;
  avg_response_time: number;
  retention_rate: number;
  focus_duration: number;
  motivation_type: string;
  weak_patterns: Array<{ name: string; count: number }>;
  strong_subjects: Array<{ subject: string; avg: number }>;
  total_interactions: number;
  learning_type_scores: Record<string, number>;
  last_updated: string;
}

interface Props {
  dna: LearningDNA | null;
  lang: string;
  loading?: boolean;
}

function DNATrait({ icon: Icon, label, value, color }: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-background/50 border border-border/30">
      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', color)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold truncate">{value}</p>
      </div>
    </div>
  );
}

function StyleBar({ label, value, maxValue }: { label: string; value: number; maxValue: number }) {
  const pct = maxValue > 0 ? Math.round((value / maxValue) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs text-muted-foreground capitalize">{label}</span>
        <span className="text-xs font-medium">{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function LearningDNACard({ dna, lang, loading }: Props) {
  if (loading) {
    return (
      <Card className="border-border/40 bg-card/70 backdrop-blur-sm">
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!dna || dna.total_interactions < 3) {
    return (
      <Card className="border-border/40 bg-card/70 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
              <Dna className="w-4 h-4 text-indigo-500" />
            </div>
            {lang === 'bangla' ? 'লার্নিং ডিএনএ' : 'Learning DNA'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            {lang === 'bangla'
              ? 'আপনার শেখার ধরন বিশ্লেষণ করতে আরও কিছু সেশন প্রয়োজন...'
              : 'Need a few more study sessions to analyze your learning pattern...'}
          </p>
          <div className="flex justify-center">
            <Badge variant="secondary" className="text-xs">
              {dna?.total_interactions || 0}/3 {lang === 'bangla' ? 'ইন্টারেকশন' : 'interactions'}
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  const typeScores = dna.learning_type_scores || {};
  const maxScore = Math.max(...Object.values(typeScores), 1);

  const styleLabels: Record<string, string> = lang === 'bangla'
    ? { visual: 'ভিজ্যুয়াল', logical: 'যুক্তিভিত্তিক', example: 'উদাহরণ', story: 'গল্প', practice: 'অনুশীলন' }
    : { visual: 'Visual', logical: 'Logical', example: 'Example', story: 'Story', practice: 'Practice' };

  return (
    <Card className="border-border/40 bg-card/70 backdrop-blur-sm overflow-hidden">
      <div className="absolute top-0 left-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -ml-16 -mt-16" />
      <CardHeader className="pb-3 relative">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
            <Dna className="w-4 h-4 text-indigo-500" />
          </div>
          {lang === 'bangla' ? 'লার্নিং ডিএনএ' : 'Learning DNA'}
          <Badge variant="outline" className="text-xs ml-auto">
            {dna.type}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 relative">
        {/* Core traits */}
        <div className="grid grid-cols-2 gap-2">
          <DNATrait
            icon={Zap}
            label={lang === 'bangla' ? 'শেখার গতি' : 'Learning Speed'}
            value={dna.learning_speed}
            color="bg-yellow-500/10 text-yellow-500"
          />
          <DNATrait
            icon={Brain}
            label={lang === 'bangla' ? 'ধারণ হার' : 'Retention Rate'}
            value={`${dna.retention_rate}%`}
            color="bg-green-500/10 text-green-500"
          />
          <DNATrait
            icon={Clock}
            label={lang === 'bangla' ? 'ফোকাস সময়' : 'Focus Duration'}
            value={`~${dna.focus_duration} min`}
            color="bg-blue-500/10 text-blue-500"
          />
          <DNATrait
            icon={Heart}
            label={lang === 'bangla' ? 'প্রেরণা' : 'Motivation'}
            value={dna.motivation_type}
            color="bg-pink-500/10 text-pink-500"
          />
        </div>

        {/* Learning style breakdown */}
        <div className="p-3 rounded-xl bg-background/50 border border-border/30 space-y-2">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            {lang === 'bangla' ? 'শেখার ধরন বিশ্লেষণ' : 'Learning Style Breakdown'}
          </p>
          {Object.entries(typeScores).map(([key, val]) => (
            <StyleBar key={key} label={styleLabels[key] || key} value={val as number} maxValue={maxScore} />
          ))}
        </div>

        {/* Weak patterns */}
        {dna.weak_patterns && dna.weak_patterns.length > 0 && (
          <div className="p-3 rounded-xl bg-destructive/5 border border-destructive/20">
            <p className="text-xs font-medium text-destructive mb-2 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5" />
              {lang === 'bangla' ? 'পুনরাবৃত্ত দুর্বলতা' : 'Recurring Weak Areas'}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {dna.weak_patterns.map((p, i) => (
                <Badge key={i} variant="outline" className="text-[10px] border-destructive/30 text-destructive">
                  {p.name} ({p.count}x)
                </Badge>
              ))}
            </div>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground text-center">
          {lang === 'bangla' ? 'ভিত্তি:' : 'Based on'} {dna.total_interactions} {lang === 'bangla' ? 'ইন্টারেকশন' : 'interactions'}
        </p>
      </CardContent>
    </Card>
  );
}
