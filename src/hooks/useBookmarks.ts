import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Bookmark {
  id: string;
  subject_id: string;
  lesson_id: string | null;
  note: string | null;
  created_at: string;
}

export function useBookmarks(subjectId?: string) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBookmarks = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      let query = supabase
        .from('bookmarks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (subjectId) {
        query = query.eq('subject_id', subjectId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching bookmarks:', error);
      } else {
        setBookmarks(data || []);
      }
    } catch (error) {
      console.error('Error fetching bookmarks:', error);
    } finally {
      setLoading(false);
    }
  }, [subjectId]);

  const addBookmark = useCallback(async (
    subjectId: string,
    lessonId?: string,
    note?: string
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: 'Sign in required',
          description: 'Please sign in to save bookmarks',
          variant: 'destructive',
        });
        return false;
      }

      const { error } = await supabase
        .from('bookmarks')
        .insert({
          user_id: user.id,
          subject_id: subjectId,
          lesson_id: lessonId || null,
          note: note || null,
        });

      if (error) {
        if (error.code === '23505') {
          toast({
            title: 'Already bookmarked',
            description: 'This item is already in your bookmarks',
          });
        } else {
          throw error;
        }
        return false;
      }

      toast({
        title: 'Bookmarked!',
        description: 'Added to your bookmarks',
      });
      fetchBookmarks();
      return true;
    } catch (error) {
      console.error('Error adding bookmark:', error);
      toast({
        title: 'Error',
        description: 'Failed to add bookmark',
        variant: 'destructive',
      });
      return false;
    }
  }, [fetchBookmarks]);

  const removeBookmark = useCallback(async (bookmarkId: string) => {
    try {
      const { error } = await supabase
        .from('bookmarks')
        .delete()
        .eq('id', bookmarkId);

      if (error) throw error;

      setBookmarks(prev => prev.filter(b => b.id !== bookmarkId));
      toast({
        title: 'Removed',
        description: 'Bookmark removed',
      });
      return true;
    } catch (error) {
      console.error('Error removing bookmark:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove bookmark',
        variant: 'destructive',
      });
      return false;
    }
  }, []);

  const updateBookmarkNote = useCallback(async (bookmarkId: string, note: string) => {
    try {
      const { error } = await supabase
        .from('bookmarks')
        .update({ note })
        .eq('id', bookmarkId);

      if (error) throw error;

      setBookmarks(prev =>
        prev.map(b => (b.id === bookmarkId ? { ...b, note } : b))
      );
      return true;
    } catch (error) {
      console.error('Error updating bookmark:', error);
      return false;
    }
  }, []);

  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks]);

  return {
    bookmarks,
    loading,
    addBookmark,
    removeBookmark,
    updateBookmarkNote,
    refreshBookmarks: fetchBookmarks,
  };
}
