import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ─── System Prompt ────────────────────────────────────────────────────────────
const BASE_PROMPT = `You are "Adomo AI", an advanced educational intelligence engine designed to provide direct, precise, and highly professional tutoring.

## CORE IDENTITY & PERSONALITY
- You have a concise, highly professional, "ChatGPT/Gemini-like" persona.
- You are not overly talkative. You deliver maximum educational value with minimal fluff.
- You do NOT use overly excited punctuation or excessive emojis. Keep it clean and academic.
- You do NOT repeatedly praise unless the student has hit a major milestone.
- You answer directly. Skip conversational filler like "I'd be happy to help!" or "Let's dive in!"

## LANGUAGE
- Respond in the student's preferred language (provided in context), maintaining a professional tone.
- If Bengali, use formal/academic phrasing (e.g. "নিশ্চয়ই", "এই বিষয়টি হলো..."). Avoid overly casual phrases.

## TEACHING FRAMEWORK
1. Direct Explanation — Clear, logically structured, concise.
2. Conceptual Foundation — Briefly link to what they must know.
3. [GENERATE_IMAGE: ...] — Use immediately if visualizing would reduce text.

## [SVS] AI SELF-VERIFICATION SYSTEM (STRICT RULE)
- For ALL mathematical, scientific, and logical questions, you MUST internally verify your steps before outputting.
- Show your work clearly and sequentially. If a calculation is complex, break it down. Precision is your highest priority.

## BOOK-PREFERRED MODE
- The student's uploaded book is the PRIMARY source. If available, reference specific chapters/pages.
- If no book is uploaded, provide a complete, standalone academic answer. Do NOT refuse to answer. You may gently add a single sentence at the end of your FIRST response suggesting they upload their syllabus.`;

// ─── Build adaptive profile section ──────────────────────────────────────────
function buildAdaptiveProfileSection(profile: any, lang: string): string {
  if (!profile) return '';

  const lines: string[] = ['\n\n## ADAPTIVE LEARNING ENGINE DATA (STRICT ADHERENCE REQUIRED)'];
  lines.push('Use the following system data to calibrate your response structure, length, and depth.\n');

  // [Difficulty Calibration System]
  const diffLabel = profile.recommended_difficulty_label || 'medium';
  lines.push(`### [Difficulty Calibration System]`);
  lines.push(`- Recommended Complexity: ${diffLabel.toUpperCase()} (calibration: ${profile.recommended_difficulty?.toFixed(2) || '1.00'})`);
  lines.push(`- Instruction: ${diffLabel === 'easy' ? 'Break down concepts. Use simpler vocabulary.' : diffLabel === 'hard' ? 'Use advanced academic terminology. Be concise.' : 'Standard academic pace.'}\n`);

  // [LDS] Learning DNA System
  if (profile.learning_dna) {
    const dna = profile.learning_dna;
    lines.push(`### [LDS] Learning DNA System Data`);
    lines.push(`- Primary Style: ${dna.primary_style || dna.type}`);
    lines.push(`- Learning Speed: ${dna.learning_speed} (Avg Response: ${dna.avg_response_time}s)`);
    lines.push(`- Retention Rate: ${dna.retention_rate}%`);
    lines.push(`- Focus Duration: ~${dna.focus_duration} mins`);
    lines.push(`- Instruction: If focus is low, keep answers extremely brief. If Visual, output [GENERATE_IMAGE:...] heavily. If Logical, use step-by-step derivations.\n`);
  }

  // [CMTS] Concept Mastery Tracking System
  const mastered = profile.mastered_count || 0;
  const total = profile.total_concepts || 0;
  lines.push(`### [CMTS] Concept Mastery Tracking System`);
  lines.push(`- Progress: ${mastered}/${total} concepts mastered (${total > 0 ? Math.round(mastered / total * 100) : 0}%).`);
  if (profile.trending_up?.length > 0) {
    lines.push(`- Improving Trends: ${profile.trending_up.slice(0, 3).map((t: any) => t.name).join(', ')}`);
  }
  lines.push('');

  // [WDE] Weakness Detection Engine
  if (profile.weak_concepts?.length > 0 || profile.trending_down?.length > 0) {
    lines.push(`### [WDE] Weakness Detection Engine`);
    if (profile.weak_concepts?.length > 0) {
      lines.push(`- Critical Weaknesses: ${profile.weak_concepts.slice(0, 3).map((w: any) => `${w.name} (${w.mastery}%)`).join(', ')}`);
    }
    if (profile.trending_down?.length > 0) {
      lines.push(`- Declining Performance: ${profile.trending_down.slice(0, 2).map((t: any) => t.name).join(', ')}`);
    }
    lines.push(`- Instruction: Be exceptionally clear and patient if addressing these topics.\n`);
  }

  // [KGS] Knowledge Graph System
  if (profile.prerequisite_gaps?.length > 0) {
    lines.push(`### [KGS] Knowledge Graph System`);
    lines.push(`- Prerequisite Gaps Detected:`);
    for (const gap of profile.prerequisite_gaps.slice(0, 2)) {
      lines.push(`  * Topic "${gap.concept}" depends on "${gap.prerequisite}" (Mastery: ${gap.prerequisite_mastery}%)`);
    }
    lines.push(`- Instruction: If the student asks about the topic, briefly cover the prerequisite first.\n`);
  }

  // Memories
  if (profile.long_term_memories?.length > 0 || profile.short_term_memories?.length > 0) {
    lines.push(`### Contextual Memory`);
    const mems = [...(profile.long_term_memories || []), ...(profile.short_term_memories || [])];
    for (const mem of mems.slice(0, 5)) {
      if (mem.key && mem.value && !mem.key.startsWith('learning_dna')) {
        lines.push(`- ${mem.key}: ${typeof mem.value === 'object' ? JSON.stringify(mem.value).slice(0, 100) : String(mem.value).slice(0, 100)}`);
      }
    }
  }

  return lines.join('\n');
}

