import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import adomoLogo from '@/assets/protibha-logo.png';
import { useUser } from '@/contexts/UserContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sparkles, ArrowRight, BookOpen, Brain, Zap } from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();
  const { isOnboardingComplete, getCurrentStep, updateUser } = useUser();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', session.user.id)
          .single();

        if (profile) {
          if (profile.class_level && profile.school_name && profile.selected_subjects?.length > 0) {
            updateUser({
              name: profile.name,
              email: profile.email,
              class_level: profile.class_level,
              school_name: profile.school_name,
              selected_subjects: profile.selected_subjects,
              preferred_language: (profile as any).preferred_language || 'en',
              onboarding_step: 'complete',
            });
            navigate('/home', { replace: true });
          } else {
            updateUser({
              name: profile.name,
              email: profile.email,
              class_level: profile.class_level || '',
              school_name: profile.school_name || '',
              selected_subjects: profile.selected_subjects || [],
              onboarding_step: profile.class_level ? (profile.school_name ? 4 : 3) : 2,
            });
            navigate('/onboarding/class', { replace: true });
          }
        }
      } else if (isOnboardingComplete) {
        // Clear state
      } else {
        const step = getCurrentStep();
        if (step !== 1 && step !== 'complete') {
          const routes: Record<number, string> = {
            2: '/onboarding/class',
            3: '/onboarding/school',
            4: '/onboarding/subjects',
          };
          if (routes[step as number]) {
            navigate(routes[step as number], { replace: true });
          }
        }
      }
      setChecking(false);
    };

    checkAuthAndRedirect();
  }, [isOnboardingComplete, getCurrentStep, navigate, updateUser]);

  if (checking) {
    return (
      <div className="min-h-screen bg-background bg-mesh flex items-center justify-center noise">
        <div className="text-center">
          <div className="relative w-24 h-24 mx-auto mb-6">
            <img 
              src={adomoLogo} 
              alt="Adomo AI" 
              className="w-full h-full object-contain drop-shadow-xl animate-pulse"
            />
            <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl -z-10" />
          </div>
          <div className="h-1.5 w-40 mx-auto rounded-full overflow-hidden bg-muted/30">
            <div className="h-full w-1/2 gradient-primary rounded-full animate-[shimmer_1s_ease-in-out_infinite]" />
          </div>
          <p className="text-xs text-muted-foreground mt-4 animate-pulse">Loading your learning journey...</p>
        </div>
      </div>
    );
  }

  const features = [
    { icon: Brain, label: 'AI Tutor', desc: 'Personal guidance' },
    { icon: BookOpen, label: 'Smart Learning', desc: 'Adaptive content' },
    { icon: Zap, label: 'Track Progress', desc: 'Analytics & insights' },
  ];

  return (
    <div className="min-h-screen bg-background bg-mesh flex flex-col noise">
      {/* Floating orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 -left-20 w-80 h-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-40 -right-20 w-60 h-60 rounded-full bg-gradient-to-br from-primary/10 to-purple-500/10 blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex justify-end p-4">
        <ThemeToggle />
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pb-12">
        <div className="page-enter text-center max-w-md w-full">
          {/* Logo */}
          <div className="mb-10 slide-up">
            <div className="relative w-32 h-32 mx-auto">
              <img 
                src={adomoLogo} 
                alt="Adomo AI" 
                className="w-full h-full object-contain drop-shadow-2xl"
              />
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary/30 via-purple-500/20 to-primary/30 blur-2xl -z-10 animate-pulse" />
            </div>
          </div>

          {/* App Name */}
          <h1 className="text-4xl sm:text-5xl font-bold mb-4 tracking-tight">
            <span className="gradient-text">Adomo AI</span>
          </h1>

          {/* Tagline */}
          <p className="text-xl text-muted-foreground mb-2 font-medium">
            Your Personal AI Learning Companion
          </p>
          <p className="text-muted-foreground mb-10">
            Master any subject with AI-powered tutoring
          </p>

          {/* Features */}
          <div className="grid grid-cols-3 gap-3 mb-10">
            {features.map((feature, i) => (
              <div 
                key={i}
                className="glass-card rounded-2xl p-4 text-center stagger-children"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-primary/10 flex items-center justify-center">
                  <feature.icon className="w-5 h-5 text-primary" />
                </div>
                <p className="text-xs font-medium">{feature.label}</p>
              </div>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="space-y-4">
            <Button
              size="lg"
              onClick={() => navigate('/signin')}
              className="w-full h-14 text-lg font-semibold rounded-2xl btn-premium text-primary-foreground transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] press"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                Get Started
                <ArrowRight className="w-5 h-5" />
              </span>
            </Button>
            
            <button
              onClick={() => navigate('/signin')}
              className="text-muted-foreground hover:text-primary transition-colors text-sm flex items-center justify-center gap-1.5 mx-auto group"
            >
              <span>I already have an account</span>
              <Sparkles className="w-3.5 h-3.5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center py-6 text-xs text-muted-foreground/60">
        Version 2.0 • Learn Anywhere
      </footer>
    </div>
  );
}
