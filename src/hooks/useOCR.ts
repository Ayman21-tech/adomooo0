import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to trigger OCR text extraction on uploaded book pages.
 * Uses Gemini vision via the ocr-extract edge function.
 */
export function useOCR() {
  const extractText = useCallback(async (pageId: string, imageUrl: string, retryCount = 0): Promise<{
    success: boolean;
    extracted_text?: string;
    structure?: any;
    diagrams?: any[];
    diagram_count?: number;
    error?: string;
  }> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ocr-extract`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ pageId, imageUrl }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Auto-retry on 429 (rate limit) or 500 (transient errors), up to 2 retries
        if ((response.status === 429 || response.status === 500) && retryCount < 2) {
          const delay = (retryCount + 1) * 2000;
          await new Promise(resolve => setTimeout(resolve, delay));
          return extractText(pageId, imageUrl, retryCount + 1);
        }
        
        return { success: false, error: errorData.error || 'OCR failed' };
      }

      const data = await response.json();

      // Upgrade chapter metadata from OCR structure (book structure overrides defaults)
      if (data?.structure && session) {
        try {
          const chapterTitle = data.structure.chapter_title;
          const chapterNumber = data.structure.chapter_number;
          const topicPool = [
            ...(Array.isArray(data.structure.headings) ? data.structure.headings : []),
            ...(Array.isArray(data.structure.subheadings) ? data.structure.subheadings : []),
          ].filter(Boolean).slice(0, 20);

          const { data: pageInfo } = await supabase
            .from('book_pages')
            .select('chapter_id')
            .eq('id', pageId)
            .single();

          if (pageInfo?.chapter_id && (chapterTitle || topicPool.length > 0)) {
            const normalizedName = chapterTitle
              ? (chapterNumber ? `Chapter ${chapterNumber}: ${chapterTitle}` : chapterTitle)
              : undefined;

            await supabase
              .from('syllabus_library')
              .update({
                ...(normalizedName ? { chapter_name: normalizedName } : {}),
                ...(topicPool.length > 0 ? { topics: topicPool } : {}),
                upload_type: 'book_override',
              })
              .eq('id', pageInfo.chapter_id);
          }
        } catch (e) {
          console.error('OCR chapter structuring update failed:', e);
        }
      }

      // Auto-build knowledge graph AND store FULL book memory permanently
      if (data.extracted_text && session) {
        try {
          const { data: pageInfo } = await supabase
            .from('book_pages')
            .select('subject_id, chapter_id, page_number, chapter_name')
            .eq('id', pageId)
            .single();

          if (pageInfo?.chapter_id) {
            // Build knowledge graph (non-blocking)
            fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/learning-engine`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                action: 'build-knowledge-graph',
                subject_id: pageInfo.subject_id,
                chapter_id: pageInfo.chapter_id,
                chapter_text: data.extracted_text,
              }),
            }).catch(err => console.error('Knowledge graph build failed (non-blocking):', err));

            // Store FULL extracted text permanently — no truncation
            fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/learning-engine`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                action: 'store-memory',
                memory_type: 'long_term',
                memory_key: `book_page_${pageId}`,
                memory_value: {
                  source: 'uploaded_book',
                  page_id: pageId,
                  chapter_id: pageInfo.chapter_id,
                  chapter_name: pageInfo.chapter_name || null,
                  subject_id: pageInfo.subject_id,
                  page_number: pageInfo.page_number || null,
                  extracted_text: data.extracted_text, // Full text, no truncation
                  structure: data.structure || null,
                  diagrams: Array.isArray(data.diagrams) ? data.diagrams : [],
                  diagram_count: Number(data.diagram_count || 0),
                  updated_at: new Date().toISOString(),
                },
                subject_id: pageInfo.subject_id,
              }),
            }).catch(err => console.error('Book memory persistence failed (non-blocking):', err));

            // Also store a chapter-level summary memory
            fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/learning-engine`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                action: 'store-memory',
                memory_type: 'long_term',
                memory_key: `book_chapter_${pageInfo.chapter_id}`,
                memory_value: {
                  source: 'uploaded_book',
                  chapter_id: pageInfo.chapter_id,
                  subject_id: pageInfo.subject_id,
                  extracted_text: data.extracted_text, // Full text, no truncation
                  structure: data.structure || null,
                  diagrams: Array.isArray(data.diagrams) ? data.diagrams : [],
                  diagram_count: Number(data.diagram_count || 0),
                  updated_at: new Date().toISOString(),
                },
                subject_id: pageInfo.subject_id,
              }),
            }).catch(err => console.error('Book chapter memory failed (non-blocking):', err));
          }
        } catch (e) {
          console.error('Knowledge graph trigger failed:', e);
        }
      }

      return {
        success: true,
        extracted_text: data.extracted_text,
        structure: data.structure,
        diagrams: data.diagrams,
        diagram_count: data.diagram_count,
      };
    } catch (error) {
      // Auto-retry on network errors
      if (retryCount < 2) {
        const delay = (retryCount + 1) * 2000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return extractText(pageId, imageUrl, retryCount + 1);
      }
      console.error('OCR extraction error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'OCR failed',
      };
    }
  }, []);

  const extractBatch = useCallback(async (pages: { id: string; imageUrl: string }[]) => {
    const results = [];
    for (const page of pages) {
      const result = await extractText(page.id, page.imageUrl);
      results.push({ pageId: page.id, ...result });
      if (pages.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    return results;
  }, [extractText]);

  return { extractText, extractBatch };
}
