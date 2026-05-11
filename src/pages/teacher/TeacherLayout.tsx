import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/contexts/UserContext';
import { HomeHeader } from '@/components/home/HomeHeader';
import { TeacherBottomNav, type TeacherTab } from '@/components/teacher/TeacherBottomNav';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

import { TeacherDashboardTab } from './tabs/TeacherDashboardTab';
import { TeacherClassesTab } from './tabs/TeacherClassesTab';
import { TeacherHomeworkTab } from './tabs/TeacherHomeworkTab';
import { TeacherChatTab } from './tabs/TeacherChatTab';

const tabTitleKeys: Record<TeacherTab, string> = {
  dashboard: 'Teacher Dashboard',
  classes: 'My Classes',
  homework: 'Homework & Announcements',
  chat: 'Student Messages',
  checking: 'AI Copy Checker',
  settings: 'Settings',
};

export default function TeacherLayout() {
  const navigate = useNavigate();
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<TeacherTab>('dashboard');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user.role !== 'teacher') {
      navigate('/home', { replace: true });
      return;
    }

    const checkProfile = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) throw new Error('Not logged in');

        const { data } = await supabase.from('teacher_profiles').select('id').eq('user_id', authUser.id).maybeSingle();
        if (!data) {
          navigate('/teacher/onboarding', { replace: true });
        }
      } catch (e: any) {
        toast({ title: 'Auth Error', description: e.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    checkProfile();
  }, [user.role, navigate]);

  const handleTabChange = (tab: TeacherTab) => {
    if (tab === activeTab) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setActiveTab(tab);
      setIsTransitioning(false);
    }, 120);
  };

  if (loading) return null;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard': return <TeacherDashboardTab />;
      case 'classes': return <TeacherClassesTab />;
      case 'homework': return <TeacherHomeworkTab />;
      case 'chat': return <TeacherChatTab />;
      case 'checking': return <div>Checking Tab (Coming Soon)</div>;
      case 'settings': return <div>Settings Tab (Coming Soon)</div>;
    }
  };

  return (
    <div className="min-h-screen bg-background bg-pattern noise">
      <HomeHeader title={tabTitleKeys[activeTab]} />
      <main
        className={cn(
          'relative z-10 container max-w-2xl px-4 py-5 pb-24 transition-opacity duration-150',
          isTransitioning ? 'opacity-0' : 'opacity-100 page-enter'
        )}
      >
        {renderTabContent()}
      </main>
      <TeacherBottomNav activeTab={activeTab} onTabChange={handleTabChange} />
    </div>
  );
}
