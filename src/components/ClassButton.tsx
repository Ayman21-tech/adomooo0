import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ClassButtonProps {
  label: string;
  selected: boolean;
  onClick: () => void;
}

export function ClassButton({ label, selected, onClick }: ClassButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative px-4 py-4 rounded-2xl font-semibold text-sm transition-all duration-300',
        'border-2 press',
        selected
          ? 'gradient-primary text-primary-foreground border-transparent glow-sm'
          : 'bg-card/50 backdrop-blur-sm text-card-foreground border-border/50 hover:border-primary/30 hover:bg-primary/5'
      )}
    >
      {label}
      {selected && (
        <span className="absolute -top-1.5 -right-1.5 h-6 w-6 gradient-primary rounded-full flex items-center justify-center scale-in shadow-lg">
          <Check className="h-3.5 w-3.5 text-primary-foreground" />
        </span>
      )}
    </button>
  );
}
