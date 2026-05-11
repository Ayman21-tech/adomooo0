import { useState, useEffect } from 'react';
import {
  GraduationCap, Timer, FlaskConical, ArrowLeft,
  ChevronRight, Loader2, Zap, Brain, Target, ListChecks
} from 'lucide-react';
import { useLearningEngine } from '@/hooks/useLearningEngine';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ExamSetupProps {
  subjectName: string;
  chapterName?: string;
  onStart: (config: ExamConfig) => void;
  onBack: () => void;
  isLoading: boolean;
}

export interface ExamConfig {
  examType: 'practice-exam' | 'real-exam' | 'question-lab';
  questionCount: number;
  timeLimitMinutes?: number;
  questionTypes: QuestionType[];
  questionTypeCounts: Record<QuestionType, number>;
}

export type QuestionType =
  | 'mcq'
  | 'fill-in-the-blanks'
  | 'true-or-false'
  | 'one-word'
  | 'make-sentence'
  | 'abbreviation';

const QUESTION_TYPE_OPTIONS: { id: QuestionType; label: string; emoji: string }[] = [
  { id: 'mcq', label: 'Tick the Correct Answer', emoji: '✅' },
  { id: 'fill-in-the-blanks', label: 'Fill in the Blanks', emoji: '📝' },
  { id: 'true-or-false', label: 'True or False', emoji: '⚖️' },
  { id: 'one-word', label: 'Answer in One Word', emoji: '💬' },
  { id: 'make-sentence', label: 'Make Sentence', emoji: '✍️' },
  { id: 'abbreviation', label: 'Abbreviation / Full Form', emoji: '🔤' },
];

const EXAM_MODES = [
  {
    id: 'practice-exam' as const,
    title: 'Practice Exam',
    emoji: '🎓',
    description: 'Hints available, explanations after each answer',
    features: ['Show hints', 'Instant feedback', 'No time pressure'],
    color: 'border-primary/30 hover:border-primary/60 hover:bg-primary/5',
    activeColor: 'border-primary bg-primary/10 shadow-glow',
    icon: GraduationCap,
    defaultTime: undefined,
  },
  {
    id: 'real-exam' as const,
    title: 'Real Exam',
    emoji: '⏱️',
    description: 'Timed simulation, no hints, exam conditions',
    features: ['Countdown timer', 'No hints', 'Auto-submit'],
    color: 'border-destructive/30 hover:border-destructive/60 hover:bg-destructive/5',
    activeColor: 'border-destructive bg-destructive/10',
    icon: Timer,
    defaultTime: 40,
  },
  {
    id: 'question-lab' as const,
    title: 'Question Lab',
    emoji: '🔬',
    description: 'Custom question count, flexible practice',
    features: ['Choose count', 'Mixed difficulty', 'Flexible'],
    color: 'border-secondary hover:border-primary/40 hover:bg-secondary/50',
    activeColor: 'border-primary bg-secondary/50',
    icon: FlaskConical,
    defaultTime: undefined,
  },
];

