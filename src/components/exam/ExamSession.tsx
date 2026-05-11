import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft, Timer, CheckCircle2, XCircle, ChevronRight, ChevronLeft,
  RefreshCw, Loader2, Trophy, Target, TrendingUp, Lightbulb, BarChart3,
  Clock, Zap, BookOpen, AlertCircle, Eye, EyeOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { useAccessibility } from '@/contexts/AccessibilityContext';

export interface ExamQuestion {
  id: string;
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  topic: string;
  hint: string;
  question_type?: string;
}

interface ExamAnswer {
  questionId: string;
  selectedOption: number | null;
  isCorrect: boolean;
  timeSpent: number;
}

interface ExamSessionProps {
  questions: ExamQuestion[];
  examType: string;
  subjectName: string;
  chapterName?: string;
  difficultyLevel: string;
  weakAreasTargeted: string[];
  timeLimitMinutes?: number;
  onFinish: (results: ExamResults) => void;
  onBack: () => void;
  isPractice: boolean;
}

export interface ExamResults {
  totalQuestions: number;
  correctAnswers: number;
  timeTakenSeconds: number;
  answers: ExamAnswer[];
  questions: ExamQuestion[];
  examType: string;
  tabSwitchCount?: number;
  mistakes: Array<{
    question: string;
    studentAnswer: string;
    correctAnswer: string;
    topic: string;
    explanation: string;
  }>;
}

