import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { ConceptMap } from '@/hooks/useLearningEngine';

interface ConceptMapVisualProps {
  conceptMap: ConceptMap;
  lang: string;
}

function getStatusColor(status: string) {
  switch (status) {
    case 'mastered': return 'bg-green-500 border-green-400 text-white';
    case 'weak': return 'bg-destructive border-destructive text-destructive-foreground';
    case 'learning': return 'bg-yellow-500 border-yellow-400 text-white';
    default: return 'bg-muted border-border text-muted-foreground';
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'mastered': return '✓';
    case 'weak': return '!';
    case 'learning': return '~';
    default: return '○';
  }
}

export function ConceptMapVisual({ conceptMap, lang }: ConceptMapVisualProps) {
  const { nodes } = conceptMap;

  // Group nodes by difficulty tiers for layout
  const tiers = useMemo(() => {
    const groups: Record<string, typeof nodes> = {
      foundational: [],
      intermediate: [],
      advanced: [],
    };
    for (const node of nodes) {
      if (node.difficulty <= 3) groups.foundational.push(node);
      else if (node.difficulty <= 6) groups.intermediate.push(node);
      else groups.advanced.push(node);
    }
    return groups;
  }, [nodes]);

  if (nodes.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        {lang === 'bangla' ? 'কোন কনসেপ্ট ম্যাপ তৈরি হয়নি। বই আপলোড করুন।' : 'No concept map built yet. Upload book pages first.'}
      </div>
    );
  }

  const tierLabels: Record<string, string> = {
    foundational: lang === 'bangla' ? 'ভিত্তি' : 'Foundation',
    intermediate: lang === 'bangla' ? 'মাঝারি' : 'Intermediate',
    advanced: lang === 'bangla' ? 'উন্নত' : 'Advanced',
  };

  const tierColors: Record<string, string> = {
    foundational: 'border-green-500/30',
    intermediate: 'border-yellow-500/30',
    advanced: 'border-red-500/30',
  };

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { label: lang === 'bangla' ? 'মোট' : 'Total', value: conceptMap.total, color: 'text-foreground' },
          { label: lang === 'bangla' ? 'আয়ত্ত' : 'Mastered', value: conceptMap.mastered, color: 'text-green-500' },
          { label: lang === 'bangla' ? 'শিখছি' : 'Learning', value: conceptMap.learning, color: 'text-yellow-500' },
          { label: lang === 'bangla' ? 'দুর্বল' : 'Weak', value: conceptMap.weak, color: 'text-destructive' },
        ].map((s, i) => (
          <div key={i} className="p-2 rounded-lg bg-background/50 border border-border/30">
            <p className={cn('text-lg font-bold', s.color)}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tiered concept graph */}
      {(['foundational', 'intermediate', 'advanced'] as const).map((tier) => {
        const tierNodes = tiers[tier];
        if (tierNodes.length === 0) return null;
        return (
          <div key={tier} className={cn('p-3 rounded-xl border bg-background/30', tierColors[tier])}>
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
              {tierLabels[tier]} ({tierNodes.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {tierNodes.map((node) => (
                <div
                  key={node.id}
                  className={cn(
                    'group relative px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-default',
                    getStatusColor(node.status),
                    node.is_weak && 'ring-2 ring-destructive/50 animate-pulse'
                  )}
                  title={`${node.name} — ${node.mastery !== null ? `${node.mastery}%` : 'Not started'} | Difficulty: ${node.difficulty}/10`}
                >
                  <span className="mr-1">{getStatusIcon(node.status)}</span>
                  {node.name}
                  {node.mastery !== null && (
                    <span className="ml-1 opacity-75">({node.mastery}%)</span>
                  )}
                  {node.trend === 'improving' && <span className="ml-0.5">↑</span>}
                  {node.trend === 'declining' && <span className="ml-0.5">↓</span>}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Connection lines legend */}
      <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground justify-center pt-1">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> {lang === 'bangla' ? 'আয়ত্ত' : 'Mastered'}</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" /> {lang === 'bangla' ? 'শিখছি' : 'Learning'}</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-destructive inline-block" /> {lang === 'bangla' ? 'দুর্বল' : 'Weak'}</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-muted inline-block" /> {lang === 'bangla' ? 'শুরু হয়নি' : 'Not started'}</span>
      </div>
    </div>
  );
}