export function ExamSetup({ subjectName, chapterName, onStart, onBack, isLoading }: ExamSetupProps) {
  const { profile, getStudentProfile } = useLearningEngine();
  const [selectedMode, setSelectedMode] = useState<ExamConfig['examType']>('practice-exam');
  const [selectedTypes, setSelectedTypes] = useState<QuestionType[]>(['mcq']);
  const [difficultyHint, setDifficultyHint] = useState<string | null>(null);

  // Fetch student profile for difficulty suggestion
  useEffect(() => {
    const subjectId = subjectName.toLowerCase().replace(/\s+/g, '-');
    getStudentProfile(subjectId).then(p => {
      if (p?.recommended_difficulty_label) {
        setDifficultyHint(p.recommended_difficulty_label);
      }
    }).catch(() => {});
  }, [subjectName, getStudentProfile]);
  const [typeCounts, setTypeCounts] = useState<Record<QuestionType, number>>({
    'mcq': 5,
    'fill-in-the-blanks': 3,
    'true-or-false': 3,
    'one-word': 2,
    'make-sentence': 2,
    'abbreviation': 2,
  });

  const currentMode = EXAM_MODES.find(m => m.id === selectedMode)!;

  const toggleType = (type: QuestionType) => {
    setSelectedTypes(prev =>
      prev.includes(type)
        ? prev.length > 1 ? prev.filter(t => t !== type) : prev
        : [...prev, type]
    );
  };

  const updateTypeCount = (type: QuestionType, delta: number) => {
    setTypeCounts(prev => ({
      ...prev,
      [type]: Math.max(1, Math.min(20, (prev[type] || 2) + delta)),
    }));
  };

  const totalQuestions = selectedTypes.reduce((sum, t) => sum + (typeCounts[t] || 2), 0);

  const handleStart = () => {
    const counts: Record<QuestionType, number> = {} as any;
    selectedTypes.forEach(t => { counts[t] = typeCounts[t] || 2; });

    onStart({
      examType: selectedMode,
      questionCount: totalQuestions,
      timeLimitMinutes: selectedMode === 'real-exam' ? Math.max(totalQuestions * 2, 15) : undefined,
      questionTypes: selectedTypes,
      questionTypeCounts: counts,
    });
  };

  return (
    <div className="space-y-4 pb-20 page-enter">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h2 className="font-semibold">{subjectName}</h2>
          <p className="text-xs text-muted-foreground">{chapterName || 'All chapters'}</p>
        </div>
        <div className="flex gap-1.5">
          {difficultyHint && (
            <Badge variant="secondary" className="text-xs">
              AI: {difficultyHint === 'easy' ? '🟢 Easy' : difficultyHint === 'hard' ? '🔴 Hard' : '🟡 Medium'}
            </Badge>
          )}
          <Badge variant="outline" className="text-xs border-primary/30 text-primary">
            <Brain className="w-3 h-3 mr-1" /> Adaptive
          </Badge>
        </div>
      </div>

      {/* Title */}
      <div className="text-center py-2">
        <div className="w-14 h-14 mx-auto mb-3 rounded-2xl gradient-primary flex items-center justify-center">
          <Target className="w-7 h-7 text-primary-foreground" />
        </div>
        <h3 className="text-lg font-semibold">Set Up Your Exam</h3>
        <p className="text-sm text-muted-foreground">AI generates questions from your book content</p>
      </div>

      {/* Mode Selection */}
      <div className="space-y-3">
        <p className="text-sm font-medium">Exam Mode</p>
        {EXAM_MODES.map(mode => (
          <button
            key={mode.id}
            onClick={() => setSelectedMode(mode.id)}
            className={cn(
              'w-full p-4 rounded-xl border-2 text-left transition-all duration-200',
              selectedMode === mode.id ? mode.activeColor : mode.color,
            )}
          >
            <div className="flex items-start gap-3">
              <div className="text-2xl">{mode.emoji}</div>
              <div className="flex-1">
                <p className="font-semibold text-sm">{mode.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{mode.description}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {mode.features.map(f => (
                    <Badge key={f} variant="secondary" className="text-[10px]">{f}</Badge>
                  ))}
                </div>
              </div>
              {selectedMode === mode.id && (
                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Question Type Selection */}
      <Card className="glass-card border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-primary" />
            Question Types
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {QUESTION_TYPE_OPTIONS.map(opt => {
            const isSelected = selectedTypes.includes(opt.id);
            return (
              <div
                key={opt.id}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer',
                  isSelected
                    ? 'border-primary bg-primary/10'
                    : 'border-border/50 hover:border-primary/30'
                )}
                onClick={() => toggleType(opt.id)}
              >
                <span className="text-lg">{opt.emoji}</span>
                <span className="flex-1 text-sm font-medium">{opt.label}</span>

                {isSelected && (
                  <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                    <button
                      className="w-7 h-7 rounded-lg bg-muted hover:bg-muted-foreground/10 flex items-center justify-center text-sm font-bold transition-colors"
                      onClick={() => updateTypeCount(opt.id, -1)}
                    >−</button>
                    <span className="w-6 text-center text-sm font-semibold">{typeCounts[opt.id]}</span>
                    <button
                      className="w-7 h-7 rounded-lg bg-muted hover:bg-muted-foreground/10 flex items-center justify-center text-sm font-bold transition-colors"
                      onClick={() => updateTypeCount(opt.id, 1)}
                    >+</button>
                  </div>
                )}

                {!isSelected && (
                  <div className="w-5 h-5 rounded-full border-2 border-border shrink-0" />
                )}
                {isSelected && (
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Summary */}
      <Card className="glass-card border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="text-3xl">{currentMode.emoji}</div>
            <div className="flex-1">
              <p className="font-semibold text-sm">{currentMode.title}</p>
              <p className="text-xs text-muted-foreground">
                {totalQuestions} questions • {selectedTypes.length} type{selectedTypes.length > 1 ? 's' : ''} • {subjectName}
                {selectedMode === 'real-exam' && ` • ${Math.max(totalQuestions * 2, 15)} min`}
              </p>
            </div>
            <Badge variant="secondary" className="text-xs">
              <Zap className="w-3 h-3 mr-1" /> AI
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Start Button */}
      <Button
        className="w-full btn-premium text-primary-foreground rounded-xl h-12 text-base"
        onClick={handleStart}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Generating Questions...
          </>
        ) : (
          <>
            Start {currentMode.title}
            <ChevronRight className="w-5 h-5 ml-2" />
          </>
        )}
      </Button>
    </div>
  );
}
