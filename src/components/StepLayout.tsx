import { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ThemeToggle } from './ThemeToggle';
import { ProgressStepper } from './ProgressStepper';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface StepLayoutProps {
  children: ReactNode;
  currentStep: number;
  totalSteps?: number;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  showBack?: boolean;
  className?: string;
}

export function StepLayout({
  children,
  currentStep,
  totalSteps = 5,
  title,
  subtitle,
  onBack,
  showBack = true,
  className,
}: StepLayoutProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <div className={cn('min-h-screen bg-background bg-pattern noise', className)}>
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/85 backdrop-blur-xl border-b border-border/40">
        <div className="container max-w-lg flex items-center justify-between h-14 px-4">
          {showBack ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              className="rounded-lg h-8 w-8 hover:bg-secondary"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          ) : (
            <div className="w-8" />
          )}

          <ProgressStepper currentStep={currentStep} totalSteps={totalSteps} />

          <ThemeToggle />
        </div>
      </header>

      {/* Content */}
      <main className="relative z-10 container max-w-lg pt-22 pb-10 px-4">
        <div className="page-enter pt-8">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-foreground mb-2">{title}</h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
