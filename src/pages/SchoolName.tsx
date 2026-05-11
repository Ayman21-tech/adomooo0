import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { School } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StepLayout } from '@/components/StepLayout';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export default function SchoolName() {
  const navigate = useNavigate();
  const { user, updateUser } = useUser();
  const [schoolName, setSchoolName] = useState(user.school_name);
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    if (!schoolName.trim()) return;
    
    setLoading(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (authUser) {
        const { error } = await supabase
          .from('profiles')
          .update({ school_name: schoolName.trim() })
          .eq('user_id', authUser.id);

        if (error) throw error;
      }

      updateUser({ school_name: schoolName.trim(), onboarding_step: 4 });
      navigate('/onboarding/subjects');
    } catch (error) {
      console.error('Error saving school:', error);
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
      currentStep={3}
      title="What's your school name?"
      subtitle="We'll personalize your experience"
      onBack={() => navigate('/onboarding/class')}
    >
      <div className="space-y-6">
        {/* School Input */}
        <div className="space-y-2">
          <Label htmlFor="school" className="text-sm font-medium">
            School Name
          </Label>
          <div className="relative">
            <School className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground z-10" />
            <Input
              id="school"
              type="text"
              placeholder="Enter your school name"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              className="pl-10 h-12 rounded-xl"
              disabled={loading}
            />
          </div>
        </div>

        {/* Continue Button */}
        <Button
          size="lg"
          onClick={handleContinue}
          disabled={!schoolName.trim() || loading}
          className="w-full h-14 text-lg font-semibold rounded-xl gradient-primary transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {loading ? 'Saving...' : 'Continue'}
        </Button>
      </div>
    </StepLayout>
  );
}