// ─── Fetch adaptive profile from learning engine ──────────────────────────────
async function fetchAdaptiveProfile(
  supabaseUrl: string,
  authHeader: string,
  subjectId: string
): Promise<any | null> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/learning-engine`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({ action: 'get-student-profile', subject_id: subjectId }),
    });

    if (!response.ok) return null;
    return await response.json();
  } catch (e) {
    console.error('Failed to fetch adaptive profile:', e);
    return null;
  }
}


/** Google text-embedding-004 → 768 floats (must match book_page_chunks.embedding) */
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
      console.error('embedContent', res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const values = data?.embedding?.values;
    if (!Array.isArray(values) || values.length !== 768) return null;
    return values;
  } catch (e) {
    console.error('googleEmbed768', e);
    return null;
  }
}

async function fetchVectorBookChunks(
  supabaseUrl: string,
  authHeader: string,
  subjectId: string,
  userQuery: string,
  googleApiKey: string,
): Promise<{ section: string; chunkCount: number }> {
  if (!userQuery.trim() || !authHeader.startsWith('Bearer ')) {
    return { section: '', chunkCount: 0 };
  }
  const emb = await googleEmbed768(googleApiKey, userQuery);
  if (!emb) return { section: '', chunkCount: 0 };

  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!anonKey) return { section: '', chunkCount: 0 };

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const embeddingLiteral = '[' + emb.join(',') + ']';
  const { data, error } = await supabase.rpc('match_book_chunks', {
    query_embedding: embeddingLiteral,
    match_count: 8,
    filter_subject_id: subjectId,
  });

  if (error) {
    console.error('match_book_chunks rpc error', error);
    return { section: '', chunkCount: 0 };
  }
  if (!Array.isArray(data) || data.length === 0) {
    return { section: '', chunkCount: 0 };
  }

  let section =
    '## SEMANTIC BOOK CHUNKS (vector RAG — primary syllabus grounding when present; cite page/chapter)\n';
  for (const row of data as Array<{
    content: string;
    chapter_name: string | null;
    page_number: number | null;
    similarity: number;
  }>) {
    section += `\n### Page ${row.page_number ?? '?'} — ${row.chapter_name || 'Chapter'}\n`;
    section += `Semantic match: ${(Number(row.similarity) * 100).toFixed(1)}%\n${row.content}\n`;
  }
  return { section, chunkCount: data.length };
}

function normalizeQueryDigits(value: string): string {
  const bnDigits = '০১২৩৪৫৬৭৮৯';
  return value.replace(/[০-৯]/g, (d) => String(bnDigits.indexOf(d)));
}

function extractRequestedPageNumber(query: string): number | null {
  const normalized = normalizeQueryDigits(query.toLowerCase());
  const patterns = [
    /(?:\bpage|\bpg|\bp\.?|পৃষ্ঠা|পেজ)\s*[:#-]?\s*(\d{1,4})/i,
    /(\d{1,4})\s*(?:পৃষ্ঠা|পেজ|page|pg)/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) {
      const page = Number(match[1]);
      if (Number.isFinite(page) && page > 0 && page <= 5000) return page;
    }
  }

  return null;
}