// ─── Timer Component ──────────────────────────────────────────────────────────
function ExamTimer({ totalSeconds, onTimeUp, isPaused }: { totalSeconds: number; onTimeUp: () => void; isPaused: boolean }) {
  const [remaining, setRemaining] = useState(totalSeconds);

  useEffect(() => {
    if (isPaused) return;
    if (remaining <= 0) { onTimeUp(); return; }
    const interval = setInterval(() => setRemaining(prev => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [remaining, isPaused, onTimeUp]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const progress = (remaining / totalSeconds) * 100;
  const isLow = remaining < 60;
  const isCritical = remaining < 30;

  return (
    <div 
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-mono font-semibold transition-colors',
        isCritical ? 'bg-destructive/15 border-destructive/40 text-destructive animate-pulse' :
        isLow ? 'bg-warning/15 border-warning/40 text-warning' :
        'bg-muted/50 border-border/50 text-foreground'
      )}
      role="timer"
      aria-label={`Remaining time: ${minutes} minutes and ${seconds} seconds`}
    >
      <Timer className="w-4 h-4" aria-hidden="true" />
      <span>{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</span>
      <Progress value={progress} className="w-16 h-1.5" aria-hidden="true" />
    </div>
  );
}

// ─── Main Exam Session ────────────────────────────────────────────────────────
export function ExamSession({
  questions,
  examType,
  subjectName,
  chapterName,
  difficultyLevel,
  weakAreasTargeted,
  timeLimitMinutes,
  onFinish,
  onBack,
  isPractice,
}: ExamSessionProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, ExamAnswer>>(new Map());
  const [showExplanation, setShowExplanation] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const questionStartRef = useRef(Date.now());
  const examStartRef = useRef(Date.now());
  const questionHeadingRef = useRef<HTMLHeadingElement>(null);
  
  const { screenReaderOptimized } = useAccessibility();

  // ─── Tab-focus tracking (Anti-cheat) ────────────────────────────────────────
  useEffect(() => {
    if (isFinished || isPractice) return;

    const handleBlur = () => {
      setTabSwitchCount(prev => prev + 1);
      setShowWarning(true);
      if (tabSwitchCount >= 2) {
        finishExam();
      }
    };

    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [isFinished, isPractice, tabSwitchCount]);

  const currentQuestion = questions[currentIndex];
  const currentAnswer = answers.get(currentQuestion?.id);
  const totalAnswered = answers.size;
  const progress = ((currentIndex + 1) / questions.length) * 100;

  const handleSelectAnswer = useCallback((optionIndex: number) => {
    if (currentAnswer) return;

    const timeSpent = Math.round((Date.now() - questionStartRef.current) / 1000);
    const isCorrect = optionIndex === currentQuestion.correct_answer;

    const answer: ExamAnswer = {
      questionId: currentQuestion.id,
      selectedOption: optionIndex,
      isCorrect,
      timeSpent,
    };

    setAnswers(prev => new Map(prev).set(currentQuestion.id, answer));

    if (isPractice) {
      setShowExplanation(true);
    }
  }, [currentAnswer, currentQuestion, isPractice]);

  const finishExam = useCallback(() => {
    const timeTaken = Math.round((Date.now() - examStartRef.current) / 1000);
    const answersArray = Array.from(answers.values());
    const correctCount = answersArray.filter(a => a.isCorrect).length;

    const mistakes = questions
      .filter(q => {
        const ans = answers.get(q.id);
        return ans && !ans.isCorrect;
      })
      .map(q => {
        const ans = answers.get(q.id)!;
        return {
          question: q.question,
          studentAnswer: q.options[ans.selectedOption!] || 'Skipped',
          correctAnswer: q.options[q.correct_answer],
          topic: q.topic,
          explanation: q.explanation,
        };
      });

    setIsFinished(true);
    onFinish({
      totalQuestions: questions.length,
      correctAnswers: correctCount,
      timeTakenSeconds: timeTaken,
      answers: answersArray,
      questions,
      examType,
      tabSwitchCount,
      mistakes,
    });
  }, [answers, questions, examType, tabSwitchCount, onFinish]);

  const handleNext = useCallback(() => {
    setShowExplanation(false);
    setShowHint(false);
    questionStartRef.current = Date.now();

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      // Focus the new question heading for screen readers
      setTimeout(() => questionHeadingRef.current?.focus(), 100);
    } else {
      finishExam();
    }
  }, [currentIndex, questions.length, finishExam]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setShowExplanation(false);
      setShowHint(false);
      setCurrentIndex(prev => prev - 1);
      setTimeout(() => questionHeadingRef.current?.focus(), 100);
    }
  }, [currentIndex]);

  const handleTimeUp = useCallback(() => {
    finishExam();
  }, [finishExam]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showWarning || isFinished) return;

      if (e.key >= '1' && e.key <= '4') {
        handleSelectAnswer(parseInt(e.key) - 1);
      } else if (e.key.toLowerCase() === 'a') handleSelectAnswer(0);
      else if (e.key.toLowerCase() === 'b') handleSelectAnswer(1);
      else if (e.key.toLowerCase() === 'c') handleSelectAnswer(2);
      else if (e.key.toLowerCase() === 'd') handleSelectAnswer(3);
      else if (e.key === 'ArrowRight' && currentAnswer) handleNext();
      else if (e.key === 'ArrowLeft') handlePrev();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentAnswer, handleSelectAnswer, handleNext, handlePrev, showWarning, isFinished]);

  if (isFinished) return null;

  const getDifficultyColor = (diff: string) => {
    switch (diff) {
      case 'easy': return 'bg-success/15 text-success border-success/30';
      case 'medium': return 'bg-warning/15 text-warning border-warning/30';
      case 'hard': return 'bg-destructive/15 text-destructive border-destructive/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="min-h-screen bg-background bg-pattern">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border/50">
        <div className="container flex items-center justify-between h-14 px-4 max-w-3xl">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onBack} 
            className="shrink-0"
            aria-label="Exit Exam"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <div className="flex-1 text-center mx-2" aria-live="polite">
            <h1 className="text-sm font-semibold truncate">{subjectName}</h1>
            <p className="text-[10px] text-muted-foreground truncate">
              {chapterName || 'All chapters'} • Question {currentIndex + 1} of {questions.length}
            </p>
          </div>

          {timeLimitMinutes ? (
            <ExamTimer
              totalSeconds={timeLimitMinutes * 60}
              onTimeUp={handleTimeUp}
              isPaused={false}
            />
          ) : (
            <Badge variant="outline" className="text-xs shrink-0" aria-label={`${totalAnswered} of ${questions.length} answered`}>
              {totalAnswered}/{questions.length}
            </Badge>
          )}
        </div>

        {/* Progress bar */}
        <Progress value={progress} className="h-1 rounded-none" aria-hidden="true" />
      </header>

      {/* Cheat Warning Modal */}
      {showWarning && (
        <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" role="alertdialog" aria-labelledby="warning-title">
          <Card className="max-w-md w-full border-destructive/50 bg-destructive/5">
            <CardHeader>
              <CardTitle id="warning-title" className="text-destructive flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Warning: Tab Switch Detected
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">
                You have left the exam tab {tabSwitchCount} time(s). 
                Leaving the exam tab is not allowed and may result in your exam being automatically submitted.
              </p>
              {tabSwitchCount >= 3 ? (
                <p className="text-sm font-semibold text-destructive">
                  Maximum warnings exceeded. Submitting exam...
                </p>
              ) : (
                <Button 
                  className="w-full" 
                  variant="destructive"
                  onClick={() => setShowWarning(false)}
                >
                  I Understand, Return to Exam
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Content */}
      <main className="container px-4 py-4 max-w-3xl pb-24" role="main">
        {/* Question card */}
        <Card className="glass-card border-border/50 mb-4">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Badge 
                  variant="outline" 
                  className={cn('text-xs', getDifficultyColor(currentQuestion.difficulty))}
                  aria-label={`Difficulty: ${currentQuestion.difficulty}`}
                >
                  {currentQuestion.difficulty === 'easy' ? '🟢' : currentQuestion.difficulty === 'medium' ? '🟡' : '🔴'} {currentQuestion.difficulty}
                </Badge>
                {currentQuestion.question_type && currentQuestion.question_type !== 'mcq' && (
                  <Badge variant="secondary" className="text-xs capitalize">
                    {currentQuestion.question_type.replace(/-/g, ' ')}
                  </Badge>
                )}
              </div>
              <Badge variant="secondary" className="text-xs" aria-label={`Topic: ${currentQuestion.topic}`}>
                {currentQuestion.topic}
              </Badge>
            </div>
            <CardTitle 
              ref={questionHeadingRef}
              tabIndex={-1}
              className="text-base sm:text-lg leading-relaxed font-medium outline-none"
            >
              <span className="sr-only">Question {currentIndex + 1}: </span>
              {currentQuestion.question}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-2.5" role="radiogroup" aria-label="Select one option">
            {currentQuestion.options.map((option, index) => {
              const isSelected = currentAnswer?.selectedOption === index;
              const isCorrect = index === currentQuestion.correct_answer;
              const showResult = !!currentAnswer;

              return (
                <button
                  key={index}
                  onClick={() => handleSelectAnswer(index)}
                  disabled={!!currentAnswer}
                  role="radio"
                  aria-checked={isSelected}
                  className={cn(
                    'w-full text-left p-3.5 rounded-xl border-2 transition-all duration-200 flex items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                    showResult && isCorrect && 'bg-success/10 border-success/50',
                    showResult && isSelected && !isCorrect && 'bg-destructive/10 border-destructive/50',
                    showResult && !isSelected && !isCorrect && 'opacity-40 border-border/30',
                    !showResult && 'border-border/50 hover:border-primary/40 hover:bg-primary/5 active:scale-[0.98]',
                    !showResult && 'cursor-pointer',
                  )}
                >
                  <span className={cn(
                    'w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-semibold shrink-0 transition-colors',
                    showResult && isCorrect && 'bg-success/20 border-success text-success',
                    showResult && isSelected && !isCorrect && 'bg-destructive/20 border-destructive text-destructive',
                    !showResult && 'border-border text-muted-foreground',
                  )} aria-hidden="true">
                    {showResult && isCorrect ? <CheckCircle2 className="w-4 h-4" /> :
                     showResult && isSelected && !isCorrect ? <XCircle className="w-4 h-4" /> :
                     String.fromCharCode(65 + index)}
                  </span>
                  <span className="flex-1 text-sm">
                    <span className="sr-only">Option {String.fromCharCode(65 + index)}: </span>
                    {option}
                  </span>
                  {showResult && isCorrect && <span className="sr-only"> - This is the correct answer</span>}
                  {showResult && isSelected && !isCorrect && <span className="sr-only"> - You selected this incorrect answer</span>}
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* Practice Mode Helpers */}
        <div aria-live="polite">
          {isPractice && !currentAnswer && currentQuestion.hint && (
            <Card className="glass-card border-border/50 mb-4">
              <CardContent className="p-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowHint(!showHint)}
                  className="w-full justify-start gap-2 text-muted-foreground"
                  aria-expanded={showHint}
                >
                  {showHint ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {showHint ? 'Hide Hint' : 'Show Hint'}
                </Button>
                {showHint && (
                  <p className="text-sm text-muted-foreground mt-2 px-2 animate-in fade-in slide-in-from-top-1">
                    💡 <span className="sr-only">Hint: </span>{currentQuestion.hint}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {showExplanation && currentAnswer && (
            <Card className={cn(
              'mb-4 border-2 animate-in slide-in-from-bottom-2',
              currentAnswer.isCorrect ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5'
            )}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="text-2xl shrink-0" aria-hidden="true">
                    {currentAnswer.isCorrect ? '🎉' : '💡'}
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1 text-sm">
                      {currentAnswer.isCorrect ? 'সাবাশ! Correct!' : 'Not quite — here\'s why:'}
                    </h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {currentQuestion.explanation}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="rounded-xl"
            aria-label="Previous Question"
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Prev
          </Button>

          <div className="flex-1" />

          {currentAnswer ? (
            <Button
              onClick={handleNext}
              className="btn-premium text-primary-foreground rounded-xl px-6"
              aria-label={currentIndex < questions.length - 1 ? "Next Question" : "Finish Exam"}
            >
              {currentIndex < questions.length - 1 ? (
                <>Next <ChevronRight className="w-4 h-4 ml-1" /></>
              ) : (
                <>Finish Exam <Trophy className="w-4 h-4 ml-1" /></>
              )}
            </Button>
          ) : (
            currentIndex === questions.length - 1 && (
              <Button
                variant="outline"
                onClick={finishExam}
                className="rounded-xl text-destructive border-destructive/30 hover:bg-destructive/10"
                aria-label="Submit Exam"
              >
                Submit <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )
          )}
        </div>

        {/* Question navigator dots */}
        <div className="flex flex-wrap gap-1.5 justify-center mt-6" role="navigation" aria-label="Question Navigation">
          {questions.map((q, i) => {
            const ans = answers.get(q.id);
            const isCurrent = i === currentIndex;
            return (
              <button
                key={q.id}
                onClick={() => { setCurrentIndex(i); setShowExplanation(false); setShowHint(false); setTimeout(() => questionHeadingRef.current?.focus(), 100); }}
                className={cn(
                  'w-7 h-7 rounded-lg text-xs font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                  isCurrent && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                  ans?.isCorrect && 'bg-success/20 text-success',
                  ans && !ans.isCorrect && 'bg-destructive/20 text-destructive',
                  !ans && !isCurrent && 'bg-muted text-muted-foreground',
                )}
                aria-label={`Go to question ${i + 1}${ans ? (ans.isCorrect ? ' (Correct)' : ' (Incorrect)') : ''}${isCurrent ? ' (Current)' : ''}`}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </main>

      {/* Visual Labels for Screen Reader text (Toggled in settings) */}
      {screenReaderOptimized && (
        <div className="fixed bottom-20 left-4 right-4 bg-primary/10 border border-primary/20 p-2 rounded text-[10px] text-primary font-medium animate-in fade-in slide-in-from-bottom-2">
          <span className="flex items-center gap-2">
            <Accessibility className="w-3 h-3" />
            Screen Reader Optimization Active: Descriptive labels are visible for accessibility.
          </span>
        </div>
      )}
    </div>
  );
}
