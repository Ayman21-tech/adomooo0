import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { GraduationCap, Plus, Search, UserPlus, BookOpen, MessageCircle, ClipboardList, ChevronRight, ArrowLeft, Send, ImagePlus, Mic, MicOff, Play, Pause, School, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type SubView = 'main' | 'add-teacher' | 'homework' | 'messages' | 'chat';

interface LinkedTeacher {
  teacher_id: string;
  name: string;
  school: string;
  teacher_display_id: string;
  user_id?: string;
}

interface HomeworkItem {
  id: string;
  title: string;
  content: string | null;
  type: string;
  subject_id: string | null;
  image_urls: any;
  created_at: string;
  teacher_name?: string;
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

export function TeacherTab() {
  const [view, setView] = useState<SubView>('main');
  const [teachers, setTeachers] = useState<LinkedTeacher[]>([]);
  const [homework, setHomework] = useState<HomeworkItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Add teacher state
  const [teacherIdInput, setTeacherIdInput] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);

  // Chat state
  const [chatTeacher, setChatTeacher] = useState<LinkedTeacher | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadData(); }, []);

  // Realtime subscription for chat
  useEffect(() => {
    if (!chatTeacher?.user_id || !currentUserId) return;
    const teacherUserId = chatTeacher.user_id;
    const channel = supabase
      .channel(`student-chat-${teacherUserId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'teacher_student_messages' }, (payload) => {
        const msg = payload.new as Message;
        if (
          (msg.sender_user_id === currentUserId && msg.receiver_user_id === teacherUserId) ||
          (msg.sender_user_id === teacherUserId && msg.receiver_user_id === currentUserId)
        ) {
          setMessages(prev => {
            if (prev.find(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [chatTeacher, currentUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      // Load linked teachers
      const { data: links } = await supabase.from('student_teacher_links').select('teacher_id').eq('student_user_id', user.id);
      if (links && links.length > 0) {
        const teacherIds = links.map(l => l.teacher_id);
        const { data: tProfiles } = await supabase.from('teacher_profiles').select('id, name, school_name, teacher_id_display, user_id').in('id', teacherIds);
        setTeachers((tProfiles || []).map(t => ({
          teacher_id: t.id, name: t.name, school: t.school_name, teacher_display_id: t.teacher_id_display, user_id: t.user_id,
        })));

        // Load homework
        const { data: hw } = await supabase.from('homework_assignments').select('*').in('teacher_id', teacherIds).order('created_at', { ascending: false }).limit(20);
        const hwWithNames = (hw || []).map(h => ({
          ...h,
          teacher_name: (tProfiles || []).find(t => t.id === h.teacher_id)?.name || 'Teacher',
        }));
        setHomework(hwWithNames);
      }
    } finally {
      setLoading(false);
    }
  };

  const linkTeacher = async () => {
    if (!teacherIdInput.trim()) return;
    setSearchLoading(true);
    try {
      const { data: tp } = await supabase.from('teacher_profiles').select('id, name, school_name, teacher_id_display')
        .eq('teacher_id_display', teacherIdInput.trim().toUpperCase()).maybeSingle();
      if (!tp) {
        toast({ title: 'Teacher not found', description: 'Check the Teacher ID and try again.', variant: 'destructive' });
        return;
      }

      // Check if already linked
      const { data: existing } = await supabase.from('student_teacher_links')
        .select('id').eq('student_user_id', currentUserId).eq('teacher_id', tp.id).maybeSingle();
      if (existing) {
        toast({ title: 'Already linked', description: 'You are already linked to this teacher.' });
        return;
      }

      const { error } = await supabase.from('student_teacher_links').insert({
        student_user_id: currentUserId, teacher_id: tp.id,
      });
      if (error) throw error;

      toast({ title: 'Linked!', description: `You are now linked to ${tp.name}.` });
      setTeacherIdInput('');
      setView('main');
      loadData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSearchLoading(false);
    }
  };

  const openChat = async (teacher: LinkedTeacher) => {
    setChatTeacher(teacher);
    setView('chat');
    
    const teacherUserId = teacher.user_id;
    if (!teacherUserId) {
      // Fetch teacher user_id if not cached
      const { data: tpData } = await supabase.from('teacher_profiles').select('user_id').eq('id', teacher.teacher_id).maybeSingle();
      if (tpData) {
        teacher.user_id = tpData.user_id;
        setChatTeacher({ ...teacher, user_id: tpData.user_id });
      }
    }

    const tuid = teacher.user_id;
    if (!tuid) return;

    const { data } = await supabase.from('teacher_student_messages').select('*')
      .or(`and(sender_user_id.eq.${currentUserId},receiver_user_id.eq.${tuid}),and(sender_user_id.eq.${tuid},receiver_user_id.eq.${currentUserId})`)
      .order('created_at', { ascending: true }).limit(200);
    setMessages(data || []);
  };

  const sendMsg = async () => {
    if (!newMessage.trim() || !chatTeacher?.user_id) return;
    const { error } = await supabase.from('teacher_student_messages').insert({
      sender_user_id: currentUserId, receiver_user_id: chatTeacher.user_id,
      content: newMessage.trim(), message_type: 'text',
    });
    if (error) {
      toast({ title: 'Failed to send', description: error.message, variant: 'destructive' });
      return;
    }
    setNewMessage('');
  };

  const sendImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !chatTeacher?.user_id) return;
    const path = `${currentUserId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('chat-media').upload(path, file);
    if (error) { toast({ title: 'Upload failed', variant: 'destructive' }); return; }
    const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(path);
    await supabase.from('teacher_student_messages').insert({
      sender_user_id: currentUserId, receiver_user_id: chatTeacher.user_id,
      message_type: 'image', media_url: urlData.publicUrl,
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
        if (!chatTeacher?.user_id) return;
        const path = `${currentUserId}/${Date.now()}.webm`;
        const { error } = await supabase.storage.from('chat-media').upload(path, blob);
        if (error) { toast({ title: 'Upload failed', variant: 'destructive' }); return; }
        const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(path);
        await supabase.from('teacher_student_messages').insert({
          sender_user_id: currentUserId, receiver_user_id: chatTeacher.user_id,
          message_type: 'voice', media_url: urlData.publicUrl,
        });
      };
      recorder.start();
      setMediaRecorder(recorder);
      setRecording(true);
    } catch { toast({ title: 'Microphone access denied', variant: 'destructive' }); }
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
      <div className="space-y-4 pb-24">
        <div className="h-6 w-32 bg-muted rounded-lg animate-pulse" />
        {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)}
      </div>
    );
  }

  // Chat view
  if (view === 'chat' && chatTeacher) {
    return (
      <div className="flex flex-col h-[calc(100vh-220px)]">
        <audio ref={audioRef} onEnded={() => setPlayingAudio(null)} className="hidden" />
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={sendImage} />
        <div className="flex items-center gap-3 pb-3 border-b border-border/40 mb-3">
          <Button variant="ghost" size="sm" onClick={() => { setView('messages'); setChatTeacher(null); }} className="rounded-xl">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
            {chatTeacher.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-sm">{chatTeacher.name}</p>
            <p className="text-[11px] text-muted-foreground">{chatTeacher.school}</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2 pb-2">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <MessageCircle className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No messages yet. Say hello to your teacher!</p>
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
          <Button variant="ghost" size="icon" onClick={recording ? stopRecording : startRecording} className={cn('shrink-0 rounded-xl w-10 h-10', recording && 'text-destructive')}>
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

  // Add teacher view
  if (view === 'add-teacher') {
    return (
      <div className="space-y-4 pb-24">
        <Button variant="ghost" className="gap-2 rounded-xl" onClick={() => setView('main')}>
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <h2 className="text-lg font-bold">Add Teacher</h2>
        <p className="text-sm text-muted-foreground">Enter your teacher's unique ID to link with them.</p>
        <Card className="rounded-2xl border-primary/20">
          <CardContent className="p-4 space-y-3">
            <Input
              placeholder="Enter Teacher ID (e.g. TCH-48291)"
              value={teacherIdInput}
              onChange={e => setTeacherIdInput(e.target.value)}
              className="rounded-xl h-12 input-premium text-center text-lg font-mono tracking-wider"
            />
            <Button onClick={linkTeacher} disabled={!teacherIdInput.trim() || searchLoading}
              className="w-full h-12 rounded-xl gradient-primary text-primary-foreground gap-2 font-semibold">
              <UserPlus className="w-4 h-4" /> {searchLoading ? 'Searching...' : 'Link Teacher'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Homework view
  if (view === 'homework') {
    return (
      <div className="space-y-4 pb-24">
        <Button variant="ghost" className="gap-2 rounded-xl" onClick={() => setView('main')}>
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <h2 className="text-lg font-bold">Homework & Announcements</h2>
        {homework.length === 0 ? (
          <Card className="border-dashed rounded-2xl">
            <CardContent className="p-8 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <ClipboardList className="w-7 h-7 text-primary" />
              </div>
              <p className="text-sm font-medium">No homework yet</p>
              <p className="text-xs text-muted-foreground">Homework from your linked teachers will appear here.</p>
            </CardContent>
          </Card>
        ) : (
          homework.map(h => (
            <Card key={h.id} className="rounded-2xl">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${h.type === 'homework' ? 'bg-primary/10' : 'bg-orange-500/10'}`}>
                    {h.type === 'homework' ? <BookOpen className="w-3.5 h-3.5 text-primary" /> : <ClipboardList className="w-3.5 h-3.5 text-orange-500" />}
                  </div>
                  <span className="text-[11px] font-semibold text-muted-foreground">{h.teacher_name}</span>
                  <span className="text-[11px] text-muted-foreground ml-auto">{new Date(h.created_at).toLocaleDateString()}</span>
                </div>
                <h3 className="font-semibold text-sm">{h.title}</h3>
                {h.content && <p className="text-xs text-muted-foreground mt-1">{h.content}</p>}
                {h.image_urls && Array.isArray(h.image_urls) && h.image_urls.length > 0 && (
                  <div className="flex gap-2 mt-2 overflow-x-auto">
                    {(h.image_urls as string[]).map((url, i) => (
                      <img key={i} src={url} alt="" className="w-16 h-16 rounded-lg object-cover border border-border shrink-0" />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    );
  }

  // Messages view
  if (view === 'messages') {
    return (
      <div className="space-y-4 pb-24">
        <Button variant="ghost" className="gap-2 rounded-xl" onClick={() => setView('main')}>
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <h2 className="text-lg font-bold">Messages</h2>
        {teachers.length === 0 ? (
          <Card className="border-dashed rounded-2xl">
            <CardContent className="p-8 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <MessageCircle className="w-7 h-7 text-primary" />
              </div>
              <p className="text-sm font-medium">No teachers linked</p>
              <p className="text-xs text-muted-foreground">Link with a teacher first to start messaging.</p>
            </CardContent>
          </Card>
        ) : (
          teachers.map(t => (
            <Card key={t.teacher_id} className="rounded-2xl cursor-pointer hover:border-primary/30 transition-all" onClick={() => openChat(t)}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-11 h-11 rounded-full gradient-primary flex items-center justify-center text-sm font-bold text-primary-foreground">
                  {t.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.school}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </CardContent>
            </Card>
          ))
        )}
      </div>
    );
  }

  // Main teacher tab view
  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Teacher Hub</h2>
        <Button size="sm" onClick={() => setView('add-teacher')} className="gap-1.5 rounded-xl gradient-primary text-primary-foreground">
          <Plus className="w-4 h-4" /> Add Teacher
        </Button>
      </div>

      {/* Linked teachers */}
      {teachers.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Linked Teachers</p>
          {teachers.map(t => (
            <Card key={t.teacher_id} className="rounded-2xl">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-sm font-bold text-primary-foreground">
                  {t.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{t.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><School className="w-3 h-3" /> {t.school}</p>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground">{t.teacher_display_id}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Homework', icon: ClipboardList, view: 'homework' as SubView, count: homework.length },
          { label: 'Messages', icon: MessageCircle, view: 'messages' as SubView, count: teachers.length },
          { label: 'Add Teacher', icon: UserPlus, view: 'add-teacher' as SubView },
        ].map(item => {
          const Icon = item.icon;
          return (
            <Card key={item.label} className="rounded-2xl cursor-pointer hover:border-primary/30 transition-all" onClick={() => setView(item.view)}>
              <CardContent className="p-4 text-center space-y-2">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <p className="text-xs font-semibold">{item.label}</p>
                {item.count !== undefined && <p className="text-[10px] text-muted-foreground">{item.count}</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {teachers.length === 0 && (
        <Card className="border-dashed rounded-2xl">
          <CardContent className="p-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <GraduationCap className="w-7 h-7 text-primary" />
            </div>
            <p className="text-sm font-medium">No teachers linked yet</p>
            <p className="text-xs text-muted-foreground">Ask your teacher for their Teacher ID and add them here.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
