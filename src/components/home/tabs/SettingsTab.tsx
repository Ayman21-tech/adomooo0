import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, Mail, Moon, BookOpen, RotateCcw, LogOut, Flame, 
  Languages, Palette, ChevronRight, Shield, Database, 
  ArrowUpCircle, BookUp, MessageSquareWarning,
  Eye, Type, Accessibility
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useUser, type Personality } from '@/contexts/UserContext';
import { useAccessibility } from '@/contexts/AccessibilityContext';
import { useStudyStreak } from '@/hooks/useStudyStreak';
import { useSyllabus } from '@/hooks/useSyllabus';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { classLevels } from '@/data/subjects';
import { t } from '@/i18n';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface SettingsItemProps {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onClick?: () => void;
  showArrow?: boolean;
  variant?: 'default' | 'destructive';
  children?: React.ReactNode;
}

function SettingsItem({ icon, label, value, onClick, showArrow = true, variant = 'default', children }: SettingsItemProps) {
  const content = (
    <div className="flex items-center justify-between p-4">
      <div className="flex items-center gap-4">
        <span className={variant === 'destructive' ? 'text-destructive' : 'text-muted-foreground'}>
          {icon}
        </span>
        <span className={`font-medium ${variant === 'destructive' ? 'text-destructive' : ''}`}>
          {label}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {children || (
          <>
            {value && <span className="text-sm text-muted-foreground">{value}</span>}
            {showArrow && onClick && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          </>
        )}
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button 
        className="w-full text-left hover:bg-muted/50 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-none rounded-lg"
        onClick={onClick}
        aria-label={label}
      >
        {content}
      </button>
    );
  }

  return content;
}