function tokenizeQuery(query: string): string[] {
  const stopwords = new Set([
    'the', 'this', 'that', 'with', 'from', 'about', 'please', 'teach', 'me', 'explain',
    'a', 'an', 'and', 'for', 'to', 'of', 'in', 'on', 'is', 'are', 'was', 'were', 'it',
    'ei', 'eta', 'amar', 'amake', 'kore', 'bolo', 'teach', 'kor', 'explain', 'subject',
  ]);

  const normalized = normalizeQueryDigits(query.toLowerCase())
    .replace(/[^a-z0-9\u0980-\u09ff\s]/g, ' ');

  return normalized
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !stopwords.has(t));
}

function readStructureDiagrams(structure: any): any[] {
  if (!structure || typeof structure !== 'object') return [];
  const diagrams = (structure as any).diagrams;
  return Array.isArray(diagrams) ? diagrams : [];
}

function scoreContextPage(
  page: any,
  diagrams: any[],
  tokens: string[],
  requestedChapter?: string | null,
  requestedPage?: number | null,
): number {
  let score = 0;

  if (requestedPage && Number(page.page_number) === requestedPage) score += 500;

  if (requestedChapter && typeof page.chapter_name === 'string') {
    if (page.chapter_name.toLowerCase().includes(requestedChapter.toLowerCase())) score += 120;
  }

  const baseText = [
    String(page.chapter_name || ''),
    String(page.extracted_text || ''),
    ...diagrams.map((d) => `${d.title || ''} ${d.caption || ''} ${d.summary || ''} ${(d.labels || []).join(' ')}`),
  ].join(' ').toLowerCase();

  for (const token of tokens) {
    if (token.length < 2) continue;
    if (baseText.includes(token)) score += 8;
  }

  if (String(page.extracted_text || '').length > 500) score += 5;
  if (diagrams.length > 0) score += 6;

  return score;
}


