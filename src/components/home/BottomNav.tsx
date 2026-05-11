import { TrendingUp, BookOpen, Upload, GraduationCap, Settings, BookA, Trophy, Award } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser } from '@/contexts/UserContext';
import { t } from '@/i18n';

export type HomeTab = 'progress' | 'subjects' | 'syllabus' | 'prep' | 'exam' | 'leaderboard' | 'badges' | 'teacher' | 'settings';

interface BottomNavProps {
  activeTab: HomeTab;
  onTabChange: (tab: HomeTab) => void;
}

const tabConfig = [
  { id: 'progress' as const, labelKey: 'nav.progress', icon: TrendingUp },
  { id: 'subjects' as const, labelKey: 'nav.learn', icon: BookOpen },
  { id: 'syllabus' as const, labelKey: 'nav.books', icon: Upload },
  { id: 'leaderboard' as const, label: 'Rank', icon: Trophy },
  { id: 'badges' as const, label: 'Badges', icon: Award },
  { id: 'prep' as const, labelKey: 'nav.prep', icon: BookA },
  { id: 'exam' as const, labelKey: 'nav.exam', icon: GraduationCap },
  { id: 'teacher' as const, label: 'Teacher', icon: GraduationCap },
  { id: 'settings' as const, labelKey: 'nav.settings', icon: Settings },
];

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const { user } = useUser();
  const lang = user.default_language;

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-background/90 backdrop-blur-xl safe-area-pb"
      role="navigation"
      aria-label="Primary Navigation"
    >
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-1 overflow-x-auto">
        {tabConfig.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const label = 'labelKey' in tab ? t(tab.labelKey!, lang) : tab.label;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'flex flex-col items-center justify-center flex-1 min-w-0 py-1.5 gap-0.5 transition-all duration-200 rounded-xl press outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
            >
              <div
                className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200',
                  isActive && 'gradient-primary glow-sm'
                )}
                aria-hidden="true"
              >
                <Icon
                  className={cn(
                    'w-[16px] h-[16px] transition-all duration-200',
                    isActive ? 'text-primary-foreground' : ''
                  )}
                />
              </div>
              <span
                className={cn(
                  'text-[9px] font-medium transition-all duration-200 leading-none truncate',
                  isActive && 'font-semibold text-primary'
                )}
                aria-hidden="true"
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