export function SettingsTab() {
  const navigate = useNavigate();
  const { user, updateUser, resetUser } = useUser();
  const { 
    highContrast, setHighContrast, 
    fontSize, setFontSize, 
    dyslexicFont, setDyslexicFont,
    screenReaderOptimized, setScreenReaderOptimized 
  } = useAccessibility();
  const { streak } = useStudyStreak();
  const { archiveForPromotion } = useSyllabus();
  const lang = user.default_language;
  
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  const [showPromotionDialog, setShowPromotionDialog] = useState(false);
  const [showAgeDialog, setShowAgeDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [newAge, setNewAge] = useState(user.age?.toString() || '');
  const [newClassLevel, setNewClassLevel] = useState('');
  const [reportMessage, setReportMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const getLanguageLabel = () => {
    return user.preferred_language?.toUpperCase() || 'EN';
  };

  const personalityOptions: { value: Personality; label: string; description: string; emoji: string }[] = [
    { value: 'rough', label: t('settings.rough', lang), description: t('settings.roughDesc', lang), emoji: '💪' },
    { value: 'friendly', label: t('settings.friendly', lang), description: t('settings.friendlyDesc', lang), emoji: '😊' },
    { value: 'parent', label: t('settings.parent', lang), description: t('settings.parentDesc', lang), emoji: '🤗' },
    { value: 'nerd', label: t('settings.nerd', lang), description: t('settings.nerdDesc', lang), emoji: '🤓' },
  ];

  const handleLanguageChange = (value: string) => {
    updateUser({ default_language: value as 'bangla' | 'english' });
    toast({ title: t('settings.languageChanged', value) });
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      resetUser();
      toast({ title: t('settings.signedOut', lang), description: t('settings.signedOutDesc', lang) });
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Error signing out:', error);
      toast({ title: t('common.error', lang), description: 'Failed to sign out', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      resetUser();
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Error resetting:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClassPromotion = async () => {
    if (!newClassLevel || newClassLevel === user.class_level) return;
    
    setLoading(true);
    try {
      await archiveForPromotion(newClassLevel);
      updateUser({ class_level: newClassLevel });
      
      const { data: session } = await supabase.auth.getSession();
      if (session?.session?.user) {
        await supabase
          .from('profiles')
          .update({ class_level: newClassLevel })
          .eq('user_id', session.session.user.id);
      }
      
      toast({ 
        title: t('settings.classUpdated', lang), 
        description: t('settings.classUpdatedDesc', lang, { class: newClassLevel })
      });
      setShowPromotionDialog(false);
    } catch (error) {
      console.error('Error promoting class:', error);
      toast({ title: t('common.error', lang), description: 'Failed to update class', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleAgeUpdate = () => {
    const age = parseInt(newAge);
    if (isNaN(age) || age < 5 || age > 25) {
      toast({ title: lang === 'bangla' ? 'অবৈধ বয়স' : 'Invalid age', description: lang === 'bangla' ? 'একটি বৈধ বয়স লিখুন (৫-২৫)' : 'Please enter a valid age (5-25)', variant: 'destructive' });
      return;
    }
    updateUser({ age });
    setShowAgeDialog(false);
    toast({ title: lang === 'bangla' ? 'বয়স আপডেট হয়েছে' : 'Age updated' });
  };

  const handlePersonalityChange = (personality: Personality) => {
    updateUser({ personality });
    toast({ title: lang === 'bangla' ? 'ব্যক্তিত্ব আপডেট হয়েছে' : 'Personality updated' });
  };

  const handleSendReport = async () => {
    if (!reportMessage.trim()) {
      toast({ title: t('common.error', lang), description: lang === 'bangla' ? 'আপনার সমস্যা বা মতামত লিখুন' : 'Please write your problem or feedback', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-report`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            name: user.name,
            email: user.email,
            classLevel: user.class_level,
            school: user.school_name,
            problem: reportMessage,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          toast({ 
            title: lang === 'bangla' ? 'অনেক বেশি রিপোর্ট' : 'Too Many Reports', 
            description: data.error || (lang === 'bangla' ? 'আবার রিপোর্ট পাঠানোর আগে অপেক্ষা করুন।' : 'Please wait before sending another report.'),
            variant: 'destructive' 
          });
          return;
        }
        throw new Error(data.error || 'Failed to send report');
      }

      toast({ 
        title: lang === 'bangla' ? '✅ রিপোর্ট পাঠানো হয়েছে!' : '✅ Report Sent!', 
        description: lang === 'bangla' ? 'আপনার মতামতের জন্য ধন্যবাদ।' : 'Thank you for your feedback. We will look into it.' 
      });
      setShowReportDialog(false);
      setReportMessage('');
    } catch (error) {
      console.error('Error sending report:', error);
      
      const emailContent = `
Name: ${user.name}
Email: ${user.email}
Class: ${user.class_level}
School: ${user.school_name || 'Not provided'}

Problem/Feedback:
${reportMessage}
      `.trim();

      const mailtoLink = `mailto:Rahmatullahkhanayman@gmail.com?subject=Adomo AI App Report - ${user.name}&body=${encodeURIComponent(emailContent)}`;
      window.open(mailtoLink, '_blank');
      
      toast({ 
        title: lang === 'bangla' ? 'ইমেইল অ্যাপ খুলছে' : 'Opening Email App', 
        description: lang === 'bangla' ? 'রিপোর্ট জমা দিতে ইমেইল পাঠান।' : 'Please send the email to submit your report.' 
      });
      setShowReportDialog(false);
      setReportMessage('');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeBooks = () => {
    navigate('/home?tab=syllabus');
  };

  return (
    <div className="space-y-4 pb-20" role="main" aria-label={t('header.settings', lang)}>
      {/* Language Selector */}
      <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
        {t('settings.language', lang)}
      </h2>
      <Card>
        <CardContent className="p-0">
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Languages className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <span className="font-medium">{t('settings.language', lang)}</span>
            </div>
            <Select value={user.default_language} onValueChange={handleLanguageChange}>
              <SelectTrigger className="w-32" aria-label={t('settings.language', lang)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bangla">🇧🇩 {t('settings.bangla', lang)}</SelectItem>
                <SelectItem value="english">🇬🇧 {t('settings.english', lang)}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Accessibility Section */}
      <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
        {lang === 'bangla' ? 'অ্যাক্সেসিবিলিটি (Accessibility)' : 'Accessibility'}
      </h2>
      <Card>
        <CardContent className="p-0">
          {/* High Contrast */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Eye className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <div>
                <span className="font-medium block">{lang === 'bangla' ? 'উচ্চ বৈসাদৃশ্য' : 'High Contrast'}</span>
                <span className="text-xs text-muted-foreground">{lang === 'bangla' ? 'দৃষ্টিশক্তি সমস্যার জন্য বিশেষ মোড' : 'Special mode for visual impairments'}</span>
              </div>
            </div>
            <Switch
              checked={highContrast}
              onCheckedChange={setHighContrast}
              aria-label={lang === 'bangla' ? 'উচ্চ বৈসাদৃশ্য চালু করুন' : 'Enable High Contrast'}
            />
          </div>
          <div className="border-t border-border" />
          
          {/* Dyslexic Font */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Type className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <div>
                <span className="font-medium block">{lang === 'bangla' ? 'ডিসলেক্সিয়া ফন্ট' : 'Dyslexia Friendly Font'}</span>
                <span className="text-xs text-muted-foreground">{lang === 'bangla' ? 'পড়ার সুবিধার্থে বিশেষ ফন্ট' : 'Special font for easier reading'}</span>
              </div>
            </div>
            <Switch
              checked={dyslexicFont}
              onCheckedChange={setDyslexicFont}
              aria-label={lang === 'bangla' ? 'ডিসলেক্সিয়া ফন্ট চালু করুন' : 'Enable Dyslexia Friendly Font'}
            />
          </div>
          <div className="border-t border-border" />

          {/* Screen Reader Optimized (Visual Cues) */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Accessibility className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <div>
                <span className="font-medium block">{lang === 'bangla' ? 'স্ক্রিন রিডার অপ্টিমাইজেশন' : 'Screen Reader Optimized'}</span>
                <span className="text-xs text-muted-foreground">{lang === 'bangla' ? 'অন্ধ শিক্ষার্থীদের জন্য বিশেষ লেবেল দেখান' : 'Show visual labels for hidden ARIA text'}</span>
              </div>
            </div>
            <Switch
              checked={screenReaderOptimized}
              onCheckedChange={setScreenReaderOptimized}
              aria-label={lang === 'bangla' ? 'স্ক্রিন রিডার অপ্টিমাইজেশন চালু করুন' : 'Enable Screen Reader Optimization'}
            />
          </div>
          <div className="border-t border-border" />

          {/* Font Size Selector */}
          <div className="p-4">
            <div className="flex items-center gap-4 mb-3">
              <Type className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <span className="font-medium">{lang === 'bangla' ? 'লেখার আকার' : 'Text Size'}</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {(['small', 'medium', 'large', 'extra-large'] as const).map((size) => (
                <Button
                  key={size}
                  variant={fontSize === size ? 'default' : 'outline'}
                  size="sm"
                  className="capitalize text-[10px] h-8"
                  onClick={() => setFontSize(size)}
                  aria-pressed={fontSize === size}
                >
                  {size.replace('-', ' ')}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Section */}
      <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
        {t('settings.profile', lang)}
      </h2>
      <Card>
        <CardContent className="p-0">
          <SettingsItem icon={<User className="h-5 w-5" />} label={t('settings.name', lang)} value={user.name} showArrow={false} />
          <div className="border-t border-border" />
          <SettingsItem icon={<Mail className="h-5 w-5" />} label={t('settings.email', lang)} value={user.email} showArrow={false} />
          <div className="border-t border-border" />
          <SettingsItem icon={<User className="h-5 w-5" />} label={t('settings.age', lang)} value={user.age ? `${user.age} ${t('settings.days', lang) === 'দিন' ? 'বছর' : 'years'}` : t('settings.notSet', lang)} onClick={() => setShowAgeDialog(true)} />
        </CardContent>
      </Card>

      {/* Study Stats */}
      <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
        {t('settings.studyStats', lang)}
      </h2>
      <Card>
        <CardContent className="p-0">
          <SettingsItem icon={<Flame className="h-5 w-5 text-orange-500" />} label={t('settings.currentStreak', lang)} value={`${streak?.current_streak || 0} ${t('settings.days', lang)}`} showArrow={false} />
          <div className="border-t border-border" />
          <SettingsItem icon={<Flame className="h-5 w-5 text-primary" />} label={t('settings.longestStreak', lang)} value={`${streak?.longest_streak || 0} ${t('settings.days', lang)}`} showArrow={false} />
        </CardContent>
      </Card>

      {/* Academic Settings */}
      <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
        {t('settings.academic', lang)}
      </h2>
      <Card>
        <CardContent className="p-0">
          <SettingsItem icon={<ArrowUpCircle className="h-5 w-5" />} label={t('settings.class', lang)} value={user.class_level} onClick={() => setShowPromotionDialog(true)} />
          <div className="border-t border-border" />
          <SettingsItem icon={<BookOpen className="h-5 w-5" />} label={t('settings.selectedSubjects', lang)} value={`${user.selected_subjects.length} ${lang === 'bangla' ? 'বিষয়' : 'subjects'}`} onClick={() => navigate('/onboarding/subjects')} />
          <div className="border-t border-border" />
          <SettingsItem icon={<Languages className="h-5 w-5" />} label="AI Language" value={user.preferred_language?.toUpperCase() || 'EN'} />
          <div className="border-t border-border" />
          <SettingsItem icon={<BookUp className="h-5 w-5" />} label={t('settings.changeBooks', lang)} onClick={handleChangeBooks} />
        </CardContent>
      </Card>

      {/* Personalization */}
      <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
        {t('settings.personalization', lang)}
      </h2>
      <Card>
        <CardContent className="p-0">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-4">
                <Moon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <span className="font-medium">{t('settings.theme', lang)}</span>
              </div>
              <ThemeToggle />
            </div>
          </div>
          <div className="border-t border-border" />
          <div className="p-4">
            <div className="flex items-center gap-4 mb-3">
              <Palette className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <span className="font-medium">{t('settings.aiPersonality', lang)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {personalityOptions.map(option => (
                <Button
                  key={option.value}
                  variant={user.personality === option.value ? 'default' : 'outline'}
                  size="sm"
                  className="h-auto py-2 flex flex-col items-start"
                  onClick={() => handlePersonalityChange(option.value)}
                  aria-pressed={user.personality === option.value}
                >
                  <span className="flex items-center gap-1">
                    {option.emoji} {option.label}
                  </span>
                  <span className="text-xs opacity-70">{option.description}</span>
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Privacy & Data */}
      <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
        {t('settings.privacyData', lang)}
      </h2>
      <Card>
        <CardContent className="p-0">
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Shield className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <div>
                <span className="font-medium block">{t('settings.lowDataMode', lang)}</span>
                <span className="text-xs text-muted-foreground">{t('settings.lowDataModeDesc', lang)}</span>
              </div>
            </div>
            <Switch
              checked={user.low_data_mode}
              onCheckedChange={(checked) => updateUser({ low_data_mode: checked })}
              aria-label={t('settings.lowDataMode', lang)}
            />
          </div>
          <div className="border-t border-border" />
          <SettingsItem icon={<Database className="h-5 w-5" />} label={t('settings.storageStatus', lang)} showArrow={false}>
            <Badge variant="secondary">{lang === 'bangla' ? 'লোকাল' : 'Local'}</Badge>
          </SettingsItem>
        </CardContent>
      </Card>

      {/* Support */}
      <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
        {t('settings.support', lang)}
      </h2>
      <Card>
        <CardContent className="p-0">
          <SettingsItem icon={<MessageSquareWarning className="h-5 w-5" />} label={t('settings.reportProblem', lang)} onClick={() => setShowReportDialog(true)} />
        </CardContent>
      </Card>

      {/* Account Actions */}
      <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
        {t('settings.account', lang)}
      </h2>
      <Card>
        <CardContent className="p-0">
          <SettingsItem icon={<LogOut className="h-5 w-5" />} label={t('common.signOut', lang)} onClick={() => setShowSignOutDialog(true)} />
          <div className="border-t border-border" />
          <SettingsItem icon={<RotateCcw className="h-5 w-5" />} label={t('settings.resetOnboarding', lang)} onClick={() => setShowResetDialog(true)} variant="destructive" showArrow={false} />
        </CardContent>
      </Card>

      {/* Version Info */}
      <div className="text-center py-6">
        <p className="text-sm text-muted-foreground">Adomo AI</p>
        <p className="text-xs text-muted-foreground">{t('settings.version', lang)}</p>
      </div>

      {/* Dialogs with ARIA support */}
      <Dialog open={showAgeDialog} onOpenChange={setShowAgeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('settings.updateAge', lang)}</DialogTitle>
          </DialogHeader>
          <Input 
            type="number" 
            placeholder={lang === 'bangla' ? 'আপনার বয়স লিখুন' : 'Enter your age'} 
            value={newAge} 
            onChange={(e) => setNewAge(e.target.value)} 
            min={5} 
            max={25} 
            aria-label={t('settings.age', lang)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAgeDialog(false)}>{t('common.cancel', lang)}</Button>
            <Button onClick={handleAgeUpdate}>{t('common.save', lang)}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPromotionDialog} onOpenChange={setShowPromotionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{lang === 'bangla' ? 'শ্রেণি পরিবর্তন' : 'Change Class'}</DialogTitle>
            <DialogDescription>{lang === 'bangla' ? 'নতুন শ্রেণি নির্বাচন করুন' : 'Select your new class level'}</DialogDescription>
          </DialogHeader>
          <Select value={newClassLevel} onValueChange={setNewClassLevel}>
            <SelectTrigger aria-label={lang === 'bangla' ? 'শ্রেণি নির্বাচন করুন' : 'Select class'}>
              <SelectValue placeholder={lang === 'bangla' ? 'শ্রেণি নির্বাচন করুন' : 'Select class'} />
            </SelectTrigger>
            <SelectContent>
              {classLevels.map(level => (
                <SelectItem key={level} value={level} disabled={level === user.class_level}>{level}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPromotionDialog(false)}>{t('common.cancel', lang)}</Button>
            <Button onClick={handleClassPromotion} disabled={!newClassLevel || newClassLevel === user.class_level || loading}>
              {loading ? t('common.loading', lang) : t('common.save', lang)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('settings.reportProblem', lang)}</DialogTitle>
            <DialogDescription>{lang === 'bangla' ? 'আপনার সমস্যা বা মতামত লিখুন' : 'Describe your problem or feedback'}</DialogDescription>
          </DialogHeader>
          <Textarea 
            placeholder={lang === 'bangla' ? 'আপনার সমস্যা এখানে লিখুন...' : 'Write your problem here...'} 
            value={reportMessage} 
            onChange={(e) => setReportMessage(e.target.value)} 
            rows={5} 
            aria-label="Problem report text"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReportDialog(false)}>{t('common.cancel', lang)}</Button>
            <Button onClick={handleSendReport} disabled={loading}>{loading ? t('common.loading', lang) : lang === 'bangla' ? 'রিপোর্ট পাঠান' : 'Send Report'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showSignOutDialog} onOpenChange={setShowSignOutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{lang === 'bangla' ? 'সাইন আউট করবেন?' : 'Sign Out?'}</AlertDialogTitle>
            <AlertDialogDescription>{lang === 'bangla' ? 'আপনি কি সাইন আউট করতে চান?' : 'Are you sure you want to sign out?'}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', lang)}</AlertDialogCancel>
            <AlertDialogAction onClick={handleSignOut} disabled={loading}>{t('common.signOut', lang)}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{lang === 'bangla' ? 'অনবোর্ডিং রিসেট?' : 'Reset Onboarding?'}</AlertDialogTitle>
            <AlertDialogDescription>{lang === 'bangla' ? 'এটি আপনার সমস্ত ডেটা মুছে ফেলবে এবং প্রথম থেকে শুরু করবে।' : 'This will erase all your data and start from scratch.'}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', lang)}</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset} className="bg-destructive text-destructive-foreground" disabled={loading}>{t('settings.resetOnboarding', lang)}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