async function fetchBookGroundedContext(
  supabaseUrl: string,
  authHeader: string,
  subjectId: string,
  userQuery: string,
  requestedChapter?: string | null,
  requestedPage?: number | null,
): Promise<{ content: string; pageCount: number; hasUploadedBook: boolean; bookStructureMap: string; lexicalPagesUsed: number }> {
  try {
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!anonKey) return { content: '', pageCount: 0, hasUploadedBook: false, bookStructureMap: '', lexicalPagesUsed: 0 };

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userResp, error: userError } = await supabase.auth.getUser();
    if (userError || !userResp?.user?.id) {
      return { content: '', pageCount: 0, hasUploadedBook: false, bookStructureMap: '', lexicalPagesUsed: 0 };
    }

    const userId = userResp.user.id;

    // Fetch ALL pages for this subject (no limit) to build complete book awareness
    const { data: pages, error } = await supabase
      .from('book_pages')
      .select('id, subject_id, chapter_name, chapter_id, extracted_text, structured_content, ocr_status, page_number, created_at')
      .eq('user_id', userId)
      .eq('subject_id', subjectId)
      .eq('is_archived', false)
      .order('page_number', { ascending: true });

    if (error || !pages || pages.length === 0) {
      return { content: '', pageCount: 0, hasUploadedBook: false, bookStructureMap: '', lexicalPagesUsed: 0 };
    }

    const completed = pages.filter((p: any) => p.ocr_status === 'completed' && (p.extracted_text || p.structured_content));
    if (completed.length === 0) {
      return { content: '', pageCount: pages.length, hasUploadedBook: true, bookStructureMap: '', lexicalPagesUsed: 0 };
    }

    // ── Build BOOK STRUCTURE MAP (always included, lightweight) ──────────────
    const chapterMap = new Map<string, { name: string; pages: number[]; topics: Set<string> }>();
    for (const page of completed) {
      const chKey = page.chapter_id || page.chapter_name || 'General';
      if (!chapterMap.has(chKey)) {
        chapterMap.set(chKey, { name: page.chapter_name || 'General', pages: [], topics: new Set() });
      }
      const ch = chapterMap.get(chKey)!;
      if (page.page_number) ch.pages.push(page.page_number);
      // Extract topics from structure
      const struct = page.structured_content;
      if (struct) {
        for (const h of (struct.headings || [])) ch.topics.add(h);
        for (const h of (struct.subheadings || [])) ch.topics.add(h);
      }
    }

    let bookStructureMap = '## BOOK STRUCTURE MAP (Your complete uploaded book)\n';
    bookStructureMap += `Total uploaded pages: ${pages.length} | OCR completed: ${completed.length}\n\n`;
    let chapterIdx = 1;
    for (const [, ch] of chapterMap) {
      const pageRange = ch.pages.length > 0
        ? `Pages ${Math.min(...ch.pages)}-${Math.max(...ch.pages)}`
        : 'Pages unknown';
      const topicList = Array.from(ch.topics).slice(0, 10).join(', ');
      bookStructureMap += `${chapterIdx}. ${ch.name} | ${pageRange} (${ch.pages.length} pages)\n`;
      if (topicList) bookStructureMap += `   Topics: ${topicList}\n`;
      chapterIdx++;
    }

    // ── Fetch diagrams ──────────────────────────────────────────────────────
    const pageIds = completed.map((p: any) => p.id);
    const diagramsByPage = new Map<string, any[]>();

    try {
      const { data: diagramRows } = await supabase
        .from('book_page_diagrams')
        .select('page_id, title, diagram_type, caption, labels, extracted_text, summary, metadata')
        .eq('user_id', userId)
        .in('page_id', pageIds);

      for (const row of diagramRows || []) {
        if (!diagramsByPage.has(row.page_id)) diagramsByPage.set(row.page_id, []);
        diagramsByPage.get(row.page_id)!.push(row);
      }
    } catch (e) {
      console.error('Failed to fetch diagram rows (non-blocking):', e);
    }

    for (const page of completed) {
      if (!diagramsByPage.has(page.id)) {
        const fallbackDiagrams = readStructureDiagrams(page.structured_content);
        if (fallbackDiagrams.length > 0) diagramsByPage.set(page.id, fallbackDiagrams);
      }
    }

    // ── Score and select most relevant pages for context ─────────────────────
    const tokens = tokenizeQuery(userQuery || '');

    const scored = completed
      .map((page: any) => {
        const diagrams = diagramsByPage.get(page.id) || [];
        return {
          page,
          diagrams,
          score: scoreContextPage(page, diagrams, tokens, requestedChapter, requestedPage),
        };
      })
      .sort((a: any, b: any) => b.score - a.score || String(b.page.created_at).localeCompare(String(a.page.created_at)));

    let selected = scored.slice(0, 15);

    // [RECENCY BOOST] If no high-score matches found, prioritize latest uploaded pages
    // This handles vague queries like "explain this page"
    if (selected.length > 0 && selected[0].score < 10) {
      const latest = [...scored]
        .sort((a, b) => String(b.page.created_at).localeCompare(String(a.page.created_at)))
        .slice(0, 5);
      
      // Merge latest into selected, avoiding duplicates
      const selectedIds = new Set(selected.map(s => s.page.id));
      for (const item of latest) {
        if (!selectedIds.has(item.page.id)) {
          selected.push(item);
          selectedIds.add(item.page.id);
        }
      }
      selected = selected.slice(0, 15);
    }

    let content = '## BOOK KNOWLEDGE BASE (STRICT SOURCE OF TRUTH — ONLY teach from this)\n';
    content += `Uploaded OCR pages available: ${completed.length} | Total pages: ${pages.length}\n`;

    if (requestedPage) {
      const requestedPageFound = completed.some((p: any) => Number(p.page_number) === requestedPage);
      content += requestedPageFound
        ? `Requested page: ${requestedPage} (FOUND in uploads)\n`
        : `Requested page: ${requestedPage} (NOT FOUND in uploads — tell student to upload this page)\n`;
    }

    if (requestedChapter) {
      content += `Requested chapter hint: ${requestedChapter}\n`;
    }

    for (const item of selected) {
      const page = item.page;
      const diagrams = item.diagrams || [];

      const header = `Page ${page.page_number ?? 'unknown'} | Subject: ${page.subject_id || 'general'} | Chapter: ${page.chapter_name || 'General'}`;
      content += `\n### ${header}\n`;

      // Include more text per page (increased from 2200)
      const excerpt = String(page.extracted_text || '').slice(0, 4000);
      if (excerpt) {
        content += `Text:\n${excerpt}\n`;
      }

      if (diagrams.length > 0) {
        content += 'Diagrams on this page:\n';
        for (const diagram of diagrams.slice(0, 8)) {
          const title = String(diagram.title || 'Untitled diagram');
          const dtype = String(diagram.diagram_type || 'diagram');
          const caption = String(diagram.caption || '');
          const labels = Array.isArray(diagram.labels) ? diagram.labels.slice(0, 10).join(', ') : '';
          const summary = String(diagram.summary || diagram.extracted_text || '');
          content += `- ${title} [${dtype}]${caption ? ` | caption: ${caption}` : ''}${labels ? ` | labels: ${labels}` : ''}\n`;
          if (summary) content += `  summary: ${summary.slice(0, 500)}\n`;
        }
      }
    }

    return {
      content: content.slice(0, 28000), // increased from 18000
      pageCount: completed.length,
      hasUploadedBook: true,
      bookStructureMap,
      lexicalPagesUsed: selected.length,
    };
  } catch (e) {
    console.error('Failed to fetch book-grounded context:', e);
    return { content: '', pageCount: 0, hasUploadedBook: false, bookStructureMap: '', lexicalPagesUsed: 0 };
  }
}

