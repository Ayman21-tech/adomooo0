import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Trash2, Bot, User, Mic, MicOff, Volume2, VolumeX, ImagePlus, X, Loader2, Maximize2, Minimize2, Play, Pause, Square, Search, ShieldCheck, ShieldAlert, Shield, Menu, MessageSquare, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { useAIChat } from '@/hooks/useAIChat';
import { useUser } from '@/contexts/UserContext';
import { useLearningEngine } from '@/hooks/useLearningEngine';
import ReactMarkdown from 'react-markdown';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import adomoLogo from '@/assets/protibha-logo.png';

interface AIChatPanelProps {
  subjectName: string;
  subjectId?: string;
  lessonContext?: string;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

// Detect if text contains Bengali/Bangla characters
const hasBengaliScript = (text: string): boolean => {
  return /[\u0980-\u09FF]/.test(text);
};

export function AIChatPanel({ subjectName, subjectId, lessonContext, isFullscreen, onToggleFullscreen }: AIChatPanelProps) {
  const { user } = useUser();
  const { runIntelligenceCycle } = useLearningEngine();
  const [input, setInput] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isTTSLoading, setIsTTSLoading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [speakingLanguage, setSpeakingLanguage] = useState<'en' | 'bn' | null>(null);
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);
  const [bookContext, setBookContext] = useState<string>('');
  const [isWebSearching, setIsWebSearching] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Get language from user settings - this is the PRIMARY source of truth
  const primaryLanguage = user.default_language;
  const isGeneralTutor = !subjectId || subjectName.toLowerCase().includes('general');

