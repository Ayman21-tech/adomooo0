import { LayoutDashboard, Users, ClipboardList, MessageCircle, CheckSquare, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TeacherTab = 'dashboard' | 'classes' | 'homework' | 'chat' | 'checking' | 'settings';

interface TeacherBottomNavProps {
  activeTab: TeacherTab;
  onTabChange: (tab: TeacherTab) => void;
}

const tabConfig = [
  { id: 'dashboard' as const, label: 'Home', icon: LayoutDashboard },
  { id: 'classes' as const, label: 'Classes', icon: Users },
  { id: 'homework' as const, label: 'Homework', icon: ClipboardList },
  { id: 'chat' as const, label: 'Chat', icon: MessageCircle },
  { id: 'checking' as const, label: 'Checking', icon: CheckSquare },
  { id: 'settings' as const, label: 'Settings', icon: Settings },
];

export function TeacherBottomNav({ activeTab, onTabChange }: TeacherBottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-background/90 backdrop-blur-xl safe-area-pb">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-1 overflow-x-auto">
        {tabConfig.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'flex flex-col items-center justify-center flex-1 min-w-0 py-1.5 gap-0.5 transition-all duration-200 rounded-xl press',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <div
                className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200',
                  isActive && 'gradient-primary glow-sm'
                )}
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
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
