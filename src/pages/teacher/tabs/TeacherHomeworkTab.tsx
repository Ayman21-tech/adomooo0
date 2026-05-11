import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { categories, getSubjectById } from '@/data/subjects';
import { Plus, X, ImagePlus, BookOpen, Megaphone, ClipboardList, ArrowLeft, Trash2, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TeacherClass {
  id: string;
  class_name: string;
  section_name: string;
}

interface HomeworkItem {
  id: string;
  title: string;
  content: string | null;
  type: string;
  class_name: string | null;
  subject_id: string | null;
  image_urls: any;
  created_at: string;
}

export function TeacherHomeworkTab() {
  const [view, setView] = useState<'list' | 'create'>('list');
  const [loading, setLoading] = useState(true);
  const [homework, setHomework] = useState<HomeworkItem[]>([]);
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [teacherProfileId, setTeacherProfileId] = useState('');
  const [subjectsTaught, setSubjectsTaught] = useState<string[]>([]);

  // Create form state
  const [postType, setPostType] = useState<'homework' | 'announcement'>('homework');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('teacher_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
      if (!profile) return;

      setTeacherProfileId(profile.id);

      // Get subjects from teacher_subjects table
      const { data: subjectsData } = await supabase
        .from('teacher_subjects')
        .select('subject_id')
        .eq('teacher_id', profile.id);
      setSubjectsTaught((subjectsData || []).map(s => s.subject_id));

      const { data: cls } = await supabase
        .from('teacher_classes')
        .select('*')
        .eq('teacher_id', profile.id);
      setClasses((cls || []).map((c: any) => ({ id: c.id, class_name: c.class_level, section_name: c.section_name || '' })));

      const { data: hw } = await supabase
        .from('homework_assignments')
        .select('*')
        .eq('teacher_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(50);
      setHomework((hw || []).map((h: any) => ({ ...h, class_name: h.class_name || h.class_id || null })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + images.length > 5) {
      toast({ title: 'Limit exceeded', description: 'Maximum 5 images allowed.', variant: 'destructive' });
      return;
    }
    setImages(prev => [...prev, ...files]);
    const previews = files.map(f => URL.createObjectURL(f));
    setImagePreviews(prev => [...prev, ...previews]);
  };

  const removeImage = (idx: number) => {
    URL.revokeObjectURL(imagePreviews[idx]);
    setImages(prev => prev.filter((_, i) => i !== idx));
    setImagePreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({ title: 'Title required', variant: 'destructive' });
      return;
    }
    setSubmitting(true);

    try {
      // Upload images first
      const imageUrls: string[] = [];
      for (const file of images) {
        const path = `homework/${teacherProfileId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${file.name.split('.').pop()}`;
        const { error } = await supabase.storage.from('chat-media').upload(path, file);
        if (error) { console.error('Upload error:', error); continue; }
        const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(path);
        imageUrls.push(urlData.publicUrl);
      }

      const { error } = await supabase.from('homework_assignments').insert({
        teacher_id: teacherProfileId,
        title: title.trim(),
        content: content.trim() || null,
        type: postType,
        class_name: selectedClass === 'all' ? null : selectedClass,
        subject_id: selectedSubject || null,
        image_urls: imageUrls,
      });

      if (error) throw error;

      toast({ title: postType === 'homework' ? 'Homework posted!' : 'Announcement posted!' });
      setTitle('');
      setContent('');
      setSelectedClass('all');
      setSelectedSubject('');
      setImages([]);
      setImagePreviews([]);
      setView('list');
      loadData();
    } catch (err: any) {
      toast({ title: 'Failed to post', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const deleteHomework = async (id: string) => {
    const { error } = await supabase.from('homework_assignments').delete().eq('id', id);
    if (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
      return;
    }
    setHomework(prev => prev.filter(h => h.id !== id));
    toast({ title: 'Deleted' });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)}
      </div>
    );
  }

  // Create form view
  if (view === 'create') {
    return (
      <div className="space-y-5">
        <Button variant="ghost" className="gap-2 rounded-xl" onClick={() => setView('list')}>
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>

        <h2 className="text-lg font-bold">Create {postType === 'homework' ? 'Homework' : 'Announcement'}</h2>

        {/* Type toggle */}
        <div className="flex bg-muted/50 p-1 rounded-2xl w-full max-w-[280px]">
          <button
            type="button"
            onClick={() => setPostType('homework')}
            className={cn('flex-1 py-2 text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-1.5',
              postType === 'homework' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'
            )}
          >
            <BookOpen className="w-3.5 h-3.5" /> Homework
          </button>
          <button
            type="button"
            onClick={() => setPostType('announcement')}
            className={cn('flex-1 py-2 text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-1.5',
              postType === 'announcement' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'
            )}
          >
            <Megaphone className="w-3.5 h-3.5" /> Announcement
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Chapter 5 exercises" className="rounded-xl h-12 input-premium" />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Write details here..." className="rounded-xl input-premium min-h-[120px]" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Class</Label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="All classes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {classes.map(c => (
                    <SelectItem key={c.id} value={`${c.class_name} (${c.section_name})`}>
                      {c.class_name} — {c.section_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {subjectsTaught.map(sid => {
                    const sub = getSubjectById(sid);
                    return <SelectItem key={sid} value={sid}>{sub?.name || sid}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Image upload */}
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} />
          <div className="space-y-2">
            <Label>Images (optional, max 5)</Label>
            <div className="flex gap-2 flex-wrap">
              {imagePreviews.map((src, i) => (
                <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-border group">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => removeImage(i)} className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              ))}
              {images.length < 5 && (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-16 h-16 rounded-xl border-2 border-dashed border-border flex items-center justify-center hover:border-primary/50 transition-colors"
                >
                  <ImagePlus className="w-5 h-5 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!title.trim() || submitting}
            className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold text-base"
          >
            {submitting ? 'Posting...' : `Post ${postType === 'homework' ? 'Homework' : 'Announcement'}`}
          </Button>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Homework & Announcements</h2>
        <Button size="sm" onClick={() => setView('create')} className="gap-1.5 rounded-xl gradient-primary text-primary-foreground">
          <Plus className="w-4 h-4" /> New Post
        </Button>
      </div>

      {homework.length === 0 ? (
        <Card className="border-dashed rounded-2xl">
          <CardContent className="p-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <ClipboardList className="w-7 h-7 text-primary" />
            </div>
            <p className="text-sm font-medium">No posts yet</p>
            <p className="text-xs text-muted-foreground">Create homework or announcements for your students.</p>
          </CardContent>
        </Card>
      ) : (
        homework.map(h => {
          const subjectName = h.subject_id ? getSubjectById(h.subject_id)?.name : null;
          return (
            <Card key={h.id} className="rounded-2xl">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', h.type === 'homework' ? 'bg-primary/10' : 'bg-orange-500/10')}>
                      {h.type === 'homework' ? <BookOpen className="w-4 h-4 text-primary" /> : <Megaphone className="w-4 h-4 text-orange-500" />}
                    </div>
                    <span className={cn('text-[10px] font-bold uppercase px-2 py-0.5 rounded-full', h.type === 'homework' ? 'bg-primary/10 text-primary' : 'bg-orange-500/10 text-orange-500')}>
                      {h.type}
                    </span>
                  </div>
                  <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive/60 hover:text-destructive" onClick={() => deleteHomework(h.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <h3 className="font-semibold text-sm mb-1">{h.title}</h3>
                {h.content && <p className="text-xs text-muted-foreground mb-2">{h.content}</p>}
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  {h.class_name && <span className="bg-muted px-2 py-0.5 rounded-full">{h.class_name}</span>}
                  {subjectName && <span className="bg-muted px-2 py-0.5 rounded-full">{subjectName}</span>}
                  <span className="flex items-center gap-1 ml-auto"><Calendar className="w-3 h-3" />{new Date(h.created_at).toLocaleDateString()}</span>
                </div>
                {h.image_urls && Array.isArray(h.image_urls) && h.image_urls.length > 0 && (
                  <div className="flex gap-2 mt-3 overflow-x-auto">
                    {(h.image_urls as string[]).map((url, i) => (
                      <img key={i} src={url} alt="" className="w-16 h-16 rounded-lg object-cover border border-border shrink-0" />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
