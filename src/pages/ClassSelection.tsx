import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { StepLayout } from '@/components/StepLayout';
import { ClassButton } from '@/components/ClassButton';
import { useUser } from '@/contexts/UserContext';
import { classLevels } from '@/data/subjects';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export default function ClassSelection() {
  const navigate = useNavigate();
  const { user, updateUser } = useUser();
  const [selectedClass, setSelectedClass] = useState(user.class_level);
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    if (!selectedClass) return;
    
    setLoading(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (authUser) {
        const { error } = await supabase
          .from('profiles')
          .update({ class_level: selectedClass })
          .eq('user_id', authUser.id);

        if (error) throw error;
      }

      updateUser({ class_level: selectedClass, onboarding_step: 3 });
      navigate('/onboarding/school');
    } catch (error) {
      console.error('Error saving class:', error);
      toast({
        title: 'Error',
        description: 'Failed to save your selection. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <StepLayout
      currentStep={2}
      title="What grade are you in?"
      subtitle="Select your current grade level"
      onBack={() => navigate('/signin')}
    >
      <div className="space-y-6">
        {/* Grade Grid */}
        <div className="grid grid-cols-3 gap-3 stagger-children">
          {classLevels.map((level) => (
            <ClassButton
              key={level}
              label={level}
              selected={selectedClass === level}
              onClick={() => setSelectedClass(level)}
            />
          ))}
        </div>

        {/* Continue Button */}
        <Button
          size="lg"
          onClick={handleContinue}
          disabled={!selectedClass || loading}
          className="w-full h-14 text-lg font-semibold rounded-xl gradient-primary transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {loading ? 'Saving...' : 'Continue'}
        </Button>
      </div>
    </StepLayout>
  );
}
