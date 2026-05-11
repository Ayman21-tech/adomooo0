import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import adomoLogo from '@/assets/protibha-logo.png';
import { 
  ArrowRight, 
  Brain, 
  BookOpen, 
  Zap, 
  Target, 
  Users, 
  Award,
  CheckCircle2,
  Sparkles,
  GraduationCap,
  MessageCircle,
  BarChart3,
  ChevronRight,
  Star,
  Menu,
  X,
  Globe,
  Shield,
  Clock,
  Heart,
  TrendingUp,
  Headphones,
  Smartphone,
  Quote
} from 'lucide-react';

type Language = 'en' | 'bn';

const translations = {
  en: {
    nav: {
      home: 'Home',
      features: 'Features',
      howItWorks: 'How It Works',
      about: 'About',
      signIn: 'Sign In',
      getStarted: 'Get Started'
    },
    hero: {
      badge: 'AI-Powered Education Platform',
      title1: 'Learn Smarter',
      title2: 'with Your AI Tutor',
      subtitle: 'Your Personal Learning Companion',
      description: 'Master any subject from Play-class 10 with personalized AI tutoring, interactive lessons, and smart practice sessions grounded in your uploaded textbooks.',
      cta: 'Start Learning Free',
      stats: {
        students: 'Active Students',
        lessons: 'Lessons Available',
        success: 'Success Rate',
        support: 'AI Support'
      }
    },
    features: {
      badge: 'Powerful Features',
      title: 'Everything You Need to',
      titleHighlight: 'Excel',
      subtitle: 'Our platform combines cutting-edge AI with proven learning methods to help you achieve academic success.',
      items: [
        { title: 'AI-Powered Tutoring', desc: 'Get personalized explanations and instant answers to your questions in Bangla or English.' },
        { title: 'Smart Book Grounding', desc: 'AI explanations and practice generated directly from your uploaded book pages, organized by chapter.' },
        { title: 'Practice & Exams', desc: 'Topic-wise quizzes, model tests, and exam preparation with detailed analytics.' },
        { title: 'Progress Tracking', desc: 'Visual dashboards showing your learning journey, strengths, and areas to improve.' },
        { title: 'Voice Interaction', desc: 'Ask questions using voice and get responses read aloud - perfect for auditory learners.' },
        { title: 'Achievements & Streaks', desc: 'Stay motivated with daily streaks, badges, and rewards for consistent learning.' }
      ]
    },
    howItWorks: {
      badge: 'Simple Process',
      title: 'How',
      titleHighlight: 'It Works',
      subtitle: 'Get started in minutes and begin your journey to academic excellence.',
      steps: [
        { title: 'Sign Up & Set Goals', desc: 'Create your profile, select your class, and choose the subjects you want to master.' },
        { title: 'Learn with AI', desc: 'Access lessons, ask the AI tutor questions, and get instant personalized explanations.' },
        { title: 'Practice Daily', desc: 'Complete quizzes, solve problems, and take mock exams to reinforce your learning.' },
        { title: 'Track & Improve', desc: 'Monitor your progress, identify weak areas, and watch yourself grow every day.' }
      ]
    },
    whyChoose: {
      badge: 'Why Choose Us',
      title: 'Built for',
      titleHighlight: 'Your Success',
      items: [
        { title: '100% Free to Start', desc: 'No credit card required. Start learning immediately.' },
        { title: 'Secure & Private', desc: 'Your data is protected with enterprise-grade security.' },
        { title: 'Learn Anytime', desc: 'Access your lessons 24/7 from any device.' },
        { title: 'Made with Love', desc: 'Built by educators who care about student success.' }
      ]
    },
    testimonials: {
      badge: 'Student Stories',
      title: 'Loved by',
      titleHighlight: 'Students',
      items: [
        { name: 'Rahima Akter', class: 'Class 8, Dhaka', text: 'This app helped me improve my math grades from B to A+. The AI explains everything so clearly!' },
        { name: 'Tanvir Hassan', class: 'Class 10, Chittagong', text: 'Preparing for SSC exams became so much easier. I love the practice tests and instant feedback.' },
        { name: 'Nusrat Jahan', class: 'Class 6, Sylhet', text: 'I can ask questions in Bangla and get answers immediately. It\'s like having a private tutor!' }
      ]
    },
    about: {
      badge: 'About Us',
      title: 'Empowering',
      titleHighlight: 'Students',
      titleEnd: 'Across Bangladesh',
      p1: 'Adomo AI was created with a simple mission: to make quality education accessible to every student in Bangladesh, regardless of their location or background.',
      p2: 'Our AI-powered platform adapts to each student\'s learning pace and style, providing personalized support that was previously only available through expensive private tutoring.',
      points: [
        'Grounded in uploaded textbooks',
        'Support in Bangla & English',
        'Affordable for all families',
        'Built by educators & technologists'
      ],
      tagline: 'Nurturing Talent Through Technology'
    },
    cta: {
      title: 'Ready to Start Learning?',
      subtitle: 'Join thousands of students who are already learning smarter with Adomo AI. It\'s free to get started!',
      button: 'Get Started Now'
    },
    footer: {
      tagline: 'Your Learning Companion',
      privacy: 'Privacy',
      terms: 'Terms',
      contact: 'Contact',
      copyright: '© 2024 Adomo AI. All rights reserved.'
    }
  },
  bn: {
    nav: {
      home: 'হোম',
      features: 'বৈশিষ্ট্য',
      howItWorks: 'কিভাবে কাজ করে',
      about: 'আমাদের সম্পর্কে',
      signIn: 'সাইন ইন',
      getStarted: 'শুরু করুন'
    },
    hero: {
      badge: 'এআই-চালিত শিক্ষা প্ল্যাটফর্ম',
      title1: 'স্মার্টভাবে শিখুন',
      title2: 'আপনার এআই টিউটরের সাথে',
      subtitle: 'আপনার ব্যক্তিগত শিক্ষা সহায়ক',
      description: 'আপনার আপলোড করা বই থেকে টেক্সট ও ছবির তথ্যের ভিত্তিতে ব্যক্তিগতকৃত এআই টিউটরিং, ইন্টারেক্টিভ পাঠ এবং স্মার্ট অনুশীলন সেশনের মাধ্যমে ১ম থেকে ১০ম শ্রেণী পর্যন্ত যেকোনো বিষয় আয়ত্ত করুন।',
      cta: 'বিনামূল্যে শেখা শুরু করুন',
      stats: {
        students: 'সক্রিয় শিক্ষার্থী',
        lessons: 'পাঠ উপলব্ধ',
        success: 'সাফল্যের হার',
        support: 'এআই সাপোর্ট'
      }
    },
    features: {
      badge: 'শক্তিশালী বৈশিষ্ট্য',
      title: 'আপনার সাফল্যের জন্য',
      titleHighlight: 'সব কিছু',
      subtitle: 'আমাদের প্ল্যাটফর্ম অত্যাধুনিক এআই এবং প্রমাণিত শিক্ষা পদ্ধতি একত্রিত করে আপনাকে একাডেমিক সাফল্য অর্জনে সহায়তা করে।',
      items: [
        { title: 'এআই-চালিত টিউটরিং', desc: 'বাংলা বা ইংরেজিতে আপনার প্রশ্নের ব্যক্তিগতকৃত ব্যাখ্যা এবং তাৎক্ষণিক উত্তর পান।' },
        { title: 'স্মার্ট বুক গ্রাউন্ডিং', desc: 'আপনার আপলোড করা বইয়ের পৃষ্ঠা থেকে সরাসরি এআই ব্যাখ্যা ও অনুশীলন তৈরি হয়, অধ্যায় অনুযায়ী সাজানো।' },
        { title: 'অনুশীলন ও পরীক্ষা', desc: 'বিস্তারিত বিশ্লেষণসহ টপিক-ভিত্তিক কুইজ, মডেল টেস্ট এবং পরীক্ষার প্রস্তুতি।' },
        { title: 'অগ্রগতি ট্র্যাকিং', desc: 'আপনার শেখার যাত্রা, শক্তি এবং উন্নতির ক্ষেত্র দেখানো ভিজ্যুয়াল ড্যাশবোর্ড।' },
        { title: 'ভয়েস ইন্টারঅ্যাকশন', desc: 'ভয়েস ব্যবহার করে প্রশ্ন জিজ্ঞাসা করুন এবং উত্তর শুনুন - শ্রবণ শিক্ষার্থীদের জন্য উপযুক্ত।' },
        { title: 'অর্জন ও স্ট্রিক', desc: 'ধারাবাহিক শেখার জন্য দৈনিক স্ট্রিক, ব্যাজ এবং পুরস্কার দিয়ে অনুপ্রাণিত থাকুন।' }
      ]
    },
    howItWorks: {
      badge: 'সহজ প্রক্রিয়া',
      title: 'কিভাবে',
      titleHighlight: 'কাজ করে',
      subtitle: 'মিনিটের মধ্যে শুরু করুন এবং একাডেমিক উৎকর্ষতার যাত্রা শুরু করুন।',
      steps: [
        { title: 'সাইন আপ ও লক্ষ্য নির্ধারণ', desc: 'আপনার প্রোফাইল তৈরি করুন, আপনার ক্লাস নির্বাচন করুন এবং যে বিষয়গুলো আয়ত্ত করতে চান তা বেছে নিন।' },
        { title: 'এআই দিয়ে শিখুন', desc: 'পাঠে প্রবেশ করুন, এআই টিউটরকে প্রশ্ন জিজ্ঞাসা করুন এবং তাৎক্ষণিক ব্যক্তিগতকৃত ব্যাখ্যা পান।' },
        { title: 'প্রতিদিন অনুশীলন', desc: 'আপনার শেখা শক্তিশালী করতে কুইজ সম্পূর্ণ করুন, সমস্যা সমাধান করুন এবং মক পরীক্ষা দিন।' },
        { title: 'ট্র্যাক ও উন্নতি', desc: 'আপনার অগ্রগতি পর্যবেক্ষণ করুন, দুর্বল ক্ষেত্র চিহ্নিত করুন এবং প্রতিদিন নিজেকে বাড়তে দেখুন।' }
      ]
    },
    whyChoose: {
      badge: 'কেন আমাদের বেছে নেবেন',
      title: 'আপনার সাফল্যের জন্য',
      titleHighlight: 'তৈরি',
      items: [
        { title: '১০০% বিনামূল্যে শুরু', desc: 'কোনো ক্রেডিট কার্ড প্রয়োজন নেই। এখনই শেখা শুরু করুন।' },
        { title: 'নিরাপদ ও গোপনীয়', desc: 'আপনার ডেটা এন্টারপ্রাইজ-গ্রেড নিরাপত্তা দিয়ে সুরক্ষিত।' },
        { title: 'যেকোনো সময় শিখুন', desc: 'যেকোনো ডিভাইস থেকে ২৪/৭ আপনার পাঠে প্রবেশ করুন।' },
        { title: 'ভালোবাসায় তৈরি', desc: 'শিক্ষার্থীদের সাফল্যের প্রতি যত্নশীল শিক্ষাবিদদের দ্বারা তৈরি।' }
      ]
    },
    testimonials: {
      badge: 'শিক্ষার্থীদের গল্প',
      title: 'শিক্ষার্থীদের',
      titleHighlight: 'পছন্দ',
      items: [
        { name: 'রাহিমা আক্তার', class: '৮ম শ্রেণী, ঢাকা', text: 'এই অ্যাপ আমার গণিতের গ্রেড বি থেকে এ+ এ উন্নীত করতে সাহায্য করেছে। এআই সবকিছু এত স্পষ্টভাবে ব্যাখ্যা করে!' },
        { name: 'তানভীর হাসান', class: '১০ম শ্রেণী, চট্টগ্রাম', text: 'এসএসসি পরীক্ষার প্রস্তুতি অনেক সহজ হয়ে গেছে। আমি অনুশীলন পরীক্ষা এবং তাৎক্ষণিক ফিডব্যাক ভালোবাসি।' },
        { name: 'নুসরাত জাহান', class: '৬ষ্ঠ শ্রেণী, সিলেট', text: 'আমি বাংলায় প্রশ্ন জিজ্ঞাসা করতে পারি এবং তাৎক্ষণিক উত্তর পাই। এটা যেন একজন ব্যক্তিগত টিউটর আছে!' }
      ]
    },
    about: {
      badge: 'আমাদের সম্পর্কে',
      title: 'বাংলাদেশ জুড়ে',
      titleHighlight: 'শিক্ষার্থীদের',
      titleEnd: 'ক্ষমতায়ন',
      p1: 'Adomo AI একটি সহজ মিশন নিয়ে তৈরি হয়েছে: বাংলাদেশের প্রতিটি শিক্ষার্থীর জন্য মানসম্পন্ন শিক্ষা সুলভ করা, তাদের অবস্থান বা পটভূমি নির্বিশেষে।',
      p2: 'আমাদের এআই-চালিত প্ল্যাটফর্ম প্রতিটি শিক্ষার্থীর শেখার গতি এবং স্টাইলের সাথে মানিয়ে নেয়, ব্যক্তিগতকৃত সহায়তা প্রদান করে যা আগে শুধুমাত্র ব্যয়বহুল প্রাইভেট টিউটরিংয়ের মাধ্যমে পাওয়া যেত।',
      points: [
        'আপলোড করা পাঠ্যবই-ভিত্তিক শেখানো',
        'বাংলা ও ইংরেজিতে সহায়তা',
        'সব পরিবারের জন্য সাশ্রয়ী',
        'শিক্ষাবিদ ও প্রযুক্তিবিদদের দ্বারা তৈরি'
      ],
      tagline: 'প্রযুক্তির মাধ্যমে প্রতিভা লালন'
    },
    cta: {
      title: 'শেখা শুরু করতে প্রস্তুত?',
      subtitle: 'হাজার হাজার শিক্ষার্থীর সাথে যোগ দিন যারা ইতিমধ্যে Adomo AI দিয়ে স্মার্টভাবে শিখছে। শুরু করা বিনামূল্যে!',
      button: 'এখনই শুরু করুন'
    },
    footer: {
      tagline: 'আপনার শিক্ষা সহায়ক',
      privacy: 'গোপনীয়তা',
      terms: 'শর্তাবলী',
      contact: 'যোগাযোগ',
      copyright: '© ২০২৪ Adomo AI। সর্বস্বত্ব সংরক্ষিত।'
    }
  }
};

