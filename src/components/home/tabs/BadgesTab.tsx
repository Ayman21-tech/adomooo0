import { useEffect, useState } from 'react';
import { useGamification, type Badge as BadgeType } from '@/hooks/useGamification';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Lock, Award, Calendar, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

export function BadgesTab() {
  const { badges, isLoading, fetchUserBadges } = useGamification();
  const [allBadges, setAllBadges] = useState<BadgeType[]>([]);
  const [isFetchingAll, setIsFetchingAll] = useState(false);

  useEffect(() => {
    fetchUserBadges();
    
    // Fetch all available badges to show locked ones
    const fetchAllAvailable = async () => {
      setIsFetchingAll(true);
      const { data, error } = await supabase
        .from('badges')
        .select('*')
        .order('rarity', { ascending: false });
      
      if (!error && data) {
        setAllBadges(data as BadgeType[]);
      }
      setIsFetchingAll(false);
    };

    fetchAllAvailable();
  }, [fetchUserBadges]);

  if ((isLoading || isFetchingAll) && allBadges.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Polishing your trophies...</p>
      </div>
    );
  }

  const earnedBadgeIds = new Set(badges.map(b => b.id));

  return (
    <div className="space-y-6 pb-24">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold gradient-text">Your Achievements</h2>
        <p className="text-sm text-muted-foreground">Unlock badges by reaching learning milestones</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {allBadges.map((badge) => {
          const isEarned = earnedBadgeIds.has(badge.id);
          const earnedInfo = badges.find(b => b.id === badge.id);
          
          return (
            <Card 
              key={badge.id} 
              className={cn(
                "group relative overflow-hidden transition-all duration-500",
                isEarned 
                  ? "border-primary/30 bg-primary/5 hover:shadow-lg hover:shadow-primary/10 hover:scale-[1.05] cursor-default" 
                  : "grayscale opacity-60 border-dashed border-muted-foreground/30"
              )}
            >
              <CardContent className="p-4 flex flex-col items-center text-center space-y-3">
                <div className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-inner transition-transform group-hover:rotate-12 duration-500",
                  isEarned ? "gradient-primary text-white" : "bg-muted text-muted-foreground"
                )}>
                  {isEarned ? (badge.icon_url || '🏆') : <Lock className="w-8 h-8 opacity-40" />}
                </div>

                <div className="space-y-1">
                  <h4 className="font-bold text-xs leading-tight min-h-[2rem] flex items-center justify-center">
                    {badge.name}
                  </h4>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-[9px] h-4 px-1.5 uppercase tracking-tighter",
                      badge.rarity === 'legendary' ? "border-yellow-500 text-yellow-500 bg-yellow-500/5" :
                      badge.rarity === 'epic' ? "border-purple-500 text-purple-500 bg-purple-500/5" :
                      badge.rarity === 'rare' ? "border-blue-500 text-blue-500 bg-blue-500/5" :
                      "border-muted-foreground/30 text-muted-foreground"
                    )}
                  >
                    {badge.rarity}
                  </Badge>
                </div>

                <p className="text-[10px] text-muted-foreground leading-tight line-clamp-2">
                  {badge.description}
                </p>

                {isEarned && earnedInfo?.earned_at && (
                  <div className="flex items-center gap-1 text-[9px] text-primary/80 font-medium">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Unlocked</span>
                  </div>
                )}
              </CardContent>
              
              {!isEarned && (
                <div className="absolute inset-0 bg-background/5 backdrop-blur-[1px] pointer-events-none" />
              )}
            </Card>
          );
        })}
      </div>

      {allBadges.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <Award className="w-12 h-12 text-muted mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">No badges discovered yet.</p>
        </div>
      )}
    </div>
  );
}
