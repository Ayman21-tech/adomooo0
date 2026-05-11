import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/contexts/UserContext';
import { HomeHeader } from '@/components/home/HomeHeader';
import { BottomNav, type HomeTab } from '@/components/home/BottomNav';
import { ProgressTab } from '@/components/home/tabs/ProgressTab';
import { SubjectsTab } from '@/components/home/tabs/SubjectsTab';
import { SyllabusTab } from '@/components/home/tabs/SyllabusTab';
import { PrepTab } from '@/components/home/tabs/PrepTab';
import { ExamTab } from '@/components/home/tabs/ExamTab';
import { LeaderboardTab } from '@/components/home/tabs/LeaderboardTab';
import { BadgesTab } from '@/components/home/tabs/BadgesTab';
import { SettingsTab } from '@/components/home/tabs/SettingsTab';
import { TeacherTab } from '@/components/home/tabs/TeacherTab';
import { FloatingAIButton } from '@/components/FloatingAIButton';
import { cn } from '@/lib/utils';
import { t } from '@/i18n';

const tabTitleKeys: Record<HomeTab, string> = {
  progress: 'header.progress',
  subjects: 'header.subjects',
  syllabus: 'header.syllabus',
  prep: 'header.prep',
  exam: 'header.exam',
  leaderboard: 'Leaderboard',
  badges: 'My Achievements',
  teacher: 'Teacher Hub',
  settings: 'header.settings',
};

export default function Home() {
  const navigate = useNavigate();
  const { isOnboardingComplete, user, loading } = useUser();
  const lang = user.default_language;
  const [activeTab, setActiveTab] = useState<HomeTab>('progress');
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (!loading && !isOnboardingComplete) {
      navigate('/', { replace: true });
    }
  }, [loading, isOnboardingComplete, navigate]);

  const handleTabChange = (tab: HomeTab) => {
    if (tab === activeTab) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setActiveTab(tab);
      setIsTransitioning(false);
    }, 120);
  };

  if (loading || !isOnboardingComplete) return null;

  const getTitle = () => {
    const key = tabTitleKeys[activeTab];
    if (activeTab === 'teacher') return key;
    return t(key, lang);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'progress': return <ProgressTab />;
      case 'subjects': return <SubjectsTab />;
      case 'syllabus': return <SyllabusTab />;
      case 'prep': return <PrepTab />;
      case 'exam': return <ExamTab />;
      case 'leaderboard': return <LeaderboardTab />;
      case 'badges': return <BadgesTab />;
      case 'teacher': return <TeacherTab />;
      case 'settings': return <SettingsTab />;
    }
  };

  return (
    <div className="min-h-screen bg-background bg-pattern noise">
      <HomeHeader title={getTitle()} />
      <main
        className={cn(
          'relative z-10 container max-w-2xl px-4 py-5 transition-opacity duration-150',
          isTransitioning ? 'opacity-0' : 'opacity-100 page-enter'
        )}
      >
        {renderTabContent()}
      </main>
      <FloatingAIButton />
      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
    </div>
  );
}
