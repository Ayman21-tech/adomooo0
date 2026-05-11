import { useState, useRef } from 'react';
import { Upload, Plus, Check, ChevronRight, Edit2, Trash2, Image, FileText, BookOpen, FolderOpen, Camera, ArrowLeft, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useUser } from '@/contexts/UserContext';
import { useSyllabus, type SyllabusChapter } from '@/hooks/useSyllabus';
import { useOCR } from '@/hooks/useOCR';
import { getSubjectById, getCategoryBySubjectId } from '@/data/subjects';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { t } from '@/i18n';

type UploadStep = 'intro' | 'pick-source' | 'uploading' | 'scanning' | 'chapter-done';

const readDiagrams = (page: any): any[] => {
  const diagrams = page?.structured_content?.diagrams;
  return Array.isArray(diagrams) ? diagrams : [];
};

export function SyllabusTab() {
  const { user } = useUser();
  const lang = user.default_language;
  const {
    loading,
    addChapter, 
    updateChapter, 
    deleteChapter,
    uploadBookPage,
    deleteBookPage,
    getChaptersBySubject, 
    getBookPagesBySubject,
    getBookPagesByChapter,
    getSyllabusStatus 
  } = useSyllabus();
  const { extractBatch } = useOCR();

  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [showAddChapter, setShowAddChapter] = useState(false);
  const [newChapterName, setNewChapterName] = useState('');
  const [newTopics, setNewTopics] = useState('');
  const [editingChapter, setEditingChapter] = useState<SyllabusChapter | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Guided upload flow state
  const [uploadFlow, setUploadFlow] = useState(false);
  const [uploadStep, setUploadStep] = useState<UploadStep>('intro');
  const [currentChapterName, setCurrentChapterName] = useState('');
  const [currentChapterId, setCurrentChapterId] = useState<string | null>(null);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(1);
  const [pagesUploadedThisChapter, setPagesUploadedThisChapter] = useState(0);

  const startUploadFlow = () => {
    setUploadFlow(true);
    setUploadStep('intro');
    setCurrentChapterIndex(1);
    setCurrentChapterName('');
    setCurrentChapterId(null);
    setPagesUploadedThisChapter(0);
  };

  const handleStartChapter = async () => {
    if (!selectedSubject || !currentChapterName.trim()) return;
    
    const result = await addChapter(selectedSubject, currentChapterName.trim(), [], 'manual');
    if (result) {
      setCurrentChapterId(result.id);
      setUploadStep('pick-source');
      setPagesUploadedThisChapter(0);
    } else {
      toast({ title: 'Failed to create chapter', variant: 'destructive' });
    }
  };

  const handleUploadFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !selectedSubject) return;
    
    setUploading(true);
    setUploadStep('uploading');
    let count = 0;
    const uploadedPages: { id: string; imageUrl: string }[] = [];
    
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        toast({ title: `${file.name} is not an image`, variant: 'destructive' });
        continue;
      }
      
      const result = await uploadBookPage(
        selectedSubject,
        file,
        currentChapterId || undefined,
        currentChapterName || undefined,
      );
      
      if (result) {
        count++;
        uploadedPages.push({ id: result.id, imageUrl: result.image_url });
      } else {
        toast({ title: `Failed to upload ${file.name}`, variant: 'destructive' });
      }
    }
    
    setPagesUploadedThisChapter(prev => prev + count);
    setUploading(false);
    toast({ title: `${count} page(s) uploaded` });
    
    // Reset file inputs
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';

    // Trigger OCR extraction in background
    if (uploadedPages.length > 0) {
      setUploadStep('scanning');
      toast({ title: t('books.scanning', lang) });
      
      const ocrResults = await extractBatch(uploadedPages);
      const successCount = ocrResults.filter(r => r.success).length;
      
      if (successCount > 0) {
        toast({ title: t('books.ocrComplete', lang) });
      }
      if (successCount < ocrResults.length) {
        toast({ title: t('books.ocrFailed', lang), variant: 'destructive' });
      }
    }
    
    setUploadStep('chapter-done');
  };

  const handleUploadMorePages = () => {
    setUploadStep('pick-source');
  };

  const handleNextChapter = () => {
    setCurrentChapterIndex(prev => prev + 1);
    setCurrentChapterName('');
    setCurrentChapterId(null);
    setPagesUploadedThisChapter(0);
    setUploadStep('intro');
  };

  const handleFinishUpload = () => {
    setUploadFlow(false);
    setUploadStep('intro');
    setCurrentChapterName('');
    setCurrentChapterId(null);
    setPagesUploadedThisChapter(0);
    toast({ title: 'All chapters uploaded!' });
  };

  // --- Legacy single-page upload for subject detail view ---
  const handleQuickUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !selectedSubject) return;

    setUploading(true);
    const uploadedPages: { id: string; imageUrl: string }[] = [];

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      const result = await uploadBookPage(selectedSubject, file);
      if (result) {
        uploadedPages.push({ id: result.id, imageUrl: result.image_url });
      }
    }

    if (uploadedPages.length > 0) {
      const ocrResults = await extractBatch(uploadedPages);
      const successCount = ocrResults.filter(r => r.success).length;
      if (successCount > 0) {
        toast({ title: t('books.ocrComplete', lang) });
      }
      if (successCount < ocrResults.length) {
        toast({ title: t('books.ocrFailed', lang), variant: 'destructive' });
      }
    }

    setUploading(false);
    toast({ title: 'Pages uploaded' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  const handleDeleteChapter = async (chapterId: string) => {
    const success = await deleteChapter(chapterId);
    if (success) toast({ title: 'Chapter deleted' });
  };

  const handleDeletePage = async (pageId: string) => {
    const success = await deleteBookPage(pageId);
    if (success) toast({ title: 'Page deleted' });
  };

  const handleAddChapter = async () => {
    if (!selectedSubject || !newChapterName.trim()) return;
    const topics = newTopics.split('\n').map(t => t.trim()).filter(Boolean);
    const result = await addChapter(selectedSubject, newChapterName.trim(), topics, 'manual');
    if (result) {
      toast({ title: 'Chapter added successfully' });
      setNewChapterName('');
      setNewTopics('');
      setShowAddChapter(false);
    } else {
      toast({ title: 'Failed to add chapter', variant: 'destructive' });
    }
  };

  const handleUpdateChapter = async () => {
    if (!editingChapter || !newChapterName.trim()) return;
    const topics = newTopics.split('\n').map(t => t.trim()).filter(Boolean);
    const success = await updateChapter(editingChapter.id, { 
      chapter_name: newChapterName.trim(), topics 
    });
    if (success) {
      toast({ title: 'Chapter updated' });
      setEditingChapter(null);
      setNewChapterName('');
      setNewTopics('');
    } else {
      toast({ title: 'Failed to update', variant: 'destructive' });
    }
  };

  const startEditing = (chapter: SyllabusChapter) => {
    setEditingChapter(chapter);
    setNewChapterName(chapter.chapter_name);
    setNewTopics(chapter.topics.join('\n'));
  };

  // ===== GUIDED UPLOAD FLOW =====
  if (uploadFlow && selectedSubject) {
    const subject = getSubjectById(selectedSubject);

    return (
      <div className="space-y-4 pb-20">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setUploadFlow(false)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h2 className="font-semibold">{subject?.name}</h2>
            <p className="text-xs text-muted-foreground">{t('books.uploadBookPages', lang)}</p>
          </div>
          <Badge variant="outline" className="text-xs">
            Chapter {currentChapterIndex}
          </Badge>
        </div>

        {/* Step: Intro - Enter chapter name */}
        {uploadStep === 'intro' && (
          <Card className="glass-card border-border/50">
            <CardContent className="p-6 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">
                  {currentChapterIndex === 1 
                    ? "Let's upload your first chapter!" 
                    : `Upload Chapter ${currentChapterIndex}`}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Enter the chapter name, then upload the pages from your book.
                </p>
              </div>
              <div className="space-y-2">
                <Input
                  placeholder={`e.g., Chapter ${currentChapterIndex}: Introduction`}
                  value={currentChapterName}
                  onChange={(e) => setCurrentChapterName(e.target.value)}
                  className="input-premium text-center"
                />
                <Button
                  className="w-full btn-premium text-primary-foreground"
                  disabled={!currentChapterName.trim()}
                  onClick={handleStartChapter}
                >
                  Continue
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Pick source (camera / gallery) */}
        {uploadStep === 'pick-source' && (
          <Card className="glass-card border-border/50">
            <CardContent className="p-6 space-y-4">
              <div className="text-center">
                <h3 className="font-semibold">"{currentChapterName}"</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {pagesUploadedThisChapter > 0 
                    ? `${pagesUploadedThisChapter} page(s) uploaded. Add more or continue.`
                    : 'Choose how to upload book pages'}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                {/* Camera */}
                <label className="cursor-pointer">
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleUploadFileSelect}
                    className="hidden"
                    disabled={uploading}
                  />
                  <div className={cn(
                    "flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed transition-all",
                    "hover:border-primary hover:bg-primary/5 border-border"
                  )}>
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                      <Camera className="w-7 h-7 text-primary" />
                    </div>
                    <span className="text-sm font-medium">Camera</span>
                    <span className="text-xs text-muted-foreground">Take a photo</span>
                  </div>
                </label>
                
                {/* Gallery / File picker */}
                <label className="cursor-pointer">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleUploadFileSelect}
                    className="hidden"
                    disabled={uploading}
                  />
                  <div className={cn(
                    "flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed transition-all",
                    "hover:border-primary hover:bg-primary/5 border-border"
                  )}>
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                      <FolderOpen className="w-7 h-7 text-primary" />
                    </div>
                    <span className="text-sm font-medium">Gallery</span>
                    <span className="text-xs text-muted-foreground">Choose files</span>
                  </div>
                </label>
              </div>

              {pagesUploadedThisChapter > 0 && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setUploadStep('chapter-done')}
                >
                  Done with this chapter
                  <Check className="w-4 h-4 ml-2" />
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step: Uploading */}
        {uploadStep === 'uploading' && (
          <Card className="glass-card border-border/50">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-12 h-12 mx-auto border-3 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">{t('books.uploadingPages', lang)}</p>
            </CardContent>
          </Card>
        )}

        {/* Step: Scanning OCR */}
        {uploadStep === 'scanning' && (
          <Card className="glass-card border-border/50">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
              <div>
                <h3 className="font-semibold">{t('books.scanning', lang)}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  AI is reading your book pages...
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Chapter done - next chapter or finish */}
        {uploadStep === 'chapter-done' && (
          <Card className="glass-card border-border/50">
            <CardContent className="p-6 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{t('books.chapterUploaded', lang)}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  "{currentChapterName}" - {pagesUploadedThisChapter} page(s)
                </p>
              </div>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleUploadMorePages}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {t('books.addMorePages', lang)}
                </Button>
                <Button
                  className="w-full btn-premium text-primary-foreground"
                  onClick={handleNextChapter}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t('books.uploadNextChapter', lang)}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={handleFinishUpload}
                >
                  <Check className="w-4 h-4 mr-2" />
                  {t('common.finish', lang)}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4 pb-20">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 w-32 bg-muted rounded mb-2" />
              <div className="h-3 w-48 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // ===== SUBJECT LIST (no subject selected) =====
  if (!selectedSubject) {
    const totalPages = user.selected_subjects.reduce((sum, id) => sum + getBookPagesBySubject(id).length, 0);
    const totalOcrReady = user.selected_subjects.reduce(
      (sum, id) => sum + getBookPagesBySubject(id).filter((page) => page.ocr_status === 'completed').length,
      0,
    );
    const totalDiagrams = user.selected_subjects.reduce(
      (sum, id) => sum + getBookPagesBySubject(id).reduce((inner, page) => inner + readDiagrams(page).length, 0),
      0,
    );

    return (
      <div className="space-y-4 pb-20">
        <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <p className="text-xs uppercase tracking-wide text-primary/80">Book Intelligence</p>
                <h2 className="text-xl font-semibold">Upload. Extract. Teach.</h2>
                <p className="text-sm text-muted-foreground">
                  Your tutor teaches from your uploaded textbook pages, extracted text, and diagrams.
                </p>
              </div>
              <div className="h-11 w-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="rounded-xl border bg-background/70 p-3">
                <p className="text-[11px] text-muted-foreground">Subjects</p>
                <p className="text-lg font-semibold">{user.selected_subjects.length}</p>
              </div>
              <div className="rounded-xl border bg-background/70 p-3">
                <p className="text-[11px] text-muted-foreground">Pages</p>
                <p className="text-lg font-semibold">{totalPages}</p>
              </div>
              <div className="rounded-xl border bg-background/70 p-3">
                <p className="text-[11px] text-muted-foreground">Diagrams</p>
                <p className="text-lg font-semibold">{totalDiagrams}</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">OCR ready pages: {totalOcrReady}/{totalPages}</p>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {user.selected_subjects.map((subjectId) => {
            const subject = getSubjectById(subjectId);
            const category = getCategoryBySubjectId(subjectId);
            const status = getSyllabusStatus(subjectId);
            const subjectPages = getBookPagesBySubject(subjectId);
            const pageCount = subjectPages.length;
            const ocrDone = subjectPages.filter((page) => page.ocr_status === 'completed').length;
            const diagramCount = subjectPages.reduce((sum, page) => sum + readDiagrams(page).length, 0);

            if (!subject) return null;

            return (
              <Card
                key={subjectId}
                className="cursor-pointer border-border/70 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
                onClick={() => setSelectedSubject(subjectId)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-2xl">{category?.icon || 'Book'}</span>
                      <div className="min-w-0">
                        <h3 className="font-medium truncate">{subject.name}</h3>
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          {status.uploaded ? (
                            <Badge variant="default" className="text-xs">
                              <Check className="w-3 h-3 mr-1" />
                              {status.chapterCount} chapters
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              <Upload className="w-3 h-3 mr-1" />
                              Upload book
                            </Badge>
                          )}
                          {pageCount > 0 && <Badge variant="outline" className="text-xs">{pageCount} pages</Badge>}
                          {diagramCount > 0 && <Badge variant="outline" className="text-xs">{diagramCount} diagrams</Badge>}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>

                  {pageCount > 0 && (
                    <div className="mt-3">
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${Math.max(6, Math.round((ocrDone / Math.max(1, pageCount)) * 100))}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">OCR readiness: {ocrDone}/{pageCount}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // ===== SUBJECT DETAIL VIEW =====
  const subject = getSubjectById(selectedSubject);
  const category = getCategoryBySubjectId(selectedSubject);
  const subjectChapters = getChaptersBySubject(selectedSubject);
  const subjectPages = getBookPagesBySubject(selectedSubject);
  const ocrCompletedCount = subjectPages.filter((page) => page.ocr_status === 'completed').length;
  const diagramCount = subjectPages.reduce((sum, page) => sum + readDiagrams(page).length, 0);
  return (
    <div className="space-y-4 pb-20">
      {/* Back button and subject header */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setSelectedSubject(null)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <span className="text-2xl">{category?.icon || 'Book'}</span>
              <div>
                <h2 className="text-lg font-semibold leading-none">{subject?.name}</h2>
                <p className="text-xs text-muted-foreground mt-1">Book-grounded tutoring enabled</p>
              </div>
            </div>
            <Badge variant="outline">OCR {ocrCompletedCount}/{subjectPages.length}</Badge>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border bg-background/70 p-2.5 text-center">
              <p className="text-[11px] text-muted-foreground">Chapters</p>
              <p className="font-semibold">{subjectChapters.length}</p>
            </div>
            <div className="rounded-xl border bg-background/70 p-2.5 text-center">
              <p className="text-[11px] text-muted-foreground">Pages</p>
              <p className="font-semibold">{subjectPages.length}</p>
            </div>
            <div className="rounded-xl border bg-background/70 p-2.5 text-center">
              <p className="text-[11px] text-muted-foreground">Diagrams</p>
              <p className="font-semibold">{diagramCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button 
          onClick={() => setShowAddChapter(true)}
          variant="outline"
          className="flex-1"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Chapter
        </Button>
        <Button 
          onClick={startUploadFlow}
          className="flex-1 btn-premium text-primary-foreground"
        >
          <Upload className="w-4 h-4 mr-2" />
          {t('books.uploadBookPages', lang)}
        </Button>
      </div>

      {/* {t('books.uploadNextChapter', lang)} button */}
      {subjectChapters.length > 0 && (
        <Button
          variant="outline"
          className="w-full border-primary/30 text-primary hover:bg-primary/5"
          onClick={startUploadFlow}
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('books.uploadNextChapter', lang)}
        </Button>
      )}

      {/* Chapters list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            Chapters ({subjectChapters.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {subjectChapters.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No chapters added yet</p>
              <p className="text-xs mt-1">Use "{t('books.uploadBookPages', lang)}" to get started</p>
            </div>
          ) : (
            subjectChapters.map((chapter, index) => {
              const chapterPages = getBookPagesByChapter(chapter.id);
              const chapterOcrDone = chapterPages.filter((page) => page.ocr_status === 'completed').length;
              const chapterDiagramCount = chapterPages.reduce((sum, page) => sum + readDiagrams(page).length, 0);
              return (
                <div 
                  key={chapter.id}
                  className="p-3 rounded-lg bg-muted/50 border border-border"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground w-6">
                        {index + 1}.
                      </span>
                      <div>
                        <h4 className="font-medium text-sm">{chapter.chapter_name}</h4>
                        {chapter.topics.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {chapter.topics.length} topics
                          </p>
                        )}
                        {chapterPages.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            <Badge variant="outline" className="text-xs">
                              <Image className="w-3 h-3 mr-1" />
                              {chapterPages.length} pages
                            </Badge>
                            <Badge variant="outline" className="text-xs">OCR {chapterOcrDone}/{chapterPages.length}</Badge>
                            <Badge variant="outline" className="text-xs">{chapterDiagramCount} diagrams</Badge>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7"
                        onClick={() => startEditing(chapter)}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-destructive"
                        onClick={() => handleDeleteChapter(chapter.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Book Pages Gallery */}
      {subjectPages.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Image className="w-4 h-4 text-primary" />
              Book Pages ({subjectPages.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {subjectPages.map((page) => {
                const diagrams = readDiagrams(page);
                const ocrDone = page.ocr_status === 'completed';

                return (
                  <div
                    key={page.id}
                    className="relative aspect-[3/4] rounded-xl overflow-hidden border border-border group shadow-sm"
                  >
                    <img
                      src={page.image_url}
                      alt={`Page ${page.page_number || ''}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button
                        variant="destructive"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDeletePage(page.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="absolute top-1 left-1 flex flex-col gap-1">
                      <Badge variant={ocrDone ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0.5">
                        {ocrDone ? 'OCR ready' : 'OCR pending'}
                      </Badge>
                      {diagrams.length > 0 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 bg-background/80">
                          {diagrams.length} diagrams
                        </Badge>
                      )}
                    </div>

                    {page.page_number && (
                      <div className="absolute bottom-1 right-1 bg-black/65 text-white text-xs px-1.5 py-0.5 rounded">
                        p.{page.page_number}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Chapter Dialog */}
      <Dialog open={showAddChapter || !!editingChapter} onOpenChange={(open) => {
        if (!open) {
          setShowAddChapter(false);
          setEditingChapter(null);
          setNewChapterName('');
          setNewTopics('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingChapter ? 'Edit Chapter' : 'Add Chapter'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Chapter Name</label>
              <Input
                placeholder="e.g., Chapter 1: Introduction"
                value={newChapterName}
                onChange={(e) => setNewChapterName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Topics (one per line)</label>
              <Textarea
                placeholder={"Topic 1\nTopic 2\nTopic 3"}
                value={newTopics}
                onChange={(e) => setNewTopics(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAddChapter(false);
              setEditingChapter(null);
            }}>
              Cancel
            </Button>
            <Button onClick={editingChapter ? handleUpdateChapter : handleAddChapter}>
              {editingChapter ? t('books.saveChanges', lang) : t('books.addChapter', lang)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
















