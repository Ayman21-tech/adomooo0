import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StepLayout } from '@/components/StepLayout';
import { CategorySection } from '@/components/CategorySection';
import { useUser } from '@/contexts/UserContext';
import { categories } from '@/data/subjects';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export default function SubjectsSelection() {
  const navigate = useNavigate();
  const { user, updateUser } = useUser();
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(user.selected_subjects);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    
    return categories.map(cat => ({
      ...cat,
      subjects: cat.subjects.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    })).filter(cat => cat.subjects.length > 0);
  }, [searchQuery]);

  const toggleSubject = (subjectId: string) => {
    setSelectedSubjects(prev =>
      prev.includes(subjectId)
        ? prev.filter(id => id !== subjectId)
        : [...prev, subjectId]
    );
  };

  const handleContinue = async () => {
    if (selectedSubjects.length === 0) return;
    
    setLoading(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (authUser) {
        const { error } = await supabase
          .from('profiles')
          .update({ selected_subjects: selectedSubjects })
          .eq('user_id', authUser.id);

        if (error) throw error;
      }

      updateUser({ selected_subjects: selectedSubjects, onboarding_step: 'complete' });
      navigate('/home');
    } catch (error) {
      console.error('Error saving subjects:', error);
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
      currentStep={4}
      title="Select your subjects"
      subtitle="Choose the subjects you want to study"
      onBack={() => navigate('/onboarding/school')}
    >
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search subjects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 rounded-xl"
          />
        </div>

        {/* Selected Counter */}
        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-muted-foreground">
            Selected: <span className="font-semibold text-primary">{selectedSubjects.length}</span> subjects
          </span>
          {selectedSubjects.length > 0 && (
            <button
              onClick={() => setSelectedSubjects([])}
              className="text-sm text-muted-foreground hover:text-destructive transition-colors"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Categories */}
        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
          {filteredCategories.map((category) => (
            <CategorySection
              key={category.id}
              category={category}
              selectedSubjects={selectedSubjects}
              onToggleSubject={toggleSubject}
              defaultOpen={searchQuery.length > 0}
            />
          ))}
          
          {filteredCategories.length === 0 && (
            <p className="text-center py-8 text-muted-foreground">
              No subjects found matching "{searchQuery}"
            </p>
          )}
        </div>

        {/* Continue Button */}
        <Button
          size="lg"
          onClick={handleContinue}
          disabled={selectedSubjects.length === 0 || loading}
          className="w-full h-14 text-lg font-semibold rounded-xl gradient-primary transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {loading ? 'Saving...' : `Continue (${selectedSubjects.length} selected)`}
        </Button>
      </div>
    </StepLayout>
  );
}
