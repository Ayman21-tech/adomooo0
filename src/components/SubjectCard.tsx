import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCategoryBySubjectId } from '@/data/subjects';

interface SubjectCardProps {
  id: string;
  name: string;
  selected?: boolean;
  onClick?: () => void;
  showCategory?: boolean;
  variant?: 'selectable' | 'display';
  className?: string;
}

export function SubjectCard({
  id,
  name,
  selected = false,
  onClick,
  showCategory = false,
  variant = 'selectable',
  className,
}: SubjectCardProps) {
  const category = getCategoryBySubjectId(id);
  const isSelectable = variant === 'selectable';

  return (
    <button
      onClick={onClick}
      disabled={!isSelectable}
      className={cn(
        'relative w-full p-4 rounded-xl text-left transition-all duration-300',
        'border-2 group',
        isSelectable && 'active:scale-[0.98] cursor-pointer',
        !isSelectable && 'cursor-default',
        selected
          ? 'bg-primary/10 border-primary glow-sm'
          : 'bg-card border-border hover:border-primary/50 hover:bg-primary/5',
        isSelectable && !selected && 'card-hover',
        className
      )}
    >
      <div className="flex items-center gap-3">
        {category && (
          <span className="text-2xl">{category.icon}</span>
        )}
        <div className="flex-1 min-w-0">
          <p className={cn(
            'font-medium truncate transition-colors',
            selected ? 'text-primary' : 'text-card-foreground'
          )}>
            {name}
          </p>
          {showCategory && category && (
            <p className="text-xs text-muted-foreground mt-0.5">{category.name}</p>
          )}
        </div>
        {isSelectable && (
          <div
            className={cn(
              'h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all duration-200',
              selected
                ? 'bg-primary border-primary'
                : 'border-muted-foreground/30 group-hover:border-primary/50'
            )}
          >
            {selected && (
              <Check className="h-3 w-3 text-primary-foreground scale-in" />
            )}
          </div>
        )}
      </div>
    </button>
  );
}
