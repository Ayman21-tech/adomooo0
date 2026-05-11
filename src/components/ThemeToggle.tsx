import { forwardRef } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  className?: string;
}

export const ThemeToggle = forwardRef<HTMLButtonElement, ThemeToggleProps>(
  ({ className }, ref) => {
    const { user, updateUser } = useUser();
    const isDark = user.theme === 'dark';

    const toggleTheme = () => {
      updateUser({ theme: isDark ? 'light' : 'dark' });
    };

    return (
      <button
        ref={ref}
        onClick={toggleTheme}
        className={cn(
          'relative h-8 w-8 rounded-lg bg-secondary/60 flex items-center justify-center',
          'transition-all duration-200 hover:bg-secondary active:scale-95',
          'focus:outline-none focus:ring-2 focus:ring-ring/40',
          className
        )}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        <Sun
          className={cn(
            'h-4 w-4 absolute transition-all duration-200',
            isDark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100 text-primary'
          )}
        />
        <Moon
          className={cn(
            'h-4 w-4 absolute transition-all duration-200',
            isDark ? 'rotate-0 scale-100 opacity-100 text-primary' : '-rotate-90 scale-0 opacity-0'
          )}
        />
      </button>
    );
  }
);

ThemeToggle.displayName = 'ThemeToggle';
