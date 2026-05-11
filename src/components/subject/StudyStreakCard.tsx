import { Flame, Calendar, Award, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useStudyStreak } from '@/hooks/useStudyStreak';

export function StudyStreakCard() {
  const { streak, loading } = useStudyStreak();

  if (loading) {
    return (
      <Card className="border-border/30 bg-card/50 backdrop-blur-sm">
        <CardContent className="pt-5">
          <div className="animate-pulse space-y-3">
            <div className="h-8 w-24 bg-muted rounded-lg" />
            <div className="h-4 w-32 bg-muted rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentStreak = streak?.current_streak || 0;
  const longestStreak = streak?.longest_streak || 0;
  const totalDays = streak?.total_study_days || 0;

  const getStreakEmoji = (days: number) => {
    if (days >= 30) return '🔥';
    if (days >= 14) return '⚡';
    if (days >= 7) return '✨';
    if (days >= 3) return '🌟';
    return '💫';
  };

  const getStreakMessage = (days: number) => {
    if (days >= 30) return "You're on fire! 🔥";
    if (days >= 14) return "Incredible dedication!";
    if (days >= 7) return "A week of learning!";
    if (days >= 3) return "Building momentum!";
    if (days >= 1) return "Great start!";
    return "Start your streak today!";
  };

  return (
    <Card className="border-border/30 bg-card/50 backdrop-blur-sm overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
      <CardContent className="pt-5 relative">
        <div className="flex items-center gap-4">
          {/* Streak Fire */}
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-500/10 flex items-center justify-center">
              <Flame className="w-8 h-8 text-orange-500" />
            </div>
            {currentStreak > 0 && (
              <div className="absolute -top-1 -right-1 w-7 h-7 gradient-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold glow-sm">
                {currentStreak}
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{currentStreak}</span>
              <span className="text-lg">{getStreakEmoji(currentStreak)}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {getStreakMessage(currentStreak)}
            </p>
          </div>
        </div>

        {/* Additional Stats */}
        <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-border/30">
          <div className="text-center p-2 rounded-xl bg-muted/30">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <TrendingUp className="w-3 h-3" />
            </div>
            <div className="text-lg font-bold">{longestStreak}</div>
            <div className="text-[10px] text-muted-foreground">Best Streak</div>
          </div>
          <div className="text-center p-2 rounded-xl bg-muted/30">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Calendar className="w-3 h-3" />
            </div>
            <div className="text-lg font-bold">{totalDays}</div>
            <div className="text-[10px] text-muted-foreground">Total Days</div>
          </div>
          <div className="text-center p-2 rounded-xl bg-muted/30">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Award className="w-3 h-3" />
            </div>
            <div className="text-lg font-bold">{currentStreak >= 7 ? '🏆' : '🎯'}</div>
            <div className="text-[10px] text-muted-foreground">Status</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
