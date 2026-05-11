import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';

export interface SyllabusChapter {
  id: string;
  user_id: string;
  class_level: string;
  subject_id: string;
  chapter_order: number;
  chapter_name: string;
  topics: string[];
  is_archived: boolean;
  upload_type: string;
  created_at: string;
  updated_at: string;
}

export interface BookPage {
  id: string;
  user_id: string;
  class_level: string;
  subject_id: string;
  chapter_id: string | null;
  chapter_name: string | null;
  page_number: number | null;
  image_url: string;
  notes: string | null;
  tags: string[];
  extracted_text?: string | null;
  structured_content?: any;
  ocr_status?: string | null;
  is_archived: boolean;
  created_at: string;
}

export function useSyllabus() {
  const { user } = useUser();
  const [chapters, setChapters] = useState<SyllabusChapter[]>([]);
  const [bookPages, setBookPages] = useState<BookPage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSyllabus = useCallback(async () => {
    if (!user.class_level) return;
    
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) return;

      const { data: syllabusData, error: syllabusError } = await supabase
        .from('syllabus_library')
        .select('*')
        .eq('class_level', user.class_level)
        .eq('is_archived', false)
        .order('subject_id')
        .order('chapter_order');

      if (syllabusError) throw syllabusError;
      setChapters(syllabusData || []);

      const { data: pagesData, error: pagesError } = await supabase
        .from('book_pages')
        .select('*')
        .eq('class_level', user.class_level)
        .eq('is_archived', false)
        .order('subject_id')
        .order('created_at');

      if (pagesError) throw pagesError;
      setBookPages(pagesData || []);
    } catch (error) {
      console.error('Error fetching syllabus:', error);
    } finally {
      setLoading(false);
    }
  }, [user.class_level]);

  useEffect(() => {
    fetchSyllabus();
  }, [fetchSyllabus]);

  const addChapter = async (subjectId: string, chapterName: string, topics: string[] = [], uploadType = 'manual') => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) return null;

      const maxOrder = chapters
        .filter(c => c.subject_id === subjectId)
        .reduce((max, c) => Math.max(max, c.chapter_order), -1);

      const { data, error } = await supabase
        .from('syllabus_library')
        .insert({
          user_id: session.session.user.id,
          class_level: user.class_level,
          subject_id: subjectId,
          chapter_name: chapterName,
          chapter_order: maxOrder + 1,
          topics,
          upload_type: uploadType,
        })
        .select()
        .single();

      if (error) throw error;
      setChapters(prev => [...prev, data]);
      return data;
    } catch (error) {
      console.error('Error adding chapter:', error);
      return null;
    }
  };

  const updateChapter = async (chapterId: string, updates: Partial<SyllabusChapter>) => {
    try {
      const { error } = await supabase
        .from('syllabus_library')
        .update(updates)
        .eq('id', chapterId);

      if (error) throw error;
      setChapters(prev => prev.map(c => c.id === chapterId ? { ...c, ...updates } : c));
      return true;
    } catch (error) {
      console.error('Error updating chapter:', error);
      return false;
    }
  };

  const deleteChapter = async (chapterId: string) => {
    try {
      const { error } = await supabase
        .from('syllabus_library')
        .delete()
        .eq('id', chapterId);

      if (error) throw error;
      setChapters(prev => prev.filter(c => c.id !== chapterId));
      return true;
    } catch (error) {
      console.error('Error deleting chapter:', error);
      return false;
    }
  };

  const uploadBookPage = async (
    subjectId: string,
    imageFile: File,
    chapterId?: string,
    chapterName?: string,
    pageNumber?: number,
    notes?: string
  ) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) return null;

      const userId = session.session.user.id;
      const fileName = `${userId}/${subjectId}/${Date.now()}_${imageFile.name}`;

      const { error: uploadError } = await supabase.storage
        .from('book-pages')
        .upload(fileName, imageFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('book-pages')
        .getPublicUrl(fileName);

      const { data, error } = await supabase
        .from('book_pages')
        .insert({
          user_id: userId,
          class_level: user.class_level,
          subject_id: subjectId,
          chapter_id: chapterId || null,
          chapter_name: chapterName || null,
          page_number: pageNumber || null,
          image_url: urlData.publicUrl,
          notes: notes || null,
        })
        .select()
        .single();

      if (error) throw error;
      setBookPages(prev => [...prev, data]);
      return data;
    } catch (error) {
      console.error('Error uploading book page:', error);
      return null;
    }
  };

  const deleteBookPage = async (pageId: string) => {
    try {
      const { error } = await supabase
        .from('book_pages')
        .delete()
        .eq('id', pageId);

      if (error) throw error;
      setBookPages(prev => prev.filter(p => p.id !== pageId));
      return true;
    } catch (error) {
      console.error('Error deleting book page:', error);
      return false;
    }
  };

  const archiveForPromotion = async (newClassLevel: string) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) return false;

      // Archive current syllabus and book pages
      await supabase
        .from('syllabus_library')
        .update({ is_archived: true })
        .eq('class_level', user.class_level);

      await supabase
        .from('book_pages')
        .update({ is_archived: true })
        .eq('class_level', user.class_level);

      // Clear local state
      setChapters([]);
      setBookPages([]);
      return true;
    } catch (error) {
      console.error('Error archiving for promotion:', error);
      return false;
    }
  };

  const getChaptersBySubject = (subjectId: string) => {
    return chapters.filter(c => c.subject_id === subjectId).sort((a, b) => a.chapter_order - b.chapter_order);
  };

  const getBookPagesBySubject = (subjectId: string) => {
    return bookPages.filter(p => p.subject_id === subjectId);
  };

  const getBookPagesByChapter = (chapterId: string) => {
    return bookPages.filter(p => p.chapter_id === chapterId);
  };

  const getSyllabusStatus = (subjectId: string) => {
    const subjectChapters = getChaptersBySubject(subjectId);
    return {
      uploaded: subjectChapters.length > 0,
      chapterCount: subjectChapters.length,
      coverage: subjectChapters.length > 0 ? Math.min(100, subjectChapters.length * 10) : 0, // Estimate
    };
  };

  return {
    chapters,
    bookPages,
    loading,
    addChapter,
    updateChapter,
    deleteChapter,
    uploadBookPage,
    deleteBookPage,
    archiveForPromotion,
    getChaptersBySubject,
    getBookPagesBySubject,
    getBookPagesByChapter,
    getSyllabusStatus,
    refresh: fetchSyllabus,
  };
}
