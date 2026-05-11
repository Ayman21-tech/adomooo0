import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface VerificationStatus {
  confidence: number;
  isAccurate: boolean;
  label: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
  generatedImageUrl?: string;
  verified?: boolean;
  verification?: VerificationStatus;
}

export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
}

interface UseAIChatOptions {
  subject: string;
  lessonContext?: string;
  bookContext?: string;
}

export function useAIChat({ subject, lessonContext, bookContext }: UseAIChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const subjectKeyForHistory = subject.toLowerCase().replace(/\s+/g, '-');
  const currentSessionIdRef = useRef<string | null>(null);
  currentSessionIdRef.current = currentSessionId;

  // Load chat sessions on mount / when subject changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data, error } = await supabase
          .from('chat_sessions')
          .select('id, title, created_at')
          .eq('user_id', session.user.id)
          .eq('subject_id', subjectKeyForHistory)
          .order('created_at', { ascending: false });
        
        if (!cancelled && data) {
          setChatSessions(data);
          if (data.length > 0 && !currentSessionIdRef.current) {
            setCurrentSessionId(data[0].id);
          }
        }
      } catch (e) {
        console.error('Failed to load chat sessions:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [subjectKeyForHistory]);

  // Load messages when currentSessionId changes
  useEffect(() => {
    let cancelled = false;
    if (!currentSessionId) {
      setMessages([]);
      return;
    }
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data } = await supabase
          .from('chat_messages')
          .select('role, content, created_at')
          .eq('session_id', currentSessionId)
          .order('created_at', { ascending: true })
          .limit(100);
        
        if (!cancelled && data) {
          setMessages(data.map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content })));
        }
      } catch (e) {
        console.error('Failed to load messages:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [currentSessionId]);

  const createNewSession = useCallback(() => {
    setCurrentSessionId(null);
    setMessages([]);
  }, []);

  const generateImage = useCallback(async (prompt: string): Promise<string | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) return null;
      const data = await response.json();
      return data.imageUrl || null;
    } catch (error) {
      console.error('Image generation error:', error);
      return null;
    }
  }, []);

  const persistMessage = async (role: 'user' | 'assistant', content: string, sessionId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !content.trim()) return;
      await supabase.from('chat_messages').insert({
        user_id: session.user.id,
        subject_id: subjectKeyForHistory,
        session_id: sessionId,
        role,
        content,
      });
    } catch (e) {
      console.error('Failed to persist chat message:', e);
    }
  };

  const sendMessage = useCallback(async (userMessage: string, imageUrl?: string) => {
    if ((!userMessage.trim() && !imageUrl) || isLoading) return;

    const userMsg: ChatMessage = { 
      role: 'user', 
      content: userMessage || 'Please analyze this image',
      imageUrl,
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    const requestStartedAt = Date.now();
    const subjectKey = subject.toLowerCase().replace(/\s+/g, '-');

    let sessionIdToUse = currentSessionIdRef.current;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!sessionIdToUse && session) {
        // Create new session
        const { data: newSession, error } = await supabase.from('chat_sessions').insert({
          user_id: session.user.id,
          subject_id: subjectKeyForHistory,
          title: 'New Chat'
        }).select().single();
        
        if (newSession) {
          sessionIdToUse = newSession.id;
          setCurrentSessionId(newSession.id);
          setChatSessions(prev => [newSession, ...prev]);

          // Generate title asynchronously
          fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/learning-engine`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
            },
            body: JSON.stringify({ action: 'generate-chat-title', user_message: userMessage || 'Hello' })
          }).then(res => res.json()).then(async data => {
            if (data.title) {
               await supabase.from('chat_sessions').update({ title: data.title }).eq('id', newSession.id);
               setChatSessions(prev => prev.map(s => s.id === newSession.id ? { ...s, title: data.title } : s));
            }
          }).catch(console.error);
        }
      }

      if (sessionIdToUse) {
        await persistMessage('user', userMsg.content, sessionIdToUse);
      }

      let assistantContent = '';
      let renderedAssistantContent = '';
      const typingQueue: string[] = [];
      let queueOffset = 0;
      let typingTimer: number | null = null;
      let resolveTypewriterDrain: (() => void) | null = null;

      const syncAssistantMessage = (content: string, generatedImageUrl?: string) => {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return prev.map((m, i) =>
              i === prev.length - 1
                ? {
                    ...m,
                    content,
                    generatedImageUrl: generatedImageUrl || m.generatedImageUrl,
                  }
                : m
            );
          }
          return [...prev, { role: 'assistant', content, generatedImageUrl }];
        });
      };

      const stopTypewriter = () => {
        if (typingTimer !== null) {
          window.clearInterval(typingTimer);
          typingTimer = null;
        }
      };

      const markTypewriterDrained = () => {
        if (resolveTypewriterDrain) {
          resolveTypewriterDrain();
          resolveTypewriterDrain = null;
        }
      };

      const waitForTypewriterDrain = () => {
        if (typingQueue.length === 0 && typingTimer === null) return Promise.resolve();
        return new Promise<void>((resolve) => { resolveTypewriterDrain = resolve; });
      };

      const startTypewriter = (generatedImageUrl?: string) => {
        if (typingTimer !== null) return;
        typingTimer = window.setInterval(() => {
          if (typingQueue.length === 0) {
            stopTypewriter();
            markTypewriterDrained();
            return;
          }
          const currentChunk = typingQueue[0];
          const remaining = currentChunk.slice(queueOffset);
          const step = Math.min(3, remaining.length);

          renderedAssistantContent += remaining.slice(0, step);
          queueOffset += step;
          syncAssistantMessage(renderedAssistantContent, generatedImageUrl);

          if (queueOffset >= currentChunk.length) {
            typingQueue.shift();
            queueOffset = 0;
          }
        }, 14);
      };

      const updateAssistantMessage = (chunk: string, generatedImageUrl?: string) => {
        assistantContent += chunk;
        typingQueue.push(chunk);
        startTypewriter(generatedImageUrl);
      };

      const apiMessages = messages.map(m => ({ role: m.role, content: m.content }));

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-tutor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          messages: [...apiMessages, { role: 'user', content: userMsg.content }],
          subject,
          lessonContext,
          imageUrl,
          bookContext,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 428 && errorData?.needs_upload) {
          const fallbackMessage = errorData.message || 'Please upload relevant book pages first.';
          setMessages(prev => [...prev, { role: 'assistant', content: fallbackMessage }]);
          if (sessionIdToUse) await persistMessage('assistant', fallbackMessage, sessionIdToUse);
          setIsLoading(false);
          return;
        }
        throw new Error(errorData.error || errorData.message || 'Failed to get AI response');
      }

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) updateAssistantMessage(content);
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) updateAssistantMessage(content);
          } catch { /* ignore */ }
        }
      }

      await waitForTypewriterDrain();

      // Check if AI wants to generate an image
      const imageMatch = assistantContent.match(/\[GENERATE_IMAGE:\s*(.+?)\]/i);
      let finalContent = assistantContent;
      if (imageMatch) {
        const imagePrompt = imageMatch[1].trim();
        toast({ title: 'Creating image...', description: 'Generating educational illustration for you!' });
        
        const generatedUrl = await generateImage(imagePrompt);
        if (generatedUrl) {
          finalContent = assistantContent.replace(/\[GENERATE_IMAGE:\s*.+?\]/gi, '').trim();
          syncAssistantMessage(finalContent, generatedUrl);
        }
      }

      // Persist the final completed message
      if (sessionIdToUse) {
        await persistMessage('assistant', finalContent, sessionIdToUse);
      }

      // Run intelligence cycle
      const responseTimeSeconds = Math.max(1, Math.round((Date.now() - requestStartedAt) / 1000));
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/learning-engine`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          action: 'run-intelligence-cycle',
          subject_id: subjectKey,
          user_message: userMsg.content,
          assistant_answer: finalContent,
          response_time_seconds: responseTimeSeconds,
          book_context: bookContext,
        }),
      })
      .then(res => res.ok ? res.json() : null)
      .then((cycle) => {
        if (!cycle) return;
        const corrected = cycle?.corrected_answer;
        const confidence = Number(cycle?.verification?.confidence ?? 100);
        const isAccurate = Boolean(cycle?.verification?.is_accurate);
        const label = !isAccurate ? 'Re-verified' : confidence >= 80 ? 'Verified' : 'Mostly accurate';
        
        setMessages(prev => prev.map((m, i) =>
          i === prev.length - 1 && m.role === 'assistant'
            ? { ...m, verification: { confidence, isAccurate, label } }
            : m
        ));

        if (!isAccurate && corrected && confidence >= 70) {
          const correctedContent = `${corrected}\n\n(Updated after self-verification)`;
          syncAssistantMessage(correctedContent);
          if (sessionIdToUse) {
             // Overwrite message or just let it be, skipping for simplicity
          }
        }
      }).catch(() => {});

    } catch (error) {
      console.error('AI chat error:', error);
      toast({
        title: 'Chat Error',
        description: error instanceof Error ? error.message : 'Failed to send message',
        variant: 'destructive',
      });
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, subject, lessonContext, bookContext, generateImage]);

  const clearMessages = useCallback(() => {
    // We clear messages in view without deleting session
    setMessages([]);
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    clearMessages,
    chatSessions,
    currentSessionId,
    setCurrentSessionId,
    createNewSession,
  };
}
