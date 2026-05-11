import { Globe, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useUser, SUPPORTED_LANGUAGES } from '@/contexts/UserContext';
import { toast } from '@/hooks/use-toast';
import adomoLogo from '@/assets/protibha-logo.png';
import { useGamificationStats } from '@/contexts/GamificationContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';

interface HomeHeaderProps {
  title?: string;
}

export function HomeHeader({ title }: HomeHeaderProps) {
  const { user, updateUser } = useUser();
  const { totalXp, level } = useGamificationStats();

  const currentLevelStartXP = Math.pow(level - 1, 2) * 100;
  const nextLevelStartXP = Math.pow(level, 2) * 100;
  const xpInCurrentLevel = totalXp - currentLevelStartXP;
  const xpNeededForNextLevel = Math.max(1, nextLevelStartXP - currentLevelStartXP);
  const progressPercent = Math.min(100, (xpInCurrentLevel / xpNeededForNextLevel) * 100);

  const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === user.preferred_language) || SUPPORTED_LANGUAGES[0];

  const selectLanguage = async (code: string) => {
    const lang = SUPPORTED_LANGUAGES.find(l => l.code === code);
    if (!lang) return;

    updateUser({ preferred_language: code });

    // Persist to DB
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      await supabase
        .from('profiles')
        .update({ preferred_language: code } as any)
        .eq('user_id', authUser.id);
    }

    toast({
      title: `Language: ${lang.label}`,
      description: 'AI responses will now use this language',
    });
  };

  return (
    <header 
      className="sticky top-0 z-50 bg-background/85 backdrop-blur-xl border-b border-border/40"
      role="banner"
    >
      <div className="container max-w-2xl flex items-center justify-between h-14 px-4">
        {/* Logo + title */}
        <div className="flex items-center gap-2.5 min-w-0" role="img" aria-label="Adomo AI Logo">
          <img
            src={adomoLogo}
            alt=""
            className="w-9 h-9 object-contain shrink-0"
            aria-hidden="true"
          />
          <span className="font-semibold text-sm truncate gradient-text leading-none">
            {title || 'Adomo AI'}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <div 
            className="hidden sm:flex flex-col items-end mr-2"
            role="progressbar"
            aria-valuenow={Math.round(progressPercent)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Level ${level} progress: ${Math.round(progressPercent)}%`}
          >
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">
              <TrendingUp className="w-2.5 h-2.5 text-primary" aria-hidden="true" />
              Level {level}
            </div>
            <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden border border-border/40">
              <div 
                className="h-full gradient-primary transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg h-8 px-2.5 text-xs gap-1.5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                aria-label={`Change language. Current: ${currentLang.label}`}
              >
                <span aria-hidden="true">{currentLang.flag}</span>
                <Globe className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto w-44">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <DropdownMenuItem
                  key={lang.code}
                  onClick={() => selectLanguage(lang.code)}
                  className={user.preferred_language === lang.code ? 'bg-accent' : ''}
                  aria-label={`Switch to ${lang.label}`}
                >
                  <span className="mr-2" aria-hidden="true">{lang.flag}</span>
                  <span className="text-sm">{lang.label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <ThemeToggle />
          <div 
            className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground"
            aria-label={`User profile: ${user.name}`}
          >
            {user.name.charAt(0).toUpperCase() || 'U'}
          </div>
        </div>
      </div>
    </header>
  );
}