interface MessageContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string | MessageContent[];
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, subject, lessonContext, imageUrl, bookContext } = await req.json();

    const lastUserText = Array.isArray(messages)
      ? [...messages].reverse().find((m: any) => m?.role === 'user' && typeof m?.content === 'string')?.content || ''
      : '';

    const chapterMatch = lastUserText.match(/(?:chapter|ch)\s*([0-9]+)/i);
    const requestedChapter = chapterMatch ? `chapter ${chapterMatch[1]}` : null;
    const requestedPage = extractRequestedPageNumber(lastUserText);

    const GOOGLE_AI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY');
    if (!GOOGLE_AI_API_KEY) throw new Error('GOOGLE_AI_API_KEY is not configured');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const authHeader = req.headers.get('Authorization') || '';

    // ── Fetch adaptive profile + book context (parallel) ───────────
    let adaptiveProfile: any = null;
    let resolvedBookContext = bookContext || '';
    let bookStructureMap = '';
    let vectorChunkCount = 0;
    let lexicalPagesUsed = 0;

    if (subject && authHeader.startsWith('Bearer ')) {
      const subjectKey = subject.toLowerCase().replace(/\s+/g, '-');
      const [profileData, serverBookContext, vectorCtx] = await Promise.all([
        fetchAdaptiveProfile(SUPABASE_URL, authHeader, subjectKey),
        fetchBookGroundedContext(SUPABASE_URL, authHeader, subjectKey, lastUserText, requestedChapter, requestedPage),
        fetchVectorBookChunks(SUPABASE_URL, authHeader, subjectKey, lastUserText, GOOGLE_AI_API_KEY),
      ]);
      adaptiveProfile = profileData;
      lexicalPagesUsed = serverBookContext.lexicalPagesUsed;
      vectorChunkCount = vectorCtx.chunkCount;

      const ragTraceParts: string[] = [];
      if (vectorCtx.section.length > 0) {
        ragTraceParts.push(vectorCtx.section);
      }
      if (serverBookContext.content.length > 0) {
        ragTraceParts.push(serverBookContext.content);
      }
      resolvedBookContext = ragTraceParts.join('\n\n');
      bookStructureMap = serverBookContext.bookStructureMap;

      // Optional telemetry for evaluation dashboards (non-blocking)
      try {
        const anon = Deno.env.get('SUPABASE_ANON_KEY');
        if (anon && lastUserText.length > 0) {
          const sb = createClient(SUPABASE_URL, anon, { global: { headers: { Authorization: authHeader } } });
          const { data: u } = await sb.auth.getUser();
          if (u.user) {
            void sb.from('tutor_rag_traces').insert({
              user_id: u.user.id,
              subject_id: subjectKey,
              user_query_preview: lastUserText.slice(0, 500),
              vector_chunks_used: vectorChunkCount,
              lexical_pages_used: lexicalPagesUsed,
            });
          }
        }
      } catch (_) {
        /* ignore trace errors */
      }
    }

    // ── Extract context metadata ─────────────────────────────────────────────
    let studentName = '';
    let classLevel = '';
    let schoolName = '';
    let language = 'english';
    let preferredLanguageCode = '';

    if (lessonContext) {
      const nameMatch = lessonContext.match(/Student Name:\s*([^|,\n]+)/i);
      const classMatch = lessonContext.match(/Class:\s*([^|,\n]+)/i);
      const schoolMatch = lessonContext.match(/School:\s*([^|,\n]+)/i);
      const langMatch = lessonContext.match(/Language:\s*([^|,\n]+)/i);
      const prefLangMatch = lessonContext.match(/PreferredLanguage:\s*([a-z]{2,3})/i);

      if (nameMatch?.[1]?.trim()) studentName = nameMatch[1].trim();
      if (classMatch?.[1]?.trim()) classLevel = classMatch[1].trim();
      if (schoolMatch?.[1]?.trim()) schoolName = schoolMatch[1].trim();
      if (langMatch?.[1]?.trim()) language = langMatch[1].trim().toLowerCase();
      if (prefLangMatch?.[1]) preferredLanguageCode = prefLangMatch[1].toLowerCase();
    }

    // Map ISO code to natural language name for the AI
    const ISO_LANG_NAMES: Record<string, string> = {
      en: 'English', bn: 'Bengali (Bangla)', hi: 'Hindi', es: 'Spanish', fr: 'French',
      ar: 'Arabic', zh: 'Chinese (Mandarin)', ja: 'Japanese', ko: 'Korean',
      pt: 'Portuguese', de: 'German', tr: 'Turkish', id: 'Indonesian',
      ur: 'Urdu', th: 'Thai', ru: 'Russian', it: 'Italian',
    };
    const langName = preferredLanguageCode
      ? (ISO_LANG_NAMES[preferredLanguageCode] || language)
      : (language.includes('bangla') || language.includes('bengali') ? 'Bengali (Bangla)' : 'English');

    // ── Build system prompt ──────────────────────────────────────────────────
    let systemPrompt = BASE_PROMPT;

    // Student identity block
    const identityLines: string[] = ['\n\n## STUDENT IDENTITY'];
    if (studentName) {
      identityLines.push(`- Name: "${studentName}" — USE THEIR NAME OFTEN. Warmly.`);
    }
    if (classLevel) identityLines.push(`- Class: ${classLevel}`);
    if (schoolName) identityLines.push(`- School: ${schoolName}`);
    identityLines.push(`- PRIMARY LANGUAGE: ${langName} — Respond in ${langName} unless the student writes in another language.`);
    if (subject) identityLines.push(`- Current subject: ${subject}`);
    systemPrompt += identityLines.join('\n');

    // Inject adaptive profile
    systemPrompt += buildAdaptiveProfileSection(adaptiveProfile, language);

    // Inject book structure map (always, so AI knows full book)
    if (bookStructureMap && bookStructureMap.length > 50) {
      systemPrompt += `\n\n${bookStructureMap}`;
    }

    // Inject book context as PRIMARY source (not strict-only)
    if (resolvedBookContext && resolvedBookContext.length > 50) {
      systemPrompt += `

## UPLOADED BOOK CONTENT (PRIMARY SOURCE — prefer this over general knowledge)
- Use the content below as your primary reference whenever it covers the topic.
- Semantic chunks (if listed first) are retrieved by embedding similarity; full pages below add lexical/context coverage.
- Reference specific chapters/pages when answering.
- If the topic is partly missing, fill gaps with appropriate general academic knowledge for the class level — and tell the student which pages to upload to get a fully book-grounded answer.

${resolvedBookContext.slice(0, 26000)}`;
    } else {
      // No book uploaded — encourage upload but allow free teaching
      systemPrompt += `\n\n## NO BOOK UPLOADED YET
The student has not uploaded textbook pages for this subject.
- Teach freely using general academic knowledge appropriate for their class level and language.
- On your FIRST reply only, gently nudge: "📚 Tip: Upload your textbook page in the Books tab so I can teach from your exact syllabus."
- Do NOT repeat that nudge every message — only ~once every 5 turns at most, and naturally.
- Never refuse to answer because no book is uploaded.`;
    }

    // ── Process messages (inject image in last user message if present) ──────
    const processedMessages: Message[] = messages.map((msg: Message, index: number) => {
      if (msg.role === 'user' && imageUrl && index === messages.length - 1) {
        return {
          role: 'user',
          content: [
            { type: 'text', text: typeof msg.content === 'string' ? msg.content : 'Please analyze this image' },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        };
      }
      return msg;
    });

    const model = 'gemini-1.5-flash';

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GOOGLE_AI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...processedMessages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
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
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      return new Response(JSON.stringify({ error: 'Failed to get AI response' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });
  } catch (error) {
    console.error('AI tutor error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
