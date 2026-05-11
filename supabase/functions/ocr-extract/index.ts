import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Detect MIME type from first bytes (magic numbers)
function detectMimeType(bytes: Uint8Array): string {
  if (bytes[0] === 0xFF && bytes[1] === 0xD8) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png';
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return 'image/gif';
  if (bytes[0] === 0x52 && bytes[1] === 0x49) return 'image/webp';
  // HEIC / HEIF - ftyp box
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) return 'image/heic';
  return 'image/jpeg'; // fallback
}

type DiagramExtract = {
  title: string | null;
  diagram_type: string | null;
  caption: string | null;
  labels: string[];
  extracted_text: string | null;
  summary: string | null;
  metadata: Record<string, unknown>;
};

function asCleanString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : null;
}

/** Google text-embedding-004 → 768 floats (pgvector book_page_chunks) */
async function googleEmbed768(apiKey: string, text: string): Promise<number[] | null> {
  const trimmed = text.trim().slice(0, 8000);
  if (!trimmed) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/text-embedding-004',
          content: { parts: [{ text: trimmed }] },
        }),
      },
    );
    if (!res.ok) {
      console.error('embedContent HTTP', res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const values = data?.embedding?.values;
    if (!Array.isArray(values) || values.length !== 768) {
      console.error('Unexpected embedding length', values?.length);
      return null;
    }
    return values;
  } catch (e) {
    console.error('googleEmbed768 error', e);
    return null;
  }
}

function splitTextIntoChunks(text: string, maxLen = 1000, overlap = 150): string[] {
  const t = text.trim();
  if (!t) return [];
  if (t.length <= maxLen) return [t];
  const chunks: string[] = [];
  let start = 0;
  while (start < t.length) {
    let end = Math.min(start + maxLen, t.length);
    if (end < t.length) {
      const br = t.lastIndexOf('\n', end);
      if (br > start + maxLen / 2) end = br + 1;
    }
    const piece = t.slice(start, end).trim();
    if (piece.length > 0) chunks.push(piece);
    if (end >= t.length) break;
    const next = end - overlap;
    start = next > start ? next : end;
  }
  return chunks;
}

async function reindexBookPageChunks(
  supabase: ReturnType<typeof createClient>,
  apiKey: string,
  pageMeta: {
    id: string;
    user_id: string;
    subject_id: string;
    chapter_name: string | null;
    page_number: number | null;
  },
  extractedText: string,
): Promise<void> {
  try {
    await supabase.from('book_page_chunks').delete().eq('book_page_id', pageMeta.id);
    const chunks = splitTextIntoChunks(extractedText || '');
    if (chunks.length === 0) return;

    for (let i = 0; i < chunks.length; i++) {
      const emb = await googleEmbed768(apiKey, chunks[i]);
      if (!emb) continue;
      const embeddingStr = '[' + emb.join(',') + ']';
      const { error } = await supabase.from('book_page_chunks').insert({
        user_id: pageMeta.user_id,
        book_page_id: pageMeta.id,
        subject_id: pageMeta.subject_id,
        chapter_name: pageMeta.chapter_name,
        page_number: pageMeta.page_number,
        chunk_index: i,
        content: chunks[i],
        embedding: embeddingStr,
      });
      if (error) {
        console.error('book_page_chunks insert error', error);
      }
    }
  } catch (e) {
    console.error('reindexBookPageChunks failed (non-blocking)', e);
  }
}