  // Load book/chapter context from database including OCR extracted text
  useEffect(() => {
    const loadBookContext = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const subjectKey = subjectId || subjectName.toLowerCase().replace(/\s+/g, '-');

        // Get syllabus chapters for this subject (or all subjects for general tutor mode)
        let chaptersQuery = supabase
          .from('syllabus_library')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('is_archived', false)
          .order('subject_id')
          .order('chapter_order');
        if (!isGeneralTutor) {
          chaptersQuery = chaptersQuery.eq('subject_id', subjectKey);
        }
        const { data: chapters } = await chaptersQuery;

        // Get book pages with extracted text (or all subjects for general tutor mode)
        let pagesQuery = supabase
          .from('book_pages')
          .select('subject_id, chapter_name, chapter_id, page_number, notes, tags, extracted_text, structured_content, ocr_status')
          .eq('user_id', session.user.id)
          .eq('is_archived', false)
          .order('subject_id')
          .order('created_at', { ascending: false });
        if (!isGeneralTutor) {
          pagesQuery = pagesQuery.eq('subject_id', subjectKey);
        }
        const { data: pages } = await pagesQuery;

        let context = '';
        if (chapters && chapters.length > 0) {
          context += 'Uploaded Chapters:\n';
          chapters.forEach((ch, i) => {
            context += `${i + 1}. "${ch.chapter_name}" (Order: ${ch.chapter_order + 1})`;
            if (ch.topics && ch.topics.length > 0) {
              context += ' - Topics: ' + ch.topics.join(', ');
            }
            context += '\n';
          });
        }

        // Include extracted text from OCR
        if (pages && pages.length > 0) {
          const pagesWithText = pages.filter(p => p.extracted_text);
          if (pagesWithText.length > 0) {
            context += '\n## EXTRACTED BOOK CONTENT (PRIMARY REFERENCE):\n';
            const byChapter = new Map<string, string[]>();
            pagesWithText.forEach(p => {
              const key = `${p.subject_id || 'general'}::${p.chapter_name || 'General'}`;
              if (!byChapter.has(key)) byChapter.set(key, []);
              byChapter.get(key)!.push(p.extracted_text!);
            });
            byChapter.forEach((texts, chapterKey) => {
              const [chapterSubject, chapterName] = chapterKey.split('::');
              context += `\n### ${chapterName} (Subject: ${chapterSubject}):\n`;
              context += texts.join('\n---\n');
              context += '\n';
            });
          }

          // Still include page count info
          const chapterPages = new Map<string, number>();
          pages.forEach(p => {
            const key = `${p.subject_id || 'general'}::${p.chapter_name || 'Unknown'}`;
            chapterPages.set(key, (chapterPages.get(key) || 0) + 1);
          });
          context += '\nUploaded Book Pages:\n';
          chapterPages.forEach((count, key) => {
            const [chapterSubject, chapterName] = key.split('::');
            context += `- ${chapterName} (Subject: ${chapterSubject}): ${count} pages uploaded\n`;
          });
        }
        setBookContext(context);
      } catch (e) {
        console.error('Failed to load book context:', e);
      }
    };
    loadBookContext();
  }, [subjectName, subjectId, isGeneralTutor]);
  
  const { messages, isLoading, sendMessage, clearMessages, chatSessions, currentSessionId, setCurrentSessionId, createNewSession } = useAIChat({
    subject: subjectId || subjectName,
    lessonContext: `${lessonContext || ''} | Language: ${primaryLanguage === 'bangla' ? 'Bengali/Bangla' : 'English'} | PreferredLanguage: ${user.preferred_language || 'en'} | Student Name: ${user.name} | Class: ${user.class_level} | School: ${user.school_name}`,
    bookContext,
  });

  // Handle browser fullscreen API
  const toggleBrowserFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        if (containerRef.current) {
          await containerRef.current.requestFullscreen();
          setIsBrowserFullscreen(true);
        }
      } else {
        await document.exitFullscreen();
        setIsBrowserFullscreen(false);
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
      toast({
        title: 'Fullscreen unavailable',
        description: 'Your browser blocked fullscreen mode. Try clicking the button again.',
        variant: 'destructive',
      });
      // Fallback to regular fullscreen toggle
      if (onToggleFullscreen) {
        onToggleFullscreen();
      }
    }
  }, [onToggleFullscreen]);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsBrowserFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Handle ESC key for fullscreen exit hint
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isBrowserFullscreen) {
        // Browser handles this automatically, but we update state
        setIsBrowserFullscreen(false);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isBrowserFullscreen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-speak new assistant messages if enabled + trigger mastery tracking
  useEffect(() => {
    if (messages.length >= 2 && !isLoading) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant') {
        // Auto-speak
        if (autoSpeak) {
          speakText(lastMessage.content);
        }
        // Run intelligence cycle for concept mastery tracking
        const userMsg = messages[messages.length - 2];
        if (userMsg?.role === 'user' && subjectId) {
          runIntelligenceCycle(
            subjectId,
            userMsg.content,
            lastMessage.content,
          ).then(result => {
            if (result?.memory_promoted) {
              toast({
                title: '🧠 ' + (primaryLanguage === 'bangla' ? 'আমি আপনার শেখার ধরন বুঝতে পারছি!' : "I've learned something about how you study!"),
                description: primaryLanguage === 'bangla' ? 'আপনার শেখার ধরন দীর্ঘমেয়াদী মেমোরিতে সংরক্ষিত হয়েছে।' : 'A learning pattern has been promoted to long-term memory.',
              });
            }
          }).catch(() => {});
        }
      }
    }
  }, [messages, isLoading, autoSpeak, subjectId, runIntelligenceCycle]);

  // Handle paste for images (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            if (file.size > 5 * 1024 * 1024) {
              toast({
                title: 'Image too large',
                description: 'Please paste an image under 5MB',
                variant: 'destructive',
              });
              return;
            }

            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
              setImageUrl(reader.result as string);
            };
            reader.readAsDataURL(file);
            
            toast({
              title: '📷 Image attached',
              description: 'Your image is ready to send with your message',
            });
          }
          break;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((input.trim() || imageUrl) && !isLoading) {
      await sendMessage(input, imageUrl || undefined);
      setInput('');
      setImageUrl(null);
      setImageFile(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Image upload handling
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'Image too large',
          description: 'Please select an image under 5MB',
          variant: 'destructive',
        });
        return;
      }

      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageUrl(null);
    setImageFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  const handleWebSearch = async () => {
    const query = input.trim();
    if (!query || isLoading || isWebSearching) return;

    setIsWebSearching(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/web-search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ query, max_results: 5 }),
      });

      if (!response.ok) {
        throw new Error('Web search failed');
      }

      const data = await response.json();
      const results = Array.isArray(data?.results) ? data.results : [];
      const summary = data?.summary || '';
      
      if (results.length === 0 && !summary) {
        toast({
          title: 'No web results found',
          description: 'Try a more specific search query.',
          variant: 'destructive',
        });
        return;
      }

      let webContext = '';
      if (summary) {
        webContext = `AI-powered web search summary:\n${summary}\n\n`;
      }
      if (results.length > 0) {
        webContext += results
          .slice(0, 5)
          .map((r: any, i: number) => `${i + 1}. ${r.title}\n${r.snippet || ''}\nURL: ${r.url}`)
          .join('\n\n');
      }

      const enrichedPrompt = `${query}\n\nLive web search results (use only as secondary source after uploaded books):\n${webContext}`;
      await sendMessage(enrichedPrompt);
      setInput('');
    } catch (error) {
      console.error('Web search failed:', error);
      toast({
        title: 'Web search failed',
        description: 'Could not fetch live results right now. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsWebSearching(false);
    }
  };

  // Voice recording
  const startRecording = async () => {
    try {
      // Pre-check permission for clearer errors
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Your browser does not support microphone recording.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        if (audioBlob.size > 0) {
          await transcribeAudio(audioBlob);
        } else {
          toast({ title: 'No audio captured', description: 'Try again.' });
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error: any) {
      console.error('Failed to start recording:', error);
      let description = 'Please allow microphone access to use voice input';
      if (error?.name === 'NotAllowedError') {
        description = 'Microphone permission denied. Click the lock icon in your address bar and allow microphone access.';
      } else if (error?.name === 'NotFoundError') {
        description = 'No microphone detected on this device.';
      } else if (error?.name === 'NotReadableError') {
        description = 'Microphone is already in use by another app.';
      } else if (error?.message) {
        description = error.message;
      }
      toast({
        title: 'Microphone Error',
        description,
        variant: 'destructive',
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      // Send the user's ISO language code (e.g. "en", "bn", "es"), not legacy bangla/english
      formData.append('language', user.preferred_language || 'en');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-stt`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      const data = await response.json();
      if (data.text) {
        setInput(prev => prev + (prev ? ' ' : '') + data.text);
        textareaRef.current?.focus();
      } else {
        toast({
          title: 'No speech detected',
          description: 'Please try again and speak clearly into your microphone.',
        });
      }
    } catch (error) {
      console.error('Transcription error:', error);
      toast({
        title: 'Transcription Failed',
        description: 'Could not transcribe your voice. Please check your microphone and try again.',
        variant: 'destructive',
      });
    } finally {
      setIsTranscribing(false);
    }
  };

  // Enhanced Text-to-speech with language detection
  const speakText = useCallback(async (text: string) => {
    // Stop if already speaking
    if (isSpeaking && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
      setIsSpeaking(false);
      setIsTTSLoading(false);
      setIsPaused(false);
      setSpeakingLanguage(null);
      return;
    }

    // Clean markdown from text
    const cleanText = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`(.*?)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\[GENERATE_IMAGE:.*?\]/gi, '')
      .slice(0, 1500);

    if (!cleanText.trim()) return;

    // Detect language from content (Bengali script = Bangla, otherwise use ISO preference)
    const contentHasBengali = hasBengaliScript(cleanText);
    const userLangIso = (user.preferred_language || 'en').toLowerCase();
    const detectedLanguage = contentHasBengali ? 'bn' : (userLangIso === 'bn' || primaryLanguage === 'bangla' ? 'bn' : 'en');

    setSpeakingLanguage(detectedLanguage);
    setIsTTSLoading(true);

    // CRITICAL: Pre-create the Audio element SYNCHRONOUSLY (still inside the user gesture)
    // so browsers don't block playback after the awaited fetch.
    const audio = new Audio();
    audio.playbackRate = playbackSpeed;
    audioRef.current = audio;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            text: cleanText,
            // Send ISO code for non-Bangla languages so the edge fn picks the right voice
            language: detectedLanguage === 'bn' ? 'bn' : userLangIso,
            speed: playbackSpeed,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('TTS failed');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      audio.src = audioUrl;

      setIsTTSLoading(false);
      setIsSpeaking(true);

      audio.onended = () => {
        setIsSpeaking(false);
        setIsPaused(false);
        setSpeakingLanguage(null);
        audioRef.current = null;
        URL.revokeObjectURL(audioUrl);
      };

      audio.onerror = () => {
        setIsSpeaking(false);
        setIsTTSLoading(false);
        setIsPaused(false);
        setSpeakingLanguage(null);
        audioRef.current = null;
        toast({
          title: 'Audio Error',
          description: 'Audio playback failed. Please try again.',
          variant: 'destructive',
        });
      };

      try {
        await audio.play();
      } catch (playErr: any) {
        console.error('audio.play() blocked:', playErr);
        setIsSpeaking(false);
        setIsTTSLoading(false);
        toast({
          title: 'Tap again to play',
          description: 'Your browser blocked autoplay. Please click the speak button once more.',
        });
      }
    } catch (error) {
      console.error('TTS error:', error);
      setIsSpeaking(false);
      setIsTTSLoading(false);
      setIsPaused(false);
      setSpeakingLanguage(null);
      toast({
        title: 'Speech Failed',
        description: 'Could not play audio. Please try again.',
        variant: 'destructive',
      });
    }
  }, [isSpeaking, primaryLanguage, playbackSpeed]);

  // Playback controls
  const togglePause = useCallback(() => {
    if (!audioRef.current) return;
    
    if (isPaused) {
      audioRef.current.play();
      setIsPaused(false);
    } else {
      audioRef.current.pause();
      setIsPaused(true);
    }
  }, [isPaused]);

  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsSpeaking(false);
    setIsPaused(false);
    setSpeakingLanguage(null);
  }, []);

  const handleSpeedChange = useCallback((value: number[]) => {
    const speed = value[0];
    setPlaybackSpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  }, []);

  const effectiveFullscreen = isFullscreen || isBrowserFullscreen;
  const containerHeight = effectiveFullscreen ? 'h-[100dvh]' : 'h-[500px]';

  return (
    <div 
      ref={containerRef}
      className={`flex flex-col ${containerHeight} bg-card rounded-xl border border-border overflow-hidden relative ${effectiveFullscreen ? 'fixed inset-0 z-50 rounded-none' : ''}`}
    >
      {/* ESC hint when in browser fullscreen */}
      {isBrowserFullscreen && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-background/80 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs text-muted-foreground border border-border/50 animate-fade-in">
          Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-foreground font-mono">ESC</kbd> to exit fullscreen
        </div>
      )}

      {/* Main Layout Flex Container */}
      <div className="flex flex-1 overflow-hidden h-full">
        {/* Sidebar */}
        <div className={cn(
          "bg-muted/30 border-r border-border flex flex-col transition-all duration-300 z-40",
          isSidebarOpen ? "w-64 absolute h-full shadow-xl bg-card sm:relative" : "w-0 overflow-hidden sm:w-0"
        )}>
          <div className="p-3 border-b border-border flex justify-between items-center bg-card shrink-0">
            <h3 className="font-semibold text-sm truncate">Chat History</h3>
            <Button variant="ghost" size="icon" className="h-6 w-6 sm:hidden shrink-0" onClick={() => setIsSidebarOpen(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="p-2 shrink-0">
            <Button 
              variant="outline" 
              className="w-full justify-start gap-2 mb-2 bg-background shrink-0" 
              onClick={() => { createNewSession(); setIsSidebarOpen(false); }}
            >
              <Plus className="w-4 h-4 shrink-0" /> <span className="truncate">New Chat</span>
            </Button>
          </div>
          <ScrollArea className="flex-1 px-2">
            <div className="space-y-1 pb-4">
              {chatSessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => { setCurrentSessionId(session.id); setIsSidebarOpen(false); }}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-colors",
                    currentSessionId === session.id 
                      ? "bg-primary/10 text-primary font-medium" 
                      : "hover:bg-muted text-muted-foreground hover:text-foreground"
                  )}
                  title={session.title}
                >
                  <MessageSquare className="w-4 h-4 shrink-0" />
                  <span className="truncate">{session.title}</span>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Chat Area Container */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30 shrink-0">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2 shrink-0" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                <Menu className="w-5 h-5" />
              </Button>
              <img src={adomoLogo} alt="Adomo AI" className="hidden sm:block w-10 h-10 object-contain shrink-0" />
              <div className="min-w-0">
                <h3 className="font-semibold text-sm truncate">Adomo AI</h3>
                <p className="text-xs text-muted-foreground hidden sm:block truncate">
                  Your AI Tutor • {primaryLanguage === 'bangla' ? 'বাংলা' : 'English'}
                </p>
                {isTTSLoading && (
                  <p className="text-[11px] text-primary mt-0.5 flex items-center gap-1 truncate">
                    <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                    {primaryLanguage === 'bangla' ? 'ভয়েস প্রস্তুত হচ্ছে...' : 'Preparing voice...'}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <Button
                variant={autoSpeak ? 'default' : 'ghost'}
                size="icon"
                onClick={() => setAutoSpeak(!autoSpeak)}
                className="h-8 w-8"
                title={autoSpeak ? 'Auto-speak enabled' : 'Auto-speak disabled'}
              >
                {autoSpeak ? <Volume2 className="w-4 h-4 shrink-0" /> : <VolumeX className="w-4 h-4 shrink-0" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleBrowserFullscreen}
                className="h-8 w-8 hidden sm:flex"
                title={effectiveFullscreen ? 'Exit fullscreen (ESC)' : 'Fullscreen'}
              >
                {effectiveFullscreen ? <Minimize2 className="w-4 h-4 shrink-0" /> : <Maximize2 className="w-4 h-4 shrink-0" />}
              </Button>
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearMessages}
                  className="text-muted-foreground hover:text-foreground hidden sm:flex"
                >
                  <Trash2 className="w-4 h-4 mr-1 shrink-0" />
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4">
            <img src={adomoLogo} alt="Adomo AI" className="w-20 h-20 object-contain mb-4" />
            <h3 className="font-semibold mb-2">
              {primaryLanguage === 'bangla' ? `হ্যালো ${user.name || ''}! আমি Adomo AI` : `Hello ${user.name || ''}! I'm Adomo AI`}
            </h3>
            <p className="text-sm text-muted-foreground max-w-[280px]">
              {primaryLanguage === 'bangla' 
                ? `আমি তোমার বন্ধুত্বপূর্ণ AI শিক্ষক। ${subjectName} সম্পর্কে যেকোনো প্রশ্ন কর! ছবি পেস্ট করতে Ctrl+V চাপো।`
                : `I'm your friendly AI tutor. Ask me anything about ${subjectName}! Press Ctrl+V to paste images.`
              }
            </p>
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              {(primaryLanguage === 'bangla' 
                ? ["এই বিষয়টি সহজভাবে বোঝাও", "একটি অনুশীলনী প্রশ্ন দাও", "আমাকে বুঝতে সাহায্য কর..."]
                : ["Explain this topic simply", "Give an example", "Help me understand..."]
              ).map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-3 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  {message.imageUrl && (
                    <img 
                      src={message.imageUrl} 
                      alt="Uploaded" 
                      className="max-w-full h-auto rounded-lg mb-2 max-h-40 object-cover"
                    />
                  )}
                  {message.generatedImageUrl && (
                    <div className="mb-3">
                      <img 
                        src={message.generatedImageUrl} 
                        alt="AI Generated" 
                        className="max-w-full h-auto rounded-lg max-h-64 object-contain border border-border"
                      />
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <span className="inline-block w-2 h-2 bg-primary rounded-full animate-pulse"></span>
                        AI Generated Image
                      </p>
                    </div>
                  )}
                  {message.role === 'assistant' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm">{message.content}</p>
                  )}
                  {/* Verification badge */}
                  {message.role === 'assistant' && message.verification && (
                    <div className="mt-2 flex items-center gap-1.5">
                      {message.verification.label === 'Verified' ? (
                        <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
                      ) : message.verification.label === 'Re-verified' ? (
                        <ShieldAlert className="w-3.5 h-3.5 text-orange-500" />
                      ) : (
                        <Shield className="w-3.5 h-3.5 text-yellow-500" />
                      )}
                      <span className={cn(
                        'text-[11px] font-medium',
                        message.verification.label === 'Verified' ? 'text-green-500' :
                        message.verification.label === 'Re-verified' ? 'text-orange-500' : 'text-yellow-500'
                      )}>
                        {message.verification.label} {message.verification.label === 'Verified' ? '✓' : ''} ({message.verification.confidence}%)
                      </span>
                    </div>
                  )}

                  {/* Enhanced TTS controls for assistant messages */}
                  {message.role === 'assistant' && (
                    <div className="mt-3 pt-2 border-t border-border/30">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Language indicator */}
                        {speakingLanguage && isSpeaking && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary flex items-center gap-1">
                            🔊 {speakingLanguage === 'bn' ? 'বাংলা' : 'English'}
                          </span>
                        )}
                        
                        {/* Play/Pause/Stop controls */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => speakText(message.content)}
                            disabled={isTTSLoading}
                            className="px-2 py-1.5 rounded-lg hover:bg-muted-foreground/10 transition-colors disabled:opacity-50 flex items-center gap-1"
                            title={isTTSLoading ? 'Loading audio...' : isSpeaking ? 'Stop' : 'Play'}
                          >
                            {isTTSLoading ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                                <span className="text-[11px]">{primaryLanguage === 'bangla' ? 'লোডিং' : 'Loading'}</span>
                              </>
                            ) : isSpeaking ? (
                              <>
                                <Square className="w-3.5 h-3.5 text-destructive" />
                                <span className="text-[11px]">{primaryLanguage === 'bangla' ? 'স্টপ' : 'Stop'}</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3.5 h-3.5 text-primary" />
                                <span className="text-[11px]">{primaryLanguage === 'bangla' ? 'শুনুন' : 'Speak'}</span>
                              </>
                            )}
                          </button>
                          
                          {isSpeaking && (
                            <button
                              onClick={togglePause}
                              className="p-1.5 rounded-lg hover:bg-muted-foreground/10 transition-colors"
                              title={isPaused ? 'Resume' : 'Pause'}
                            >
                              {isPaused ? (
                                <Play className="w-3.5 h-3.5" />
                              ) : (
                                <Pause className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                        
                        {/* Speed control */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{playbackSpeed.toFixed(2)}x</span>
                          <Slider
                            value={[playbackSpeed]}
                            onValueChange={handleSpeedChange}
                            min={0.75}
                            max={1.25}
                            step={0.05}
                            className="w-16"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <div className="bg-muted rounded-2xl px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" />
                    <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce [animation-delay:0.1s]" />
                    <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce [animation-delay:0.2s]" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Image Preview */}
      {imageUrl && (
        <div className="px-4 py-2 border-t border-border bg-muted/30">
          <div className="relative inline-block">
            <img src={imageUrl} alt="Selected" className="h-16 rounded-lg object-cover" />
            <button
              onClick={removeImage}
              className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">📎 Image attached (Ctrl+V to paste more)</p>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-border bg-muted/30">
        <div className="flex gap-2">
          {/* Image upload button */}
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageSelect}
            className="hidden"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 h-11 w-11 rounded-xl"
            title="Attach image"
          >
            <ImagePlus className="w-5 h-5" />
          </Button>
          
          {/* Voice Recording Button */}
          <Button
            type="button"
            variant={isRecording ? 'destructive' : 'ghost'}
            size="icon"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isTranscribing}
            className="shrink-0 h-11 w-11 rounded-xl"
            title={isRecording ? 'Stop recording' : 'Voice input'}
          >
            {isTranscribing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isRecording ? (
              <MicOff className="w-5 h-5" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </Button>
          
          {/* Web Search Button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleWebSearch}
            disabled={isLoading || isWebSearching || !input.trim()}
            className="shrink-0 h-11 w-11 rounded-xl"
            title="Search web and answer"
          >
            {isWebSearching ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Search className="w-5 h-5" />
            )}
          </Button>
          {/* Text Input */}
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={primaryLanguage === 'bangla' ? 'তোমার প্রশ্ন লেখো... (Ctrl+V ছবি পেস্ট)' : 'Type your question... (Ctrl+V to paste image)'}
            className="flex-1 min-h-11 max-h-32 rounded-xl resize-none py-3"
            disabled={isLoading}
          />
          
          {/* Send Button */}
          <Button
            type="submit"
            size="icon"
            disabled={(!input.trim() && !imageUrl) || isLoading}
            className="shrink-0 h-11 w-11 rounded-xl btn-premium"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </div>
      </form>
    </div>
    </div>
    </div>
  );
}




