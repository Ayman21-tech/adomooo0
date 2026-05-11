import { Play, CheckCircle2, Lock, BookOpen, FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useSyllabus } from '@/hooks/useSyllabus';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface LessonListProps {
  subjectId: string;
  subjectName: string;
  onSelectLesson?: (lessonId: string) => void;
}

export function LessonList({ subjectId, subjectName, onSelectLesson }: LessonListProps) {
  const { getChaptersBySubject, loading } = useSyllabus();
  const chapters = getChaptersBySubject(subjectId);
  
  const completedCount = 0;
  const progress = chapters.length > 0 ? (completedCount / chapters.length) * 100 : 0;

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (chapters.length === 0) {
    return (
      <Card className="border-dashed border-2 border-primary/30 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4 glow">
            <FileText className="w-8 h-8 text-primary-foreground" />
          </div>
          <h3 className="font-semibold mb-2">No Chapters Yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Add your syllabus chapters to start learning {subjectName}.
          </p>
          <p className="text-xs text-muted-foreground">
            Go to the Syllabus tab on the home screen to add chapters.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress Overview */}
      <Card className="border-border/30 bg-card/50 backdrop-blur-sm overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16" />
        <CardContent className="pt-5 relative">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Chapter Progress</span>
            <span className="text-sm text-muted-foreground">
              {completedCount}/{chapters.length} completed
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div 
              className="h-full gradient-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Chapter Cards */}
      <div className="space-y-3">
        {chapters.map((chapter, index) => {
          const isCompleted = false;
          const isLocked = false;

          return (
            <Card
              key={chapter.id}
              className={cn(
                'border-border/30 bg-card/50 backdrop-blur-sm transition-all duration-300 group overflow-hidden',
                isLocked 
                  ? 'opacity-60 cursor-not-allowed' 
                  : 'hover:border-primary/30 card-hover cursor-pointer'
              )}
              onClick={() => !isLocked && onSelectLesson?.(chapter.id)}
            >
              {/* Hover gradient */}
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <CardContent className="p-4 relative">
                <div className="flex gap-4">
                  {/* Chapter Number / Status */}
                  <div className={cn(
                    'w-12 h-12 rounded-2xl flex items-center justify-center shrink-0',
                    isCompleted 
                      ? 'bg-green-500/10' 
                      : isLocked 
                        ? 'bg-muted' 
                        : 'bg-gradient-to-br from-primary/20 to-primary/5'
                  )}>
                    {isCompleted ? (
                      <CheckCircle2 className="w-6 h-6 text-green-500" />
                    ) : isLocked ? (
                      <Lock className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <span className="text-lg font-bold gradient-text">{index + 1}</span>
                    )}
                  </div>

                  {/* Chapter Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-sm line-clamp-1">{chapter.chapter_name}</h3>
                      {!isLocked && !isCompleted && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs rounded-lg border-primary/30 text-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectLesson?.(chapter.id);
                          }}
                        >
                          <Play className="w-3 h-3 mr-1" />
                          Start
                        </Button>
                      )}
                    </div>
                    
                    {chapter.topics && chapter.topics.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {chapter.topics.join(', ')}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-3 mt-2">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <BookOpen className="w-3 h-3" />
                        Chapter {chapter.chapter_order + 1}
                      </span>
                      {chapter.upload_type && (
                        <Badge variant="secondary" className="text-xs rounded-lg">
                          {chapter.upload_type}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