function normalizeDiagramList(raw: unknown): DiagramExtract[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const candidate = item as Record<string, unknown>;
      const labels = Array.isArray(candidate.labels)
        ? candidate.labels.map((l) => String(l).trim()).filter(Boolean)
        : [];

      return {
        title: asCleanString(candidate.title),
        diagram_type: asCleanString(candidate.diagram_type),
        caption: asCleanString(candidate.caption),
        labels,
        extracted_text: asCleanString(candidate.extracted_text),
        summary: asCleanString(candidate.summary),
        metadata: typeof candidate.metadata === 'object' && candidate.metadata !== null
          ? (candidate.metadata as Record<string, unknown>)
          : {},
      } as DiagramExtract;
    })
    .filter((d): d is DiagramExtract => Boolean(d));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let parsedPageId: string | undefined;
  try {
    const requestBody = await req.json();
    const { pageId, imageUrl } = requestBody;

    if (!pageId || !imageUrl) {
      throw new Error('pageId and imageUrl are required');
    }
    parsedPageId = pageId;

    const GOOGLE_AI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY');
    if (!GOOGLE_AI_API_KEY) {
      throw new Error('GOOGLE_AI_API_KEY is not configured');
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase credentials not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch image bytes and convert to base64 data URL
    // This handles ALL formats including HEIC which Gemini can't load via URL
    console.log('Fetching image from:', imageUrl);
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.status}`);
    }
    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBytes = new Uint8Array(imageBuffer);
    const detectedMime = detectMimeType(imageBytes);
    const base64Data = base64Encode(imageBuffer);
    
    // For HEIC/unsupported formats, use inline_data instead of image_url
    // Gemini supports HEIC via inline_data even though it rejects HEIC URLs
    console.log(`Image fetched: ${imageBytes.length} bytes, detected MIME: ${detectedMime}`);

    const userContent: any[] = [
      { type: 'text', text: 'Perform high-accuracy OCR for Bangla (bn-BD) and English (en). Extract clean text and detect all visible diagrams, labels, captions, tables, and chart elements.' },
    ];

    // Use inline_data for all images to avoid format issues
    userContent.push({
      type: 'image_url',
      image_url: { url: `data:${detectedMime};base64,${base64Data}` }
    });

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GOOGLE_AI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-1.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are an enterprise OCR + textbook structuring engine for Bangla (bn-BD) and English (en).

Goals:
1) Extract ALL visible text accurately from textbook pages.
2) Clean noise where possible (page numbers, repeated running headers/footers, watermarks).
3) Preserve math symbols/formulas and bilingual wording.
4) Build structured hierarchy for learning engine indexing.
5) Detect all diagrams/figures/charts/tables and capture their labels and meaning.

Return ONLY valid JSON with this exact shape:
{
  "extracted_text": "full clean text",
  "language": "bn" | "en" | "mixed",
  "quality": {
    "confidence": 0-100,
    "noise_removed": ["list"],
    "warnings": ["list"]
  },
  "structure": {
    "class_level": null | "string",
    "subject": null | "string",
    "chapter_number": null | number,
    "chapter_title": null | "string",
    "headings": ["..."],
    "subheadings": ["..."],
    "examples": ["..."] ,
    "exercises": ["..."],
    "sections": [
      {
        "section_title": "string",
        "content_blocks": [
          {
            "type": "heading" | "subheading" | "paragraph" | "example" | "exercise" | "formula" | "definition" | "note",
            "text": "string"
          }
        ]
      }
    ]
  },
  "diagrams": [
    {
      "title": "null | string",
      "diagram_type": "null | flowchart | graph | geometry | map | circuit | table | figure | other",
      "caption": "null | string",
      "labels": ["list of visible labels in the diagram"],
      "extracted_text": "all text read from inside the diagram/figure/table",
      "summary": "short educational meaning of the diagram",
      "metadata": {
        "has_axes": "boolean",
        "has_legend": "boolean",
        "has_equation": "boolean"
      }
    }
  ]
}

Rules:
- Do not summarize textbook paragraphs.
- If a field is missing, use null or empty array.
- Preserve Bangla script exactly.
- Return JSON only, no markdown.`
          },
          {
            role: 'user',
            content: userContent,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini OCR error:', response.status, errorText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please try again later.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`OCR extraction failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content returned from OCR');
    }

    // Parse the JSON response
    let ocrResult;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
      ocrResult = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse OCR JSON, using raw text:', parseError);
      ocrResult = {
        extracted_text: content,
        language: 'mixed',
        quality: { confidence: 50, noise_removed: [], warnings: ['fallback_parser_used'] },
        structure: {
          class_level: null,
          subject: null,
          chapter_number: null,
          chapter_title: null,
          headings: [],
          subheadings: [],
          examples: [],
          exercises: [],
          sections: [{ section_title: 'Page Content', content_blocks: [{ type: 'paragraph', text: content }] }],
        },
        diagrams: [],
      };
    }

    const normalizedDiagrams = normalizeDiagramList(ocrResult.diagrams);
    const mergedStructure = {
      ...(ocrResult.structure || {}),
      diagrams: normalizedDiagrams,
    };

    const { data: pageMeta, error: pageMetaError } = await supabase
      .from('book_pages')
      .select('id, user_id, subject_id, chapter_id, chapter_name, page_number')
      .eq('id', pageId)
      .single();

    if (pageMetaError || !pageMeta) {
      throw new Error('Failed to load page metadata for OCR persistence');
    }

    // Update the book_pages record with extracted text + structured content
    const { error: updateError } = await supabase
      .from('book_pages')
      .update({
        extracted_text: ocrResult.extracted_text,
        structured_content: mergedStructure,
        ocr_status: 'completed',
      })
      .eq('id', pageId);

    if (updateError) {
      console.error('Failed to update book page:', updateError);
      throw new Error('Failed to save OCR results');
    }

    // Persist diagram entities as permanent searchable records (non-blocking on failure)
    try {
      await supabase.from('book_page_diagrams').delete().eq('page_id', pageId);

      if (normalizedDiagrams.length > 0) {
        const diagramRows = normalizedDiagrams.map((diagram, index) => ({
          user_id: pageMeta.user_id,
          page_id: pageMeta.id,
          subject_id: pageMeta.subject_id,
          chapter_id: pageMeta.chapter_id,
          chapter_name: pageMeta.chapter_name,
          page_number: pageMeta.page_number,
          diagram_index: index,
          title: diagram.title,
          diagram_type: diagram.diagram_type,
          caption: diagram.caption,
          labels: diagram.labels,
          extracted_text: diagram.extracted_text,
          summary: diagram.summary,
          metadata: diagram.metadata,
        }));

        const { error: diagramInsertError } = await supabase
          .from('book_page_diagrams')
          .insert(diagramRows);

        if (diagramInsertError) {
          console.error('Failed to persist diagram rows:', diagramInsertError);
        }
      }
    } catch (diagramError) {
      console.error('Diagram persistence error:', diagramError);
    }

    // Vector RAG: chunk + embed book text (non-blocking on total OCR success)
    if (GOOGLE_AI_API_KEY && ocrResult.extracted_text) {
      await reindexBookPageChunks(supabase, GOOGLE_AI_API_KEY, pageMeta, ocrResult.extracted_text);
    }

    return new Response(JSON.stringify({
      success: true,
      extracted_text: ocrResult.extracted_text,
      structure: mergedStructure,
      language: ocrResult.language,
      diagrams: normalizedDiagrams,
      diagram_count: normalizedDiagrams.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('OCR extraction error:', error);

    try {
      if (parsedPageId) {
        const pageId = parsedPageId;
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
          const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
          await supabase
            .from('book_pages')
            .update({ ocr_status: 'failed' })
            .eq('id', pageId);
        }
      }
    } catch (_) {
      // Ignore fallback status update errors
    }

    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