export default function Website() {
  const navigate = useNavigate();
  const { user, loading, isOnboardingComplete } = useUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [language, setLanguage] = useState<Language>('en');
  
  useEffect(() => {
    if (!loading && isOnboardingComplete) {
      navigate('/home', { replace: true });
    }
  }, [loading, isOnboardingComplete, navigate]);

  const t = translations[language];

  const navLinks = [
    { name: t.nav.home, href: '#home' },
    { name: t.nav.features, href: '#features' },
    { name: t.nav.howItWorks, href: '#how-it-works' },
    { name: t.nav.about, href: '#about' },
  ];

  const featureIcons = [Brain, BookOpen, Target, BarChart3, MessageCircle, Award];
  const featureGradients = [
    'from-purple-500 to-indigo-600',
    'from-blue-500 to-cyan-500',
    'from-orange-500 to-red-500',
    'from-green-500 to-emerald-500',
    'from-pink-500 to-rose-500',
    'from-amber-500 to-yellow-500'
  ];

  const howItWorksIcons = [Users, Brain, Target, BarChart3];

  const whyChooseIcons = [Zap, Shield, Clock, Heart];

  const stats = [
    { value: '10K+', label: t.hero.stats.students },
    { value: '500+', label: t.hero.stats.lessons },
    { value: '95%', label: t.hero.stats.success },
    { value: '24/7', label: t.hero.stats.support }
  ];

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'bn' : 'en');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <img src={adomoLogo} alt="Adomo AI" className="w-16 h-16 object-contain animate-pulse" />
          <p className="text-sm text-muted-foreground">Checking session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <img 
                src={adomoLogo} 
                alt="Adomo AI" 
                className="w-10 h-10 object-contain drop-shadow-lg"
              />
              <span className="font-bold text-xl gradient-text hidden sm:block">Adomo AI</span>
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <a 
                  key={link.name}
                  href={link.href}
                  className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium relative group"
                >
                  {link.name}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 gradient-primary group-hover:w-full transition-all duration-300" />
                </a>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Language Toggle */}
              <button
                onClick={toggleLanguage}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors text-sm font-medium"
              >
                <Globe className="w-4 h-4 text-primary" />
                <span className="hidden sm:inline">{language === 'en' ? 'বাংলা' : 'English'}</span>
                <span className="sm:hidden">{language === 'en' ? 'বা' : 'EN'}</span>
              </button>
              
              <ThemeToggle />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/signin')}
                className="hidden sm:flex"
              >
                {t.nav.signIn}
              </Button>
              <Button
                size="sm"
                onClick={() => navigate('/signin')}
                className="btn-premium text-primary-foreground rounded-xl"
              >
                <span className="relative z-10">{t.nav.getStarted}</span>
              </Button>
              
              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary/50 transition-colors"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-background/95 backdrop-blur-xl border-t border-border/50 py-4 animate-fade-in">
            <div className="px-4 space-y-1">
              {navLinks.map((link) => (
                <a 
                  key={link.name}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors text-sm font-medium py-3 px-4 rounded-xl"
                >
                  {link.name}
                </a>
              ))}
              <button
                onClick={() => { navigate('/signin'); setMobileMenuOpen(false); }}
                className="block w-full text-left text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors text-sm font-medium py-3 px-4 rounded-xl"
              >
                {t.nav.signIn}
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section id="home" className="relative pt-28 sm:pt-32 pb-16 sm:pb-24 px-4 overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-mesh pointer-events-none" />
        <div className="absolute top-20 -left-40 w-[500px] h-[500px] rounded-full bg-primary/15 blur-[100px] animate-pulse" />
        <div className="absolute bottom-20 -right-40 w-[400px] h-[400px] rounded-full bg-gradient-to-br from-purple-500/15 to-pink-500/15 blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />
        
        <div className="relative max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card mb-8 slide-up border border-primary/20">
              <Sparkles className="w-4 h-4 text-primary animate-pulse" />
              <span className="text-sm font-medium">{t.hero.badge}</span>
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            </div>

            {/* Main Heading */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 slide-up leading-tight" style={{ animationDelay: '100ms' }}>
              <span className="gradient-text">{t.hero.title1}</span>
              <br />
              <span className="text-foreground">{t.hero.title2}</span>
            </h1>

            {/* Subheading */}
            <p className="text-xl sm:text-2xl text-primary/80 mb-4 font-medium slide-up" style={{ animationDelay: '200ms' }}>
              {t.hero.subtitle}
            </p>
            <p className="text-base sm:text-lg text-muted-foreground mb-10 max-w-2xl mx-auto slide-up leading-relaxed" style={{ animationDelay: '250ms' }}>
              {t.hero.description}
            </p>

            {/* CTA Button */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 slide-up" style={{ animationDelay: '300ms' }}>
              <Button
                size="lg"
                onClick={() => navigate('/signin')}
                className="w-full sm:w-auto h-14 px-10 text-lg font-semibold rounded-2xl btn-premium text-primary-foreground group"
              >
                <span className="relative z-10 flex items-center gap-2">
                  {t.hero.cta}
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8 max-w-4xl mx-auto slide-up" style={{ animationDelay: '400ms' }}>
              {stats.map((stat, i) => (
                <div 
                  key={i} 
                  className="glass-card rounded-2xl p-4 sm:p-6 text-center group hover:scale-105 transition-transform duration-300"
                >
                  <div className="text-3xl sm:text-4xl font-bold gradient-text mb-1 group-hover:scale-110 transition-transform">{stat.value}</div>
                  <div className="text-xs sm:text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Floating Icons */}
        <div className="hidden lg:block absolute top-40 left-20 w-16 h-16 glass-card rounded-2xl flex items-center justify-center float opacity-60">
          <BookOpen className="w-8 h-8 text-primary" />
        </div>
        <div className="hidden lg:block absolute top-60 right-20 w-14 h-14 glass-card rounded-2xl flex items-center justify-center float opacity-60" style={{ animationDelay: '1s' }}>
          <Brain className="w-7 h-7 text-primary" />
        </div>
        <div className="hidden lg:block absolute bottom-40 left-32 w-12 h-12 glass-card rounded-xl flex items-center justify-center float opacity-60" style={{ animationDelay: '0.5s' }}>
          <Zap className="w-6 h-6 text-primary" />
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 sm:py-24 px-4 relative">
        <div className="absolute inset-0 gradient-subtle pointer-events-none" />
        
        <div className="relative max-w-7xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card mb-4 border border-primary/20">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">{t.features.badge}</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              {t.features.title} <span className="gradient-text">{t.features.titleHighlight}</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {t.features.subtitle}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {t.features.items.map((feature, i) => {
              const Icon = featureIcons[i];
              return (
                <div 
                  key={i}
                  className="group glass-card rounded-3xl p-6 sm:p-8 card-hover border border-transparent hover:border-primary/20 stagger-children"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${featureGradients[i]} flex items-center justify-center mb-5 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3 group-hover:text-primary transition-colors">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-16 sm:py-24 px-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-primary/10 blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-purple-500/10 blur-[100px]" />
        
        <div className="relative max-w-7xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card mb-4 border border-primary/20">
              <GraduationCap className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">{t.howItWorks.badge}</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              {t.howItWorks.title} <span className="gradient-text">{t.howItWorks.titleHighlight}</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {t.howItWorks.subtitle}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {t.howItWorks.steps.map((item, i) => {
              const Icon = howItWorksIcons[i];
              return (
                <div 
                  key={i}
                  className="relative stagger-children"
                  style={{ animationDelay: `${i * 150}ms` }}
                >
                  {/* Connector Line */}
                  {i < t.howItWorks.steps.length - 1 && (
                    <div className="hidden lg:block absolute top-12 left-[60%] w-full h-0.5 bg-gradient-to-r from-primary/50 to-transparent" />
                  )}
                  
                  <div className="glass-card rounded-3xl p-6 text-center relative z-10 h-full border border-transparent hover:border-primary/20 transition-colors group">
                    {/* Step Number */}
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-sm font-bold text-primary-foreground shadow-lg group-hover:scale-110 transition-transform">
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-5 mt-4 group-hover:bg-primary/20 transition-colors">
                      <Icon className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-3">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section className="py-16 sm:py-24 px-4 relative">
        <div className="absolute inset-0 bg-mesh pointer-events-none opacity-30" />
        
        <div className="relative max-w-7xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card mb-4 border border-primary/20">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">{t.whyChoose.badge}</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              {t.whyChoose.title} <span className="gradient-text">{t.whyChoose.titleHighlight}</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {t.whyChoose.items.map((item, i) => {
              const Icon = whyChooseIcons[i];
              return (
                <div 
                  key={i}
                  className="glass-card rounded-2xl p-6 text-center group hover:scale-105 transition-all duration-300 border border-transparent hover:border-primary/20"
                >
                  <div className="w-12 h-12 mx-auto rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-16 sm:py-24 px-4 relative overflow-hidden">
        <div className="absolute top-20 left-0 w-[400px] h-[400px] rounded-full bg-primary/10 blur-[100px]" />
        
        <div className="relative max-w-7xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card mb-4 border border-primary/20">
              <Heart className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">{t.testimonials.badge}</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              {t.testimonials.title} <span className="gradient-text">{t.testimonials.titleHighlight}</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {t.testimonials.items.map((testimonial, i) => (
              <div 
                key={i}
                className="glass-card rounded-3xl p-6 sm:p-8 relative group hover:scale-[1.02] transition-all duration-300"
              >
                <Quote className="w-10 h-10 text-primary/20 absolute top-6 right-6" />
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-muted-foreground mb-6 leading-relaxed italic">"{testimonial.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-semibold">
                    {testimonial.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{testimonial.name}</p>
                    <p className="text-xs text-muted-foreground">{testimonial.class}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-16 sm:py-24 px-4 relative">
        <div className="absolute inset-0 bg-mesh pointer-events-none opacity-50" />
        
        <div className="relative max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 items-center">
            {/* Left Content */}
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card mb-6 border border-primary/20">
                <Star className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">{t.about.badge}</span>
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
                {t.about.title} <span className="gradient-text">{t.about.titleHighlight}</span> {t.about.titleEnd}
              </h2>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                {t.about.p1}
              </p>
              <p className="text-muted-foreground mb-8 leading-relaxed">
                {t.about.p2}
              </p>

              <div className="grid sm:grid-cols-2 gap-3">
                {t.about.points.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 glass-card rounded-xl p-3">
                    <div className="w-6 h-6 rounded-full gradient-primary flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-4 h-4 text-primary-foreground" />
                    </div>
                    <span className="text-sm font-medium">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Content - Visual */}
            <div className="relative">
              <div className="glass-card rounded-3xl p-8 sm:p-10 relative overflow-hidden">
                <div className="absolute inset-0 gradient-subtle" />
                <div className="relative">
                  <div className="flex items-center justify-center mb-8">
                    <div className="relative">
                      <img 
                        src={adomoLogo} 
                        alt="Adomo AI" 
                        className="w-32 h-32 sm:w-40 sm:h-40 object-contain drop-shadow-2xl"
                      />
                      <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl -z-10 animate-pulse" />
                    </div>
                  </div>
                  <div className="text-center">
                    <h3 className="text-2xl sm:text-3xl font-bold gradient-text mb-2">Adomo AI</h3>
                    <p className="text-muted-foreground">{t.about.tagline}</p>
                  </div>
                </div>
              </div>
              
              {/* Floating Elements */}
              <div className="absolute -top-4 -right-4 w-20 sm:w-24 h-20 sm:h-24 rounded-2xl glass-card flex items-center justify-center float shadow-lg">
                <Brain className="w-8 sm:w-10 h-8 sm:h-10 text-primary" />
              </div>
              <div className="absolute -bottom-4 -left-4 w-16 sm:w-20 h-16 sm:h-20 rounded-2xl glass-card flex items-center justify-center float shadow-lg" style={{ animationDelay: '1s' }}>
                <GraduationCap className="w-7 sm:w-8 h-7 sm:h-8 text-primary" />
              </div>
              <div className="absolute top-1/2 -left-8 w-14 h-14 rounded-xl glass-card flex items-center justify-center float shadow-lg" style={{ animationDelay: '0.5s' }}>
                <Smartphone className="w-6 h-6 text-primary" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-24 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="glass-card rounded-3xl p-8 sm:p-12 text-center relative overflow-hidden border border-primary/20">
            <div className="absolute inset-0 gradient-primary opacity-5" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] rounded-full bg-primary/20 blur-[80px]" />
            <div className="relative">
              <div className="w-16 h-16 mx-auto rounded-2xl gradient-primary flex items-center justify-center mb-6 shadow-lg">
                <Sparkles className="w-8 h-8 text-primary-foreground" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                {t.cta.title}
              </h2>
              <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
                {t.cta.subtitle}
              </p>
              <Button
                size="lg"
                onClick={() => navigate('/signin')}
                className="h-14 px-10 text-lg font-semibold rounded-2xl btn-premium text-primary-foreground group"
              >
                <span className="relative z-10 flex items-center gap-2">
                  {t.cta.button}
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 sm:py-12 px-4 border-t border-border/50">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img 
                src={adomoLogo} 
                alt="Adomo AI" 
                className="w-10 h-10 object-contain"
              />
              <div>
                <span className="font-bold gradient-text">Adomo AI</span>
                <p className="text-xs text-muted-foreground">{t.footer.tagline}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">{t.footer.privacy}</a>
              <a href="#" className="hover:text-foreground transition-colors">{t.footer.terms}</a>
              <a href="#" className="hover:text-foreground transition-colors">{t.footer.contact}</a>
            </div>
            
            <p className="text-sm text-muted-foreground text-center md:text-right">
              {t.footer.copyright}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
