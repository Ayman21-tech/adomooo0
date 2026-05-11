import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { MessageCircle, ArrowLeft, Send, ImagePlus, Mic, MicOff, Play, Pause, ChevronRight, School } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StudentContact {
  user_id: string;
  name: string;
  class_level: string;
  school_name: string;
}

interface Message {
  id: string;
  sender_user_id: string;
  receiver_user_id: string;
  content: string | null;
  message_type: string;
  media_url: string | null;
  created_at: string;
}

export function TeacherChatTab() {
  const [view, setView] = useState<'contacts' | 'chat'>('contacts');
  const [students, setStudents] = useState<StudentContact[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedStudent, setSelectedStudent] = useState<StudentContact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadContacts();
  }, []);

  // Realtime subscription for chat
  useEffect(() => {
    if (!selectedStudent || !currentUserId) return;
    const studentId = selectedStudent.user_id;

    const channel = supabase
      .channel(`teacher-chat-${studentId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'teacher_student_messages' }, (payload) => {
        const msg = payload.new as Message;
        if (
          (msg.sender_user_id === currentUserId && msg.receiver_user_id === studentId) ||
          (msg.sender_user_id === studentId && msg.receiver_user_id === currentUserId)
        ) {
          setMessages(prev => {
            if (prev.find(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        }
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedStudent, currentUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadContacts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      const { data: profile } = await supabase.from('teacher_profiles').select('id').eq('user_id', user.id).single();
      if (!profile) return;

      const { data: links } = await supabase.from('student_teacher_links').select('student_user_id').eq('teacher_id', profile.id);
      if (!links || links.length === 0) {
        setStudents([]);
        return;
      }

      const studentIds = links.map(l => l.student_user_id);
      const { data: profiles } = await supabase.from('profiles').select('user_id, name, class_level, school_name').in('user_id', studentIds);
      setStudents((profiles || []).map(p => ({
        user_id: p.user_id,
        name: p.name || 'Student',
        class_level: p.class_level || '',
        school_name: p.school_name || '',
      })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openChat = async (student: StudentContact) => {
    setSelectedStudent(student);
    setView('chat');

    const { data } = await supabase
      .from('teacher_student_messages')
      .select('*')
      .or(`and(sender_user_id.eq.${currentUserId},receiver_user_id.eq.${student.user_id}),and(sender_user_id.eq.${student.user_id},receiver_user_id.eq.${currentUserId})`)
      .order('created_at', { ascending: true })
      .limit(200);
    setMessages(data || []);
  };

  const sendMsg = async () => {
    if (!newMessage.trim() || !selectedStudent) return;
    const { error } = await supabase.from('teacher_student_messages').insert({
      sender_user_id: currentUserId,
      receiver_user_id: selectedStudent.user_id,
      content: newMessage.trim(),
      message_type: 'text',
    });
    if (error) {
      toast({ title: 'Failed to send', description: error.message, variant: 'destructive' });
      return;
    }
    setNewMessage('');
  };

  const sendImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedStudent) return;
    const path = `${currentUserId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('chat-media').upload(path, file);
    if (error) { toast({ title: 'Upload failed', variant: 'destructive' }); return; }
    const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(path);
    await supabase.from('teacher_student_messages').insert({
      sender_user_id: currentUserId,
      receiver_user_id: selectedStudent.user_id,
      message_type: 'image',
      media_url: urlData.publicUrl,
    });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks, { type: 'audio/webm' });
        if (!selectedStudent) return;
        const path = `${currentUserId}/${Date.now()}.webm`;
        const { error } = await supabase.storage.from('chat-media').upload(path, blob);
        if (error) { toast({ title: 'Upload failed', variant: 'destructive' }); return; }
        const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(path);
        await supabase.from('teacher_student_messages').insert({
          sender_user_id: currentUserId,
          receiver_user_id: selectedStudent.user_id,
          message_type: 'voice',
          media_url: urlData.publicUrl,
        });
      };
      recorder.start();
      setMediaRecorder(recorder);
      setRecording(true);
    } catch {
      toast({ title: 'Microphone access denied', variant: 'destructive' });
    }
  };

  const stopRecording = () => {
    mediaRecorder?.stop();
    setRecording(false);
    setMediaRecorder(null);
  };

  const playAudio = (url: string) => {
    if (playingAudio === url) {
      audioRef.current?.pause();
      setPlayingAudio(null);
    } else {
      if (audioRef.current) { audioRef.current.src = url; audioRef.current.play(); }
      setPlayingAudio(url);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse" />)}
      </div>
    );
  }

  // Chat view
  if (view === 'chat' && selectedStudent) {
    return (
      <div className="flex flex-col h-[calc(100vh-220px)]">
        <audio ref={audioRef} onEnded={() => setPlayingAudio(null)} className="hidden" />
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={sendImage} />

        <div className="flex items-center gap-3 pb-3 border-b border-border/40 mb-3">
          <Button variant="ghost" size="sm" onClick={() => { setView('contacts'); setSelectedStudent(null); setMessages([]); }} className="rounded-xl">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
            {selectedStudent.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-sm">{selectedStudent.name}</p>
            <p className="text-[11px] text-muted-foreground">{selectedStudent.class_level} • {selectedStudent.school_name}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pb-2">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <MessageCircle className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No messages yet. Start the conversation!</p>
            </div>
          )}
          {messages.map((msg) => {
            const isMine = msg.sender_user_id === currentUserId;
            if (msg.message_type === 'image' && msg.media_url) {
              return (
                <div key={msg.id} className={cn('max-w-[75%]', isMine ? 'ml-auto' : '')}>
                  <img src={msg.media_url} alt="" className="rounded-2xl max-h-48 object-cover border border-border" />
                  <p className={cn('text-[10px] mt-1', isMine ? 'text-right text-muted-foreground' : 'text-muted-foreground')}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              );
            }
            if (msg.message_type === 'voice' && msg.media_url) {
              return (
                <div key={msg.id} className={cn('max-w-[75%]', isMine ? 'ml-auto' : '')}>
                  <button onClick={() => playAudio(msg.media_url!)}
                    className={cn('flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm', isMine ? 'gradient-primary text-primary-foreground' : 'bg-muted')}>
                    {playingAudio === msg.media_url ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    <span>Voice message</span>
                  </button>
                  <p className={cn('text-[10px] mt-1', isMine ? 'text-right text-muted-foreground' : 'text-muted-foreground')}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              );
            }
            return (
              <div key={msg.id} className={cn('max-w-[75%] p-3 rounded-2xl text-sm', isMine ? 'ml-auto gradient-primary text-primary-foreground' : 'bg-muted')}>
                {msg.content}
                <p className={cn('text-[10px] mt-1', isMine ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <div className="flex gap-2 pt-3 border-t border-border/40">
          <Button variant="ghost" size="icon" onClick={() => fileRef.current?.click()} className="shrink-0 rounded-xl w-10 h-10">
            <ImagePlus className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={recording ? stopRecording : startRecording}
            className={cn('shrink-0 rounded-xl w-10 h-10', recording && 'text-destructive')}>
            {recording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </Button>
          <Input placeholder="Type a message..." value={newMessage} onChange={e => setNewMessage(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMsg()} className="rounded-xl h-10 input-premium" />
          <Button onClick={sendMsg} disabled={!newMessage.trim()} size="icon" className="rounded-xl shrink-0 w-10 h-10 gradient-primary text-primary-foreground">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Contacts list
  return (
    <div className="space-y-5">
      <div className="text-center space-y-1 mb-4">
        <h2 className="text-2xl font-bold tracking-tight">Messages</h2>
        <p className="text-muted-foreground text-sm">Chat with your students</p>
      </div>

      {students.length === 0 ? (
        <Card className="border-dashed rounded-2xl">
          <CardContent className="p-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <MessageCircle className="w-7 h-7 text-primary" />
            </div>
            <p className="text-sm font-medium">No students linked yet</p>
            <p className="text-xs text-muted-foreground">Share your Teacher ID with students to start messaging.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {students.map(s => (
            <Card key={s.user_id} className="rounded-2xl cursor-pointer hover:border-primary/30 transition-all press" onClick={() => openChat(s)}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-11 h-11 rounded-full gradient-primary flex items-center justify-center text-sm font-bold text-primary-foreground">
                  {s.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{s.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <School className="w-3 h-3" /> {s.class_level} • {s.school_name}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
