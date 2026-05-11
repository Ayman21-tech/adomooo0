import { Bookmark, BookmarkCheck, Trash2, Edit2, Check, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useBookmarks } from '@/hooks/useBookmarks';

interface BookmarksPanelProps {
  subjectId: string;
  subjectName: string;
}

export function BookmarksPanel({ subjectId, subjectName }: BookmarksPanelProps) {
  const { bookmarks, loading, addBookmark, removeBookmark, updateBookmarkNote } = useBookmarks(subjectId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState('');
  const [newNote, setNewNote] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const handleStartEdit = (id: string, currentNote: string | null) => {
    setEditingId(id);
    setEditNote(currentNote || '');
  };

  const handleSaveEdit = async (id: string) => {
    await updateBookmarkNote(id, editNote);
    setEditingId(null);
    setEditNote('');
  };

  const handleAddBookmark = async () => {
    if (newNote.trim()) {
      await addBookmark(subjectId, undefined, newNote.trim());
      setNewNote('');
      setShowAddForm(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="border-border">
            <CardContent className="pt-4">
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bookmark className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Your Notes & Bookmarks</h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAddForm(!showAddForm)}
          className="rounded-xl"
        >
          {showAddForm ? 'Cancel' : 'Add Note'}
        </Button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-4">
            <div className="flex gap-2">
              <Input
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Write a note about this subject..."
                className="rounded-xl"
              />
              <Button onClick={handleAddBookmark} size="icon" className="rounded-xl shrink-0">
                <Check className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bookmarks List */}
      {bookmarks.length === 0 ? (
        <Card className="border-border">
          <CardContent className="pt-6 text-center">
            <div className="text-4xl mb-3">📝</div>
            <h4 className="font-medium mb-1">No bookmarks yet</h4>
            <p className="text-sm text-muted-foreground">
              Save important notes and topics as you learn {subjectName}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {bookmarks.map((bookmark) => (
            <Card key={bookmark.id} className="border-border hover:border-primary/30 transition-colors">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <BookmarkCheck className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    {editingId === bookmark.id ? (
                      <div className="flex gap-2">
                        <Input
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                          className="rounded-lg text-sm"
                          autoFocus
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleSaveEdit(bookmark.id)}
                          className="shrink-0"
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                          className="shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm">{bookmark.note || 'No note'}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(bookmark.created_at).toLocaleDateString()}
                        </p>
                      </>
                    )}
                  </div>
                  {editingId !== bookmark.id && (
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleStartEdit(bookmark.id, bookmark.note)}
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        onClick={() => removeBookmark(bookmark.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
