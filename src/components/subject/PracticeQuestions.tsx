import { useState, useRef, useEffect } from 'react';
import { CheckCircle2, XCircle, ChevronRight, RefreshCw } from 'lucide-react';
import { useLearningEngine } from '@/hooks/useLearningEngine';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

// Mock questions for demo - in production these come from database
const mockQuestions: Question[] = [
  {
    id: '1',
    question: 'What is the primary purpose of learning this subject?',
    options: [
      'To pass exams only',
      'To gain knowledge and develop critical thinking',
      'To memorize facts',
      'None of the above',
    ],
    correctAnswer: 1,
    explanation: 'Education is about developing understanding and critical thinking skills, not just memorization. সাবাশ! Keep learning! 📚',
    difficulty: 'easy',
  },
  {
    id: '2',
    question: 'Which approach is best for effective learning?',
    options: [
      'Reading once before the exam',
      'Regular practice with understanding',
      'Copying from others',
      'Only listening in class',
    ],
    correctAnswer: 1,
    explanation: 'Regular practice with deep understanding leads to long-term retention and real knowledge.',
    difficulty: 'medium',
  },
  {
    id: '3',
    question: 'How can you best remember what you learn?',
    options: [
      'Teaching others what you learned',
      'Never reviewing the material',
      'Only reading without taking notes',
      'Avoiding practice questions',
    ],
    correctAnswer: 0,
    explanation: 'Teaching others is one of the most effective ways to solidify your understanding! When you explain concepts, you truly master them.',
    difficulty: 'hard',
  },
];

interface PracticeQuestionsProps {
  subjectId: string;
  subjectName: string;
}

export function PracticeQuestions({ subjectId, subjectName }: PracticeQuestionsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);
  const [completed, setCompleted] = useState(false);
  const questionStartTime = useRef<number>(Date.now());
  const { logPerformance } = useLearningEngine();

  const questions = mockQuestions;
  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  // Reset timer when question changes
  useEffect(() => {
    questionStartTime.current = Date.now();
  }, [currentIndex]);

  const handleAnswer = (index: number) => {
    if (selectedAnswer !== null) return;
    
    const timeSpentSeconds = Math.round((Date.now() - questionStartTime.current) / 1000);
    
    setSelectedAnswer(index);
    setShowExplanation(true);
    
    const isCorrect = index === currentQuestion.correctAnswer;
    if (isCorrect) {
      setScore(prev => prev + 1);
    }

    // Log performance with timing data
    const questionScore = isCorrect ? 100 : 0;
    logPerformance(currentQuestion.id, questionScore, timeSpentSeconds).catch(() => {});
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    } else {
      setCompleted(true);
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setScore(0);
    setCompleted(false);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'bg-green-500/10 text-green-600 dark:text-green-400';
      case 'medium':
        return 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400';
      case 'hard':
        return 'bg-red-500/10 text-red-600 dark:text-red-400';
      default:
        return '';
    }
  };

  if (completed) {
    const percentage = Math.round((score / questions.length) * 100);
    const message = percentage >= 80 
      ? "সাবাশ! Excellent work! 🎉" 
      : percentage >= 50 
        ? "Good effort! Keep practicing! 💪" 
        : "Don't worry, practice makes perfect! 📚";

    return (
      <Card className="border-border">
        <CardContent className="pt-6 text-center">
          <div className="text-6xl mb-4">
            {percentage >= 80 ? '🏆' : percentage >= 50 ? '👍' : '📖'}
          </div>
          <h3 className="text-2xl font-bold mb-2">Practice Complete!</h3>
          <p className="text-muted-foreground mb-4">{message}</p>
          
          <div className="bg-muted rounded-xl p-6 mb-6 inline-block">
            <div className="text-4xl font-bold text-primary">{score}/{questions.length}</div>
            <div className="text-sm text-muted-foreground">Correct Answers</div>
          </div>

          <div className="flex gap-3 justify-center">
            <Button onClick={handleRestart} className="rounded-xl">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Question {currentIndex + 1} of {questions.length}
        </span>
        <Badge variant="outline" className={getDifficultyColor(currentQuestion.difficulty)}>
          {currentQuestion.difficulty}
        </Badge>
      </div>
      <Progress value={progress} className="h-2" />

      {/* Question Card */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg leading-relaxed">
            {currentQuestion.question}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {currentQuestion.options.map((option, index) => {
            const isSelected = selectedAnswer === index;
            const isCorrect = index === currentQuestion.correctAnswer;
            const showResult = selectedAnswer !== null;

            let buttonClass = 'w-full justify-start text-left h-auto py-3 px-4 rounded-xl ';
            
            if (showResult) {
              if (isCorrect) {
                buttonClass += 'bg-green-500/10 border-green-500 text-green-700 dark:text-green-400';
              } else if (isSelected && !isCorrect) {
                buttonClass += 'bg-red-500/10 border-red-500 text-red-700 dark:text-red-400';
              } else {
                buttonClass += 'opacity-50';
              }
            } else {
              buttonClass += 'hover:bg-primary/5 hover:border-primary';
            }

            return (
              <Button
                key={index}
                variant="outline"
                className={buttonClass}
                onClick={() => handleAnswer(index)}
                disabled={selectedAnswer !== null}
              >
                <span className="flex items-center gap-3 w-full">
                  <span className="w-6 h-6 rounded-full border flex items-center justify-center text-xs font-medium shrink-0">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span className="flex-1">{option}</span>
                  {showResult && isCorrect && (
                    <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                  )}
                  {showResult && isSelected && !isCorrect && (
                    <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                  )}
                </span>
              </Button>
            );
          })}
        </CardContent>
      </Card>

      {/* Explanation */}
      {showExplanation && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <div className="text-2xl">💡</div>
              <div>
                <h4 className="font-semibold mb-1">Explanation</h4>
                <p className="text-sm text-muted-foreground">
                  {currentQuestion.explanation}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Next Button */}
      {selectedAnswer !== null && (
        <Button onClick={handleNext} className="w-full rounded-xl">
          {currentIndex < questions.length - 1 ? (
            <>
              Next Question
              <ChevronRight className="w-4 h-4 ml-2" />
            </>
          ) : (
            'See Results'
          )}
        </Button>
      )}
    </div>
  );
}
