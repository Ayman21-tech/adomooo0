import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SettingsItemProps {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onClick?: () => void;
  variant?: 'default' | 'destructive';
  showArrow?: boolean;
}

export function SettingsItem({
  icon,
  label,
  value,
  onClick,
  variant = 'default',
  showArrow = true,
}: SettingsItemProps) {
  const isClickable = !!onClick;

  return (
    <button
      onClick={onClick}
      disabled={!isClickable}
      className={cn(
        'w-full flex items-center gap-4 p-4 rounded-xl transition-all duration-200',
        isClickable && 'hover:bg-muted/50 active:scale-[0.99] cursor-pointer',
        !isClickable && 'cursor-default',
        variant === 'destructive' && 'text-destructive hover:bg-destructive/10'
      )}
    >
      <span className={cn(
        'text-muted-foreground',
        variant === 'destructive' && 'text-destructive'
      )}>
        {icon}
      </span>
      <span className={cn(
        'flex-1 text-left font-medium',
        variant === 'default' && 'text-card-foreground',
        variant === 'destructive' && 'text-destructive'
      )}>
        {label}
      </span>
      {value && (
        <span className="text-sm text-muted-foreground">{value}</span>
      )}
      {isClickable && showArrow && variant === 'default' && (
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      )}
    </button>
  );
}
