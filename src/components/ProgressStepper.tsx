import { cn } from '@/lib/utils';

interface ProgressStepperProps {
  currentStep: number;
  totalSteps: number;
  className?: string;
}

export function ProgressStepper({ currentStep, totalSteps, className }: ProgressStepperProps) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {Array.from({ length: totalSteps }, (_, i) => {
        const stepNumber = i + 1;
        const isActive = stepNumber === currentStep;
        const isCompleted = stepNumber < currentStep;

        return (
          <div
            key={stepNumber}
            className={cn(
              'h-2 rounded-full transition-all duration-500 ease-out',
              isActive ? 'w-10 gradient-primary glow-sm' : 'w-2',
              isCompleted && 'w-4 gradient-primary',
              !isActive && !isCompleted && 'bg-muted'
            )}
          />
        );
      })}
    </div>
  );
}
