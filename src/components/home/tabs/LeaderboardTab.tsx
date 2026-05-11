import { useEffect } from 'react';
import { useGamification } from '@/hooks/useGamification';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Star, Loader2, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser } from '@/contexts/UserContext';

export function LeaderboardTab() {
  const { leaderboard, isLoading, fetchLeaderboard } = useGamification();
  const { user } = useUser();

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  if (isLoading && leaderboard.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Fetching global rankings...</p>
      </div>
    );
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Trophy className="w-5 h-5 text-yellow-500" />;
      case 2: return <Medal className="w-5 h-5 text-slate-400" />;
      case 3: return <Medal className="w-5 h-5 text-amber-600" />;
      default: return <span className="text-xs font-bold text-muted-foreground w-5 text-center">{rank}</span>;
    }
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold gradient-text">Global Leaderboard</h2>
        <p className="text-sm text-muted-foreground">See how you rank against students nationwide</p>
      </div>

      <div className="grid gap-3">
        {leaderboard.map((entry) => {
          const isCurrentUser = entry.user_id === user.id;
          
          return (
            <Card 
              key={entry.user_id} 
              className={cn(
                "overflow-hidden transition-all duration-300",
                isCurrentUser ? "ring-2 ring-primary bg-primary/5 shadow-lg scale-[1.02]" : "glass-card border-border/40"
              )}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className="shrink-0 w-8 flex justify-center">
                  {getRankIcon(entry.rank)}
                </div>
                
                <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center font-bold text-primary-foreground text-sm shrink-0">
                  {entry.name.charAt(0).toUpperCase() || 'U'}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-sm truncate">{entry.name || 'Anonymous Student'}</h4>
                    {isCurrentUser && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-primary/20 text-primary border-primary/20">
                        You
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-yellow-500" />
                      Level {entry.current_level}
                    </span>
                    <span className="flex items-center gap-1 font-medium text-foreground/80">
                      <TrendingUp className="w-3 h-3" />
                      {entry.total_xp.toLocaleString()} XP
                    </span>
                  </div>
                </div>

                {entry.rank <= 3 && (
                  <div className="hidden sm:block">
                     <div className="w-8 h-8 rounded-full bg-background/50 flex items-center justify-center animate-pulse">
                        <Trophy className={cn(
                          "w-4 h-4",
                          entry.rank === 1 ? "text-yellow-500" : entry.rank === 2 ? "text-slate-400" : "text-amber-600"
                        )} />
                     </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {leaderboard.length === 0 && !isLoading && (
        <div className="text-center py-12 bg-muted/30 rounded-2xl border border-dashed border-border/60">
          <p className="text-muted-foreground">No students on the leaderboard yet. Start learning to be the first!</p>
        </div>
      )}
    </div>
  );
}
