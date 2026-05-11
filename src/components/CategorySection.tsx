import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SubjectCard } from './SubjectCard';
import type { Category } from '@/data/subjects';

interface CategorySectionProps {
  category: Category;
  selectedSubjects: string[];
  onToggleSubject: (subjectId: string) => void;
  defaultOpen?: boolean;
}

export function CategorySection({
  category,
  selectedSubjects,
  onToggleSubject,
  defaultOpen = true,
}: CategorySectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const selectedCount = category.subjects.filter(s => selectedSubjects.includes(s.id)).length;

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{category.icon}</span>
          <span className="font-semibold text-card-foreground">{category.name}</span>
          {selectedCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary/10 text-primary">
              {selectedCount}
            </span>
          )}
        </div>
        <ChevronDown
          className={cn(
            'h-5 w-5 text-muted-foreground transition-transform duration-300',
            isOpen && 'rotate-180'
          )}
        />
      </button>
      
      <div
        className={cn(
          'grid gap-2 px-4 transition-all duration-300 ease-out overflow-hidden',
          isOpen ? 'pb-4 max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        {category.subjects.map((subject) => (
          <SubjectCard
            key={subject.id}
            id={subject.id}
            name={subject.name}
            selected={selectedSubjects.includes(subject.id)}
            onClick={() => onToggleSubject(subject.id)}
          />
        ))}
      </div>
    </div>
  );
}
