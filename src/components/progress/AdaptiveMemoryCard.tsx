import { useState } from 'react';
import { Brain, Clock, Database, Trash2, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface MemoryEntry {
  key: string;
  value: any;
}

interface AdaptiveMemoryCardProps {
  shortTermMemories: MemoryEntry[];
  longTermMemories: MemoryEntry[];
  lang: string;
  onMemoryCleared?: () => void;
}

function formatMemoryValue(value: any): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? '✓' : '✗';
  if (Array.isArray(value)) return value.slice(0, 3).join(', ') + (value.length > 3 ? '…' : '');
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).slice(0, 3);
    return keys.map(k => `${k}: ${typeof value[k] === 'object' ? '…' : value[k]}`).join(', ');
  }
  return '—';
}

function formatMemoryKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/^(book|ocr|chapter|page)\s/i, '')
    .replace(/\b\w/g, l => l.toUpperCase());
}

function MemoryItem({ 
  entry, 
  type, 
  onDelete 
}: { 
  entry: MemoryEntry; 
  type: 'short' | 'long'; 
  onDelete: (key: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete(entry.key);
    setDeleting(false);
  };

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-background/50 border border-border/30 group">
      <div className={cn(
        'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
        type === 'short' ? 'bg-yellow-500/10' : 'bg-primary/10'
      )}>
        {type === 'short' 
          ? <Clock className="w-4 h-4 text-yellow-500" /> 
          : <Database className="w-4 h-4 text-primary" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{formatMemoryKey(entry.key)}</p>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
          {formatMemoryValue(entry.value)}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={handleDelete}
        disabled={deleting}
      >
        {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />}
      </Button>
    </div>
  );
}

export function AdaptiveMemoryCard({ shortTermMemories, longTermMemories, lang, onMemoryCleared }: AdaptiveMemoryCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Filter out book/OCR content memories from display (too large, not useful to show)
  const displayShort = shortTermMemories.filter(m => 
    !m.key.startsWith('book_content_') && !m.key.startsWith('ocr_') && !m.key.startsWith('chapter_content_')
  );
  const displayLong = longTermMemories.filter(m => 
    !m.key.startsWith('book_content_') && !m.key.startsWith('ocr_') && !m.key.startsWith('chapter_content_')
  );

  const totalVisible = displayShort.length + displayLong.length;

  if (totalVisible === 0) {
    return (
      <Card className="border-border/40 bg-card/70 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <Brain className="w-4 h-4 text-primary" />
            </div>
            {lang === 'bangla' ? 'অভিযোজিত মেমোরি' : 'Adaptive Memory'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            {lang === 'bangla' 
              ? 'AI টিউটরের সাথে কথা বলুন — আপনার শেখার ধরন মনে রাখা হবে।' 
              : 'Chat with the AI tutor — your learning patterns will be remembered.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleDeleteMemory = async (key: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await supabase
        .from('adaptive_memory')
        .delete()
        .eq('user_id', session.user.id)
        .eq('key', key);

      toast({
        title: lang === 'bangla' ? 'মেমোরি মুছে ফেলা হয়েছে' : 'Memory cleared',
        description: lang === 'bangla' ? 'AI এটি আবার শিখবে।' : 'The AI will re-learn this pattern.',
      });

      onMemoryCleared?.();
    } catch {
      toast({ title: 'Error', description: 'Failed to clear memory', variant: 'destructive' });
    }
  };

  const visibleItems = expanded ? totalVisible : Math.min(4, totalVisible);
  const allItems = [...displayShort.map(e => ({ ...e, type: 'short' as const })), ...displayLong.map(e => ({ ...e, type: 'long' as const }))];

  return (
    <Card className="border-border/40 bg-card/70 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <Brain className="w-4 h-4 text-primary" />
          </div>
          {lang === 'bangla' ? 'অভিযোজিত মেমোরি' : 'Adaptive Memory'}
          <div className="flex gap-1.5 ml-auto">
            <Badge variant="secondary" className="text-xs">
              <Clock className="w-3 h-3 mr-1" />
              {displayShort.length}
            </Badge>
            <Badge variant="outline" className="text-xs border-primary/30">
              <Database className="w-3 h-3 mr-1" />
              {displayLong.length}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {allItems.slice(0, visibleItems).map((item, i) => (
          <MemoryItem key={`${item.type}-${item.key}-${i}`} entry={item} type={item.type} onDelete={handleDeleteMemory} />
        ))}

        {totalVisible > 4 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5 mr-1" /> : <ChevronDown className="w-3.5 h-3.5 mr-1" />}
            {expanded 
              ? (lang === 'bangla' ? 'কম দেখুন' : 'Show less') 
              : (lang === 'bangla' ? `আরও ${totalVisible - 4}টি দেখুন` : `Show ${totalVisible - 4} more`)}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
