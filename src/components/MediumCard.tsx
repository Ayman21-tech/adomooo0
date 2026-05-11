import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MediumCardProps {
  icon: string;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}

export function MediumCard({ icon, title, description, selected, onClick }: MediumCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative w-full p-6 rounded-2xl text-left transition-all duration-300',
        'border-2 press',
        selected
          ? 'bg-primary/10 border-primary glow'
          : 'bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/30 hover:bg-primary/5 card-hover'
      )}
    >
      {/* Gradient overlay when selected */}
      {selected && (
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
      )}
      
      <div className="relative flex items-start gap-4">
        <div className={cn(
          'w-14 h-14 rounded-2xl flex items-center justify-center text-3xl transition-all',
          selected ? 'bg-primary/20' : 'bg-muted/50'
        )}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={cn(
            'font-semibold text-lg mb-1 transition-colors',
            selected ? 'text-primary' : 'text-card-foreground'
          )}>
            {title}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        </div>
        <div
          className={cn(
            'h-7 w-7 rounded-full border-2 flex items-center justify-center transition-all duration-300 shrink-0 mt-1',
            selected
              ? 'gradient-primary border-transparent glow-sm'
              : 'border-muted-foreground/30'
          )}
        >
          {selected && (
            <Check className="h-4 w-4 text-primary-foreground scale-in" />
          )}
        </div>
      </div>
    </button>
  );
}
