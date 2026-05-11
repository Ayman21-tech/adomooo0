import { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, Activity, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface VerificationEntry {
  id: string;
  question: string;
  generated_answer: string;
  verification_result: any;
  verified_at: string;
}

interface VerificationHistoryCardProps {
  lang: string;
}

export function VerificationHistoryCard({ lang }: VerificationHistoryCardProps) {
  const [entries, setEntries] = useState<VerificationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }

      const { data } = await supabase
        .from('ai_verification_log')
        .select('*')
        .eq('user_id', session.user.id)
        .order('verified_at', { ascending: false })
        .limit(50);

      setEntries((data as VerificationEntry[]) || []);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <Card className="border-border/40 bg-card/70 backdrop-blur-sm">
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const totalVerified = entries.length;
  const accurateCount = entries.filter(e => e.verification_result?.is_accurate).length;
  const accuracyRate = totalVerified > 0 ? Math.round((accurateCount / totalVerified) * 100) : 0;
  const corrections = entries.filter(e => !e.verification_result?.is_accurate);

  if (totalVerified === 0) {
    return (
      <Card className="border-border/40 bg-card/70 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-green-500/10 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-green-500" />
            </div>
            {lang === 'bangla' ? 'উত্তর যাচাই ইতিহাস' : 'Verification History'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            {lang === 'bangla'
              ? 'AI টিউটরের সাথে চ্যাট করুন — প্রতিটি উত্তর স্বয়ংক্রিয়ভাবে যাচাই করা হবে।'
              : 'Chat with the AI tutor — every answer will be automatically verified.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const visibleCorrections = expanded ? corrections : corrections.slice(0, 3);

  return (
    <Card className="border-border/40 bg-card/70 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-green-500/10 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-green-500" />
          </div>
          {lang === 'bangla' ? 'উত্তর যাচাই ইতিহাস' : 'Verification History'}
          <Badge variant="secondary" className="text-xs ml-auto">
            {totalVerified} {lang === 'bangla' ? 'যাচাই' : 'verified'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-2.5 rounded-xl bg-background/50 border border-border/30">
            <p className="text-lg font-bold text-green-500">{accuracyRate}%</p>
            <p className="text-[10px] text-muted-foreground">{lang === 'bangla' ? 'সঠিকতা' : 'Accuracy'}</p>
          </div>
          <div className="text-center p-2.5 rounded-xl bg-background/50 border border-border/30">
            <p className="text-lg font-bold text-primary">{accurateCount}</p>
            <p className="text-[10px] text-muted-foreground">{lang === 'bangla' ? 'সঠিক' : 'Accurate'}</p>
          </div>
          <div className="text-center p-2.5 rounded-xl bg-background/50 border border-border/30">
            <p className="text-lg font-bold text-orange-500">{corrections.length}</p>
            <p className="text-[10px] text-muted-foreground">{lang === 'bangla' ? 'সংশোধিত' : 'Corrected'}</p>
          </div>
        </div>

        {/* Recent corrections */}
        {corrections.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {lang === 'bangla' ? 'সাম্প্রতিক সংশোধন' : 'Recent Corrections'}
            </h4>
            {visibleCorrections.map((entry) => (
              <div key={entry.id} className="p-3 rounded-xl bg-background/50 border border-orange-500/20">
                <div className="flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-1">{entry.question}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px] border-orange-500/30 text-orange-600">
                        {entry.verification_result?.confidence ?? 0}% {lang === 'bangla' ? 'আত্মবিশ্বাস' : 'confidence'}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(entry.verified_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {corrections.length > 3 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? <ChevronUp className="w-3.5 h-3.5 mr-1" /> : <ChevronDown className="w-3.5 h-3.5 mr-1" />}
                {expanded
                  ? (lang === 'bangla' ? 'কম দেখুন' : 'Show less')
                  : (lang === 'bangla' ? `আরও ${corrections.length - 3}টি দেখুন` : `Show ${corrections.length - 3} more`)}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
