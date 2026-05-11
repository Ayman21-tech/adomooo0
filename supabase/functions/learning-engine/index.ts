import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ─── Supabase Client ────────────────────────────────────────────────────────
function createSupabaseClient(authHeader: string) {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function exponentialMovingAverage(prev: number, latest: number, alpha = 0.3): number {
  return Math.round(alpha * latest + (1 - alpha) * prev);
}

function detectTrend(scores: number[]): 'improving' | 'declining' | 'stable' {
  if (scores.length < 3) return 'stable';
  const recent = scores.slice(-3);
  const deltaA = recent[1] - recent[0];
  const deltaB = recent[2] - recent[1];
  if (deltaA < -5 && deltaB < -5) return 'declining';
  if (deltaA > 5 && deltaB > 5) return 'improving';
  return 'stable';
}

function computeWeaknessLevel(mastery: number, trend: string, streak: number): 'critical' | 'weak' | 'borderline' | 'ok' {
  if (mastery < 25 || (mastery < 40 && trend === 'declining')) return 'critical';
  if (mastery < 40 || (mastery < 55 && streak <= 0)) return 'weak';
  if (mastery < 60) return 'borderline';
  return 'ok';
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}


type BookKnowledgeContext = {
  content: string;
  pageCount: number;
  chapterFiltered: boolean;
};

async function fetchBookKnowledgeContext(
  supabase: any,
  userId: string,
  subjectId: string,
  chapterId: string | null,
  maxPages = 30
): Promise<BookKnowledgeContext> {
  const buildQuery = (withChapter: boolean) => {
    let q = supabase
      .from('book_pages')
      .select('id, chapter_name, chapter_id, page_number, extracted_text, structured_content, ocr_status, created_at')
      .eq('user_id', userId)
      .eq('subject_id', subjectId)
      .eq('is_archived', false)
      .order('page_number', { ascending: true })
      .limit(Math.max(40, maxPages * 3));

    if (withChapter && chapterId) q = q.eq('chapter_id', chapterId);
    return q;
  };

  let chapterFiltered = Boolean(chapterId);
  let { data: pages } = await buildQuery(chapterFiltered);
  let completed = (pages || []).filter((p: any) => p.ocr_status === 'completed' && (p.extracted_text || p.structured_content));

  if (completed.length === 0 && chapterFiltered) {
    chapterFiltered = false;
    const fallback = await buildQuery(false);
    pages = fallback.data || [];
    completed = (pages || []).filter((p: any) => p.ocr_status === 'completed' && (p.extracted_text || p.structured_content));
  }

  if (completed.length === 0) {
    return { content: '', pageCount: (pages || []).length, chapterFiltered };
  }

  const selected = completed.slice(0, maxPages);
  const pageIds = selected.map((p: any) => p.id);
  const diagramMap = new Map<string, any[]>();

  try {
    const { data: diagramRows } = await supabase
      .from('book_page_diagrams')
      .select('page_id, title, diagram_type, caption, labels, extracted_text, summary')
      .eq('user_id', userId)
      .in('page_id', pageIds);

    for (const row of diagramRows || []) {
      if (!diagramMap.has(row.page_id)) diagramMap.set(row.page_id, []);
      diagramMap.get(row.page_id)!.push(row);
    }
  } catch {
    // Fallback to structured-content diagrams when diagram table is unavailable.
  }

  let content = 'BOOK KNOWLEDGE CONTEXT (PRIMARY SOURCE)\n';
  content += `Subject: ${subjectId}\n`;
  content += `OCR-ready pages available: ${completed.length}\n`;
  if (chapterId) {
    content += chapterFiltered
      ? `Requested chapter filter: ${chapterId} (FOUND)\n`
      : `Requested chapter filter: ${chapterId} (NO OCR PAGES, using subject-wide fallback)\n`;
  }

  for (const page of selected) {
    const pageHeader = `Page ${page.page_number ?? 'unknown'} | Chapter: ${page.chapter_name || 'General'}`;
    content += `\n## ${pageHeader}\n`;

    const excerpt = String(page.extracted_text || '').slice(0, 4000);
    if (excerpt) {
      content += `${excerpt}\n`;
    }

    const structuredDiagrams = Array.isArray(page?.structured_content?.diagrams)
      ? page.structured_content.diagrams
      : [];
    const diagrams = (diagramMap.get(page.id) || structuredDiagrams).slice(0, 6);
    if (diagrams.length > 0) {
      content += 'Diagrams:\n';
      for (const d of diagrams) {
        const title = String(d.title || 'Untitled diagram');
        const kind = String(d.diagram_type || 'diagram');
        const caption = String(d.caption || '');
        const labels = Array.isArray(d.labels) ? d.labels.slice(0, 8).join(', ') : '';
        const summary = String(d.summary || d.extracted_text || '');
        content += `- ${title} [${kind}]${caption ? ` | ${caption}` : ''}${labels ? ` | labels: ${labels}` : ''}\n`;
        if (summary) content += `  ${summary.slice(0, 280)}\n`;
      }
    }
  }

  return {
    content: content.slice(0, 28000),
    pageCount: (pages || []).length,
    chapterFiltered,
  };
}
function buildStructuredMemoryValue(source: {
  event: string;
  conceptId?: string;
  subjectId?: string;
  confidence?: number;
  details?: Record<string, unknown>;
}) {
  return {
    schema_version: 1,
    event: source.event,
    concept_id: source.conceptId ?? null,
    subject_id: source.subjectId ?? null,
    confidence: source.confidence ?? 0.8,
    details: source.details ?? {},
    recorded_at: new Date().toISOString(),
  };
}

function extractLearningDNAPayload(value: any) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const payload = value?.details?.payload;
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return payload;
  }
  return value;
}

function computeWeaknessRisk(params: {
  mastery: number;
  trend: 'improving' | 'declining' | 'stable';
  recentFails: number;
  averageTimeSeconds?: number;
  difficultyCalibration: number;
}) {
  const timePenalty = params.averageTimeSeconds && params.averageTimeSeconds > 180 ? 10 : 0;
  const trendPenalty = params.trend === 'declining' ? 20 : params.trend === 'stable' ? 8 : 0;
  const failPenalty = params.recentFails * 12;
  const masteryPenalty = clamp((60 - params.mastery) * 1.2, 0, 70);
  const calibrationPenalty = params.difficultyCalibration > 1.2 && params.mastery < 55 ? 8 : 0;

  return clamp(Math.round(masteryPenalty + trendPenalty + failPenalty + timePenalty + calibrationPenalty), 0, 100);
}

function calculateRewardMomentum(params: {
  streak: number;
  mastery: number;
  trend: 'improving' | 'declining' | 'stable';
}) {
  const streakBoost = Math.min(20, params.streak * 2);
  const masteryBoost = params.mastery >= 80 ? 20 : params.mastery >= 60 ? 12 : 4;
  const trendBoost = params.trend === 'improving' ? 15 : params.trend === 'stable' ? 5 : -10;
  return clamp(streakBoost + masteryBoost + trendBoost, 0, 50);
}

async function promoteMemoryIfStable(supabase: any, userId: string, memoryKey: string) {
  const { data: matchingShortTerm } = await supabase
    .from('adaptive_memory')
    .select('id, key, value, created_at')
    .eq('user_id', userId)
    .eq('memory_type', 'short_term')
    .eq('key', memoryKey)
    .order('created_at', { ascending: false })
    .limit(5);

  if (!matchingShortTerm || matchingShortTerm.length < 3) return;

  const newestMemory = matchingShortTerm[0];
  const { data: existingLongTerm } = await supabase
    .from('adaptive_memory')
    .select('id')
    .eq('user_id', userId)
    .eq('memory_type', 'long_term')
    .eq('key', memoryKey)
    .single();

  if (existingLongTerm) {
    await supabase
      .from('adaptive_memory')
      .update({ value: newestMemory.value, relevance_score: 1.0, updated_at: new Date().toISOString() })
      .eq('id', existingLongTerm.id);
  } else {
    await supabase.from('adaptive_memory').insert({
      user_id: userId,
      memory_type: 'long_term',
      key: memoryKey,
      value: newestMemory.value,
      relevance_score: 1.0,
    });
  }

  await supabase.from('adaptive_memory').delete().in('id', matchingShortTerm.map((m: any) => m.id));
}

// ─── ACTION: get-student-profile ─────────────────────────────────────────────
async function getStudentProfile(supabase: any, userId: string, subjectId: string) {
  // Parallel fetch all needed data
  const [
    { data: weakConcepts },
    { data: allMastery },
    { data: shortTermMemories },
    { data: longTermMemories },
    { data: streak },
    { data: recentActivity },
  ] = await Promise.all([
    supabase
      .from('concept_mastery')
      .select('*, concept:concept_graph!inner(*)')
      .eq('user_id', userId)
      .eq('is_weak', true)
      .order('mastery_score', { ascending: true })
      .limit(20),
    supabase
      .from('concept_mastery')
      .select('*, concept:concept_graph!inner(*)')
      .eq('user_id', userId)
      .eq('concept.subject_id', subjectId),
    supabase
      .from('adaptive_memory')
      .select('*')
      .eq('user_id', userId)
      .eq('memory_type', 'short_term')
      .or(`subject_id.eq.${subjectId},subject_id.is.null`)
      .gt('expires_at', new Date().toISOString())
      .order('relevance_score', { ascending: false })
      .limit(15),
    supabase
      .from('adaptive_memory')
      .select('*')
      .eq('user_id', userId)
      .eq('memory_type', 'long_term')
      .or(`subject_id.eq.${subjectId},subject_id.is.null`)
      .order('relevance_score', { ascending: false })
      .limit(25),
    supabase
      .from('study_streaks')
      .select('*')
      .eq('user_id', userId)
      .single(),
    supabase
      .from('learning_activity')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30),
  ]);

  // Clean expired short-term memories (fire and forget)
  supabase
    .from('adaptive_memory')
    .delete()
    .eq('user_id', userId)
    .eq('memory_type', 'short_term')
    .lt('expires_at', new Date().toISOString())
    .then(() => {});

  // ── Trend analysis ────────────────────────────────────────────────────────
  const trendingDown = (allMastery || []).filter((m: any) => {
    const scores = m.last_scores || [];
    return detectTrend(scores) === 'declining';
  });

  const trendingUp = (allMastery || []).filter((m: any) => {
    const scores = m.last_scores || [];
    return detectTrend(scores) === 'improving' && m.mastery_score >= 60;
  });

  // ── Prerequisite gap detection ────────────────────────────────────────────
  const prereqGaps: any[] = [];
  const masteryById: Record<string, any> = {};
  for (const m of allMastery || []) {
    masteryById[m.concept_id] = m;
  }

  for (const m of allMastery || []) {
    if (m.concept?.parent_concept_id && m.mastery_score > 30) {
      const parentMastery = masteryById[m.concept.parent_concept_id];
      if (parentMastery && parentMastery.mastery_score < 50) {
        prereqGaps.push({
          concept: m.concept.concept_name,
          concept_mastery: m.mastery_score,
          prerequisite: parentMastery.concept?.concept_name || 'prerequisite',
          prerequisite_mastery: parentMastery.mastery_score,
          urgency: parentMastery.mastery_score < 25 ? 'high' : 'medium',
        });
      }
    }
  }

  // Sort gaps by urgency
  prereqGaps.sort((a, b) => a.prerequisite_mastery - b.prerequisite_mastery);

  // ── Difficulty calibration ────────────────────────────────────────────────
  const avgCalibration = (allMastery || []).length > 0
    ? (allMastery || []).reduce((s: number, m: any) => s + (m.difficulty_calibration ?? 1.0), 0) / allMastery.length
    : 1.0;

  const recommendedDifficulty = clamp(avgCalibration, 0.5, 1.5);

  const trendSummary = (allMastery || []).reduce((acc: any, m: any) => {
    const trend = detectTrend(m.last_scores || []);
    acc[trend] = (acc[trend] || 0) + 1;
    return acc;
  }, { improving: 0, declining: 0, stable: 0 });

  const subjectMomentum = (trendSummary.improving * 2) - (trendSummary.declining * 2);
  const trendAdjustedDifficulty = clamp(
    recommendedDifficulty + (subjectMomentum > 3 ? 0.15 : subjectMomentum < -3 ? -0.15 : 0),
    0.3,
    2.0
  );

  // ── Mastery stats ─────────────────────────────────────────────────────────
  const mastered = (allMastery || []).filter((m: any) => m.mastery_score >= 80);
  const criticalWeak = (weakConcepts || []).filter((m: any) => m.mastery_score < 25);

  // ── Learning DNA profile from long-term memory ─────────────────────────────
  const learningDnaMem = (longTermMemories || []).find((m: any) => m.key === 'learning_dna');
  const learningDna = computeLearningDNAProfile(learningDnaMem?.value || null);
  const learningStyle = learningDna?.type || null;

  // ── Recent struggle patterns ──────────────────────────────────────────────
  const recentStruggles = (shortTermMemories || [])
    .filter((m: any) => m.key?.startsWith('struggle_') || m.key?.startsWith('chat_topic_'))
    .slice(0, 5)
    .map((m: any) => m.value);

  // ── Reward signals ────────────────────────────────────────────────────────
  const rewards: Array<{ type: string; message: string; icon: string }> = [];

  if (streak) {
    const s = streak.current_streak || 0;
    if (s >= 30) rewards.push({ type: 'streak', icon: '🏆', message: `${s}-day streak! Legendary dedication!` });
    else if (s >= 14) rewards.push({ type: 'streak', icon: '🔥', message: `${s}-day streak! Unstoppable!` });
    else if (s >= 7)  rewards.push({ type: 'streak', icon: '⭐', message: `${s}-day streak! Keep going!` });
    else if (s >= 3)  rewards.push({ type: 'streak', icon: '👏', message: `${s}-day streak! Great start!` });
    if (s === 1) rewards.push({ type: 'streak_start', icon: '🌱', message: 'First day back! Welcome!' });
  }

  if (mastered.length >= 10) rewards.push({ type: 'mastery', icon: '🎓', message: `${mastered.length} concepts mastered! Expert level!` });
  else if (mastered.length > 0) rewards.push({ type: 'mastery', icon: '✅', message: `${mastered.length} concept${mastered.length > 1 ? 's' : ''} mastered!` });

  // Comeback detection — concept improved by 20+ points recently
  for (const m of allMastery || []) {
    const scores = m.last_scores || [];
    if (scores.length >= 4) {
      const older = scores.slice(0, Math.floor(scores.length / 2));
      const newer = scores.slice(Math.floor(scores.length / 2));
      const avgOld = older.reduce((a: number, b: number) => a + b, 0) / older.length;
      const avgNew = newer.reduce((a: number, b: number) => a + b, 0) / newer.length;
      if (avgNew - avgOld >= 20 && m.mastery_score >= 50) {
        rewards.push({ type: 'comeback', icon: '💪', message: `Huge improvement in ${m.concept?.concept_name}!` });
        break;
      }
    }
  }

  // Daily goal check
  const today = new Date().toDateString();
  const todayActivity = (recentActivity || []).filter((a: any) => new Date(a.created_at).toDateString() === today);
  if (todayActivity.length >= 3) {
    rewards.push({ type: 'daily_goal', icon: '🎯', message: 'Daily goal achieved! 3 sessions complete!' });
  }

  // ── Build structured profile ──────────────────────────────────────────────
  return {
    weak_concepts: (weakConcepts || []).map((w: any) => ({
      id: w.concept_id,
      name: w.concept?.concept_name,
      mastery: w.mastery_score,
      subject: w.concept?.subject_id,
      trend: detectTrend(w.last_scores || []),
      weakness_level: computeWeaknessLevel(w.mastery_score, detectTrend(w.last_scores || []), w.streak || 0),
      difficulty: w.concept?.difficulty_level,
      attempts: w.attempts || 0,
    })),
    trending_down: trendingDown.map((t: any) => ({
      id: t.concept_id,
      name: t.concept?.concept_name,
      mastery: t.mastery_score,
      scores: t.last_scores?.slice(-5),
    })),
    trending_up: trendingUp.map((t: any) => ({
      id: t.concept_id,
      name: t.concept?.concept_name,
      mastery: t.mastery_score,
      scores: t.last_scores?.slice(-3),
    })),
    prerequisite_gaps: prereqGaps.slice(0, 5),
    recommended_difficulty: trendAdjustedDifficulty,
    recommended_difficulty_label: trendAdjustedDifficulty < 0.7 ? 'easy' : trendAdjustedDifficulty < 1.1 ? 'medium' : 'hard',
    trend_summary: trendSummary,
    short_term_memories: (shortTermMemories || []).map((m: any) => ({ key: m.key, value: m.value })),
    long_term_memories: (longTermMemories || []).map((m: any) => ({ key: m.key, value: m.value })),
    learning_style: learningStyle,
    learning_dna: learningDna,
    recent_struggles: recentStruggles,
    rewards,
    mastered_count: mastered.length,
    critical_weak_count: criticalWeak.length,
    total_concepts: (allMastery || []).length,
    streak_days: streak?.current_streak || 0,
    daily_sessions_today: todayActivity.length,
    intelligence_state: {
      has_knowledge_graph: (allMastery || []).length > 0,
      adaptive_memory_ready: (shortTermMemories || []).length + (longTermMemories || []).length > 0,
      weakness_risk_distribution: (allMastery || []).map((m: any) => {
        const scores = m.last_scores || [];
        return {
          concept_id: m.concept_id,
          concept_name: m.concept?.concept_name,
          risk: computeWeaknessRisk({
            mastery: m.mastery_score,
            trend: detectTrend(scores),
            recentFails: scores.slice(-3).filter((s: number) => s < 50).length,
            averageTimeSeconds: undefined,
            difficultyCalibration: m.difficulty_calibration ?? 1.0,
          }),
        };
      }).sort((a: any, b: any) => b.risk - a.risk).slice(0, 5),
      next_best_actions: [
        ...(prereqGaps.length > 0 ? [{ type: 'repair_prerequisite', target: prereqGaps[0].prerequisite }] : []),
        ...(trendingDown.length > 0 ? [{ type: 'stabilize_declining', target: trendingDown[0].concept?.concept_name }] : []),
        ...(criticalWeak.length > 0 ? [{ type: 'intensive_practice', target: criticalWeak[0].concept?.concept_name }] : []),
      ],
    },
  };
}

// ─── ACTION: log-performance ──────────────────────────────────────────────────
async function logPerformance(
  supabase: any,
  userId: string,
  conceptId: string,
  score: number,
  timeSpent?: number
) {
  // Fetch existing mastery record
  const { data: existing } = await supabase
    .from('concept_mastery')
    .select('*')
    .eq('user_id', userId)
    .eq('concept_id', conceptId)
    .single();

  const isCorrect = score >= 50;
  const now = new Date().toISOString();

  if (!existing) {
    await supabase.from('concept_mastery').insert({
      user_id: userId,
      concept_id: conceptId,
      mastery_score: score,
      attempts: 1,
      correct_count: isCorrect ? 1 : 0,
      streak: isCorrect ? 1 : 0,
      last_scores: [score],
      is_weak: score < 40,
      difficulty_calibration: 1.0,
      last_practiced_at: now,
    });
    return {
      updated: true,
      new_mastery: score,
      is_weak: score < 40,
      is_new: true,
      difficulty_calibration: 1.0,
      streak: isCorrect ? 1 : 0,
    };
  }

  // Compute updated values
  const newMastery = exponentialMovingAverage(existing.mastery_score, score);
  const newStreak = isCorrect ? (existing.streak || 0) + 1 : 0;
  const lastScores: number[] = [...(existing.last_scores || []), score].slice(-10);

  // Trend analysis
  const trend = detectTrend(lastScores);
  const recentFails = lastScores.slice(-3).filter((s: number) => s < 50).length;
  const consecutiveFails = lastScores.length >= 3 && lastScores.slice(-3).every((s: number) => s < 50);

  // Weakness detection: mastery < 40 OR 3 consecutive fails OR critically declining
  const isWeak = newMastery < 40 || consecutiveFails || (newMastery < 55 && trend === 'declining');

  // [Difficulty Calibration System] Enhanced adjustment with strict trend + speed sensitivity
  let calibration = existing.difficulty_calibration ?? 1.0;
  const hasSlowResponse = (timeSpent ?? 0) > 120; // tightened
  const hasFastResponse = (timeSpent ?? 0) > 0 && (timeSpent ?? 0) < 30;

  if (newStreak >= 2 && trend === 'improving' && hasFastResponse) {
    calibration = clamp(calibration + 0.15, 0.3, 2.0); // Max power unlock
  } else if (newStreak >= 3 && trend !== 'declining') {
    calibration = clamp(calibration + 0.1, 0.3, 2.0);
  } else if (recentFails >= 2 || trend === 'declining' || hasSlowResponse) {
    calibration = clamp(calibration - 0.15, 0.3, 2.0);
  }

  const weaknessRisk = computeWeaknessRisk({
    mastery: newMastery,
    trend,
    recentFails,
    averageTimeSeconds: timeSpent,
    difficultyCalibration: calibration,
  });

  await supabase
    .from('concept_mastery')
    .update({
      mastery_score: newMastery,
      attempts: (existing.attempts || 0) + 1,
      correct_count: (existing.correct_count || 0) + (isCorrect ? 1 : 0),
      streak: newStreak,
      last_scores: lastScores,
      difficulty_calibration: calibration,
      is_weak: isWeak,
      last_practiced_at: now,
    })
    .eq('id', existing.id);

  // ── Prerequisite chain flagging ────────────────────────────────────────────
  if (isWeak) {
    const { data: concept } = await supabase
      .from('concept_graph')
      .select('parent_concept_id, concept_name')
      .eq('id', conceptId)
      .single();

    if (concept?.parent_concept_id) {
      const { data: parentMastery } = await supabase
        .from('concept_mastery')
        .select('id, mastery_score, is_weak')
        .eq('user_id', userId)
        .eq('concept_id', concept.parent_concept_id)
        .single();

      if (parentMastery && parentMastery.mastery_score < 60 && !parentMastery.is_weak) {
        await supabase
          .from('concept_mastery')
          .update({ is_weak: true })
          .eq('id', parentMastery.id);
      }
    }
  }

  // ── Memory promotion: short-term → long-term ──────────────────────────────
  // Promote only the active struggle key to avoid full-table scans per event.
  const activeStruggleKey = `struggle_${conceptId}`;
  await promoteMemoryIfStable(supabase, userId, activeStruggleKey);

  // ── Log struggle as short-term memory if concept is weak ─────────────────
  if (isWeak && score < 50) {
    await supabase.from('adaptive_memory').insert({
      user_id: userId,
      memory_type: 'short_term',
      key: `struggle_${conceptId}`,
      value: buildStructuredMemoryValue({
        event: 'concept_struggle',
        conceptId,
        confidence: 0.85,
        details: {
          score,
          trend,
          weakness_risk: weaknessRisk,
          response_time_seconds: timeSpent ?? null,
        },
      }),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  if (newMastery >= 80 && trend === 'improving') {
    await supabase.from('adaptive_memory').insert({
      user_id: userId,
      memory_type: 'long_term',
      key: `mastered_${conceptId}`,
      value: buildStructuredMemoryValue({
        event: 'concept_mastered',
        conceptId,
        confidence: 0.95,
        details: { mastery: newMastery, streak: newStreak, calibration },
      }),
      relevance_score: 1.0,
    });
  }

  return {
    updated: true,
    new_mastery: newMastery,
    is_weak: isWeak,
    difficulty_calibration: calibration,
    streak: newStreak,
    trend,
    weakness_level: computeWeaknessLevel(newMastery, trend, newStreak),
    weakness_risk: weaknessRisk,
    reward_momentum: calculateRewardMomentum({ streak: newStreak, mastery: newMastery, trend }),
  };
}

// ─── ACTION: process-learning-event ───────────────────────────────────────────
async function extractRelevantConcepts(
  supabase: any,
  userId: string,
  subjectId: string,
  text: string,
  limit = 3,
) {
  const normalizedText = String(text || '').toLowerCase();
  if (!normalizedText.trim()) return [];

  const { data: concepts } = await supabase
    .from('concept_graph')
    .select('id, concept_name, metadata, parent_concept_id')
    .eq('user_id', userId)
    .eq('subject_id', subjectId)
    .limit(300);

  if (!concepts || concepts.length === 0) return [];

  const scored = (concepts || []).map((c: any) => {
    const conceptName = String(c.concept_name || '').toLowerCase();
    const keywords = Array.isArray(c.metadata?.keywords)
      ? c.metadata.keywords.map((k: any) => String(k).toLowerCase())
      : [];

    let score = 0;
    if (conceptName && normalizedText.includes(conceptName)) score += 8;
    for (const kw of keywords.slice(0, 10)) {
      if (kw && normalizedText.includes(kw)) score += 3;
    }

    // Light token overlap fallback for partial matches
    for (const token of conceptName.split(/\s+/).filter(Boolean)) {
      if (token.length >= 4 && normalizedText.includes(token)) score += 1;
    }

    return {
      id: c.id,
      concept_name: c.concept_name,
      parent_concept_id: c.parent_concept_id,
      match_score: score,
    };
  })
  .filter((c: any) => c.match_score > 0)
  .sort((a: any, b: any) => b.match_score - a.match_score)
  .slice(0, limit);

  return scored;
}

function scoreFromVerification(verification: any) {
  const confidence = clamp(Number(verification?.confidence ?? 65), 0, 100);
  const isAccurate = Boolean(verification?.is_accurate);

  if (isAccurate) {
    return clamp(Math.round(confidence * 0.9 + 15), 50, 98);
  }

  if (verification?.corrected_answer) {
    return clamp(Math.round(confidence * 0.55), 30, 70);
  }

  return clamp(Math.round(confidence * 0.45), 20, 60);
}

// ─── Learning DNA System ──────────────────────────────────────────────────────
async function updateLearningDNA(
  supabase: any,
  userId: string,
  subjectId: string,
  context: {
    userMessage: string;
    assistantAnswer: string;
    responseTimeSeconds?: number;
    verification: any;
    matchedConcepts: any[];
    performanceEvents: any[];
  },
) {
  const DNA_KEY = 'learning_dna';
  const text = `${context.userMessage} ${context.assistantAnswer}`.toLowerCase();

  // Fetch existing DNA
  const { data: existing } = await supabase
    .from('adaptive_memory')
    .select('id, value')
    .eq('user_id', userId)
    .eq('key', DNA_KEY)
    .eq('memory_type', 'long_term')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const defaults = {
    learning_type: { visual: 0, logical: 0, example: 0, story: 0, practice: 0 },
    response_speeds: [] as number[],
    session_lengths: [] as number[],
    retention_scores: [] as number[],
    focus_signals: { short_focus: 0, medium_focus: 0, long_focus: 0 },
    motivation_signals: { reward: 0, curiosity: 0, mastery: 0, social: 0 },
    error_categories: {} as Record<string, number>,
    strength_subjects: {} as Record<string, number[]>,
    total_interactions: 0,
    last_updated: new Date().toISOString(),
  };

  const raw = extractLearningDNAPayload(existing?.value);
  const dna: any = {
    ...defaults,
    ...raw,
    learning_type: {
      ...defaults.learning_type,
      ...(raw.learning_type && typeof raw.learning_type === 'object' && !Array.isArray(raw.learning_type)
        ? raw.learning_type
        : {}),
    },
    focus_signals: {
      ...defaults.focus_signals,
      ...(raw.focus_signals && typeof raw.focus_signals === 'object' && !Array.isArray(raw.focus_signals)
        ? raw.focus_signals
        : {}),
    },
    motivation_signals: {
      ...defaults.motivation_signals,
      ...(raw.motivation_signals && typeof raw.motivation_signals === 'object' && !Array.isArray(raw.motivation_signals)
        ? raw.motivation_signals
        : {}),
    },
    error_categories: raw.error_categories && typeof raw.error_categories === 'object' && !Array.isArray(raw.error_categories)
      ? raw.error_categories
      : {},
    strength_subjects: raw.strength_subjects && typeof raw.strength_subjects === 'object' && !Array.isArray(raw.strength_subjects)
      ? raw.strength_subjects
      : {},
  };

  const learningType = dna.learning_type || { ...defaults.learning_type };
  dna.learning_type = learningType;

  // ── Learning type signals ──────────────────────────────────────────────────
  if (/diagram|picture|visual|draw|show me|image|chart|graph|figure/.test(text)) {
    learningType.visual = Number(learningType.visual || 0) + 2;
  }
  if (/step.by.step|logic|reason|derive|proof|because|therefore|thus/.test(text)) {
    learningType.logical = Number(learningType.logical || 0) + 2;
  }
  if (/example|instance|such as|like when|for example|e\.g\./.test(text)) {
    learningType.example = Number(learningType.example || 0) + 2;
  }
  if (/story|real life|everyday|imagine|scenario|suppose|what if/.test(text)) {
    learningType.story = Number(learningType.story || 0) + 2;
  }
  if (/practice|solve|try|exercise|quiz|test me|question/.test(text)) {
    learningType.practice = Number(learningType.practice || 0) + 2;
  }

  // ── Response speed tracking ────────────────────────────────────────────────
  if (context.responseTimeSeconds) {
    const speeds = Array.isArray(dna.response_speeds) ? dna.response_speeds : [];
    speeds.push(context.responseTimeSeconds);
    dna.response_speeds = speeds.slice(-30); // keep last 30

    // Update focus signals based on response time [LDS Upgrade]
    const focusSignals = dna.focus_signals || { short_focus: 0, medium_focus: 0, long_focus: 0 };
    if (context.responseTimeSeconds < 15) focusSignals.short_focus += 1;
    else if (context.responseTimeSeconds < 60) focusSignals.medium_focus += 1;
    else focusSignals.long_focus += 1;
    dna.focus_signals = focusSignals;
  }

  // ── Retention tracking from performance ────────────────────────────────────
  for (const perf of (Array.isArray(context.performanceEvents) ? context.performanceEvents : [])) {
    if (perf?.new_mastery !== undefined) {
      const scores = Array.isArray(dna.retention_scores) ? dna.retention_scores : [];
      scores.push(perf.new_mastery);
      dna.retention_scores = scores.slice(-50);
    }
  }

  // ── Motivation signals ─────────────────────────────────────────────────────
  const userMsg = String(context.userMessage || '').toLowerCase();
  const motivationSignals = dna.motivation_signals || { ...defaults.motivation_signals };
  dna.motivation_signals = motivationSignals;
  if (/reward|badge|streak|score|points|rank/.test(userMsg)) motivationSignals.reward = Number(motivationSignals.reward || 0) + 1;
  if (/why|how does|curious|wonder|interesting|explain/.test(userMsg)) motivationSignals.curiosity = Number(motivationSignals.curiosity || 0) + 1;
  if (/master|perfect|improve|better|best|strong/.test(userMsg)) motivationSignals.mastery = Number(motivationSignals.mastery || 0) + 1;
  if (/friend|class|teacher|compare|others|everyone/.test(userMsg)) motivationSignals.social = Number(motivationSignals.social || 0) + 1;

  // ── Error category tracking ────────────────────────────────────────────────
  if (!context.verification?.is_accurate && context.matchedConcepts.length > 0) {
    for (const concept of context.matchedConcepts) {
      const cat = concept.concept_name || 'unknown';
      dna.error_categories[cat] = (dna.error_categories[cat] || 0) + 1;
    }
  }

  // ── Subject strength tracking ──────────────────────────────────────────────
  const avgPerfScore = context.performanceEvents.length > 0
    ? context.performanceEvents.reduce((s: number, p: any) => s + (p.new_mastery || 0), 0) / context.performanceEvents.length
    : null;
  if (avgPerfScore !== null) {
    const existing_scores = dna.strength_subjects[subjectId] || [];
    existing_scores.push(avgPerfScore);
    dna.strength_subjects[subjectId] = existing_scores.slice(-20);
  }

  dna.total_interactions = (dna.total_interactions || 0) + 1;
  dna.last_updated = new Date().toISOString();

  // Store updated DNA
  await storeMemory(supabase, userId, 'long_term', DNA_KEY, dna, null);
}

function computeLearningDNAProfile(dnaInput: any) {
  const dna = extractLearningDNAPayload(dnaInput);
  if (!dna || typeof dna !== 'object' || Array.isArray(dna)) return null;

  // Determine primary learning type
  const types = dna.learning_type || {};
  const sorted = Object.entries(types).sort((a: any, b: any) => b[1] - a[1]);
  const primaryType = sorted[0]?.[0] || 'balanced';
  const secondaryType = sorted[1]?.[1] > 0 ? sorted[1]?.[0] : null;

  const typeLabels: Record<string, string> = {
    visual: 'Visual Learner',
    logical: 'Logical Thinker',
    example: 'Example-Driven',
    story: 'Story-Based Learner',
    practice: 'Hands-On Practitioner',
    balanced: 'Balanced Learner',
  };

  const typeLabel = secondaryType
    ? `${typeLabels[primaryType]} + ${typeLabels[secondaryType]}`
    : typeLabels[primaryType] || 'Balanced Learner';

  // Learning speed
  const speeds = dna.response_speeds || [];
  const avgSpeed = speeds.length > 0 ? speeds.reduce((a: number, b: number) => a + b, 0) / speeds.length : 0;
  const speedLabel = avgSpeed <= 5 ? 'Fast' : avgSpeed <= 15 ? 'Medium' : 'Thoughtful';

  // Retention rate
  const retentions = dna.retention_scores || [];
  const retentionRate = retentions.length > 0
    ? Math.round(retentions.reduce((a: number, b: number) => a + b, 0) / retentions.length)
    : 0;

  // Focus duration estimate from response speed variance
  const focusSignals = dna.focus_signals || {};
  const totalFocus = (focusSignals.short_focus || 0) + (focusSignals.medium_focus || 0) + (focusSignals.long_focus || 0);
  const focusDuration = totalFocus === 0 ? 15 : // default
    focusSignals.long_focus > focusSignals.short_focus ? 25 :
    focusSignals.short_focus > focusSignals.long_focus ? 10 : 15;

  // Motivation type
  const motives = dna.motivation_signals || {};
  const motivesSorted = Object.entries(motives).sort((a: any, b: any) => b[1] - a[1]);
  const motivationType = motivesSorted[0]?.[1] > 0 ? motivesSorted[0]?.[0] : 'curiosity';
  const motiveLabels: Record<string, string> = {
    reward: 'Reward-Based',
    curiosity: 'Curiosity-Driven',
    mastery: 'Mastery-Oriented',
    social: 'Socially Motivated',
  };

  // Top error patterns
  const errors = dna.error_categories || {};
  const weakPatterns = Object.entries(errors)
    .sort((a: any, b: any) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => ({ name, count }));

  // Strong subjects
  const strengths = dna.strength_subjects || {};
  const strongSubjects = Object.entries(strengths)
    .map(([subject, scores]: any) => ({
      subject,
      avg: Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length),
    }))
    .sort((a, b) => b.avg - a.avg);

  return {
    type: typeLabel,
    primary_style: primaryType,
    secondary_style: secondaryType,
    learning_speed: speedLabel,
    avg_response_time: Math.round(avgSpeed),
    retention_rate: retentionRate,
    focus_duration: focusDuration,
    motivation_type: motiveLabels[motivationType] || 'Curiosity-Driven',
    weak_patterns: weakPatterns,
    strong_subjects: strongSubjects,
    total_interactions: dna.total_interactions || 0,
    learning_type_scores: types,
    last_updated: dna.last_updated,
  };
}

async function runIntelligenceCycle(
  supabase: any,
  userId: string,
  subjectId: string,
  userMessage: string,
  assistantAnswer: string,
  responseTimeSeconds?: number,
  bookContext?: string,
) {
  const combinedText = `${userMessage}\n${assistantAnswer}`;

  // 1) Self-verification
  const verification = await verifyAnswer(
    supabase,
    userId,
    userMessage,
    assistantAnswer,
    bookContext,
  );

  // 2) Concept targeting from knowledge graph
  const matchedConcepts = await extractRelevantConcepts(supabase, userId, subjectId, combinedText, 3);

  // 3) Adaptive performance/memory updates
  const baseScore = scoreFromVerification(verification);
  const performanceEvents: any[] = [];
  for (const concept of matchedConcepts) {
    const conceptScore = clamp(baseScore + Math.min(10, concept.match_score), 20, 100);
    const perf = await logPerformance(
      supabase,
      userId,
      concept.id,
      conceptScore,
      responseTimeSeconds,
    );

    performanceEvents.push({
      concept_id: concept.id,
      concept_name: concept.concept_name,
      score: conceptScore,
      ...perf,
    });

    await storeMemory(
      supabase,
      userId,
      'short_term',
      `chat_activity_${concept.id}_${Date.now()}`,
      {
        source: 'ai_tutor_chat',
        concept_id: concept.id,
        concept_name: concept.concept_name,
        user_message: userMessage.slice(0, 300),
        answer_confidence: verification?.confidence ?? null,
        verified_accurate: verification?.is_accurate ?? null,
        response_time_seconds: responseTimeSeconds ?? null,
      },
      subjectId,
    );
  }

  // 4) Structured chat-turn memory (short + optional promoted style memory)
  await storeMemory(
    supabase,
    userId,
    'short_term',
    `chat_turn_${Date.now()}`,
    {
      source: 'ai_tutor',
      user_message: userMessage.slice(0, 300),
      assistant_answer: assistantAnswer.slice(0, 1200),
      verification: {
        confidence: verification?.confidence ?? null,
        is_accurate: verification?.is_accurate ?? null,
        accuracy_label: verification?.accuracy_label ?? null,
      },
      matched_concepts: matchedConcepts.map((c: any) => ({ id: c.id, name: c.concept_name, match_score: c.match_score })),
      response_time_seconds: responseTimeSeconds ?? null,
    },
    subjectId,
  );

  // 5) Error pattern detection and storage
  // Detect repeated mistakes by checking recent struggles for matched concepts
  for (const concept of matchedConcepts) {
    const perf = performanceEvents.find((p: any) => p.concept_id === concept.id);
    if (perf && perf.is_weak && perf.new_mastery < 50) {
      const errorPatternKey = `error_pattern_${concept.id}`;
      
      // Check existing error pattern count
      const { data: existingPattern } = await supabase
        .from('adaptive_memory')
        .select('id, value')
        .eq('user_id', userId)
        .eq('key', errorPatternKey)
        .eq('memory_type', 'short_term')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const patternCount = (existingPattern?.value?.count ?? 0) + 1;
      const errorDetail = !verification?.is_accurate && verification?.corrected_answer
        ? `Confused: gave "${assistantAnswer.slice(0, 80)}" instead of correct understanding`
        : `Low score (${perf.new_mastery}%) on ${concept.concept_name}`;

      // Store or update error pattern
      const memoryType = patternCount >= 3 ? 'long_term' : 'short_term';
      await storeMemory(
        supabase,
        userId,
        memoryType,
        errorPatternKey,
        {
          concept_id: concept.id,
          concept_name: concept.concept_name,
          pattern: errorDetail,
          count: patternCount,
          last_mastery: perf.new_mastery,
          trend: perf.trend,
          detected_at: new Date().toISOString(),
        },
        subjectId,
      );

      // Promote to long-term if repeated 3+ times
      if (patternCount >= 3) {
        await promoteMemoryIfStable(supabase, userId, errorPatternKey);
      }
    }
  }

  // 6) Learning DNA System — comprehensive learning profile detection
  await updateLearningDNA(supabase, userId, subjectId, {
    userMessage,
    assistantAnswer,
    responseTimeSeconds,
    verification,
    matchedConcepts,
    performanceEvents,
  });

  // 5) Get updated intelligence state for next-turn adaptation
  const [profile, conceptMap] = await Promise.all([
    getStudentProfile(supabase, userId, subjectId),
    getConceptMap(supabase, userId, subjectId),
  ]);

  return {
    cycle_completed: true,
    verification,
    corrected_answer: verification?.is_accurate ? null : (verification?.corrected_answer || null),
    matched_concepts: matchedConcepts,
    performance_events: performanceEvents,
    adaptive_state: {
      recommended_difficulty: profile?.recommended_difficulty,
      recommended_label: profile?.recommended_difficulty_label,
      trend_summary: profile?.trend_summary || { improving: 0, declining: 0, stable: 0 },
      high_risk_concepts: profile?.intelligence_state?.weakness_risk_distribution || [],
      next_best_actions: profile?.intelligence_state?.next_best_actions || [],
      rewards: profile?.rewards || [],
      concept_graph_size: conceptMap?.total || 0,
      weak_nodes: conceptMap?.weak || 0,
    },
  };
}

// --- ACTION: process-learning-event -------------------------------------------
async function processLearningEvent(
  supabase: any,
  userId: string,
  subjectId: string,
  conceptId: string,
  score: number,
  timeSpent?: number,
  activityMetadata?: any,
) {
  const performance = await logPerformance(supabase, userId, conceptId, score, timeSpent);

  if (activityMetadata && typeof activityMetadata === 'object') {
    await storeMemory(
      supabase,
      userId,
      'short_term',
      `activity_${conceptId}`,
      {
        concept_id: conceptId,
        score,
        time_spent: timeSpent ?? null,
        ...activityMetadata,
      },
      subjectId
    );
  }

  const [profile, conceptMap] = await Promise.all([
    getStudentProfile(supabase, userId, subjectId),
    getConceptMap(supabase, userId, subjectId),
  ]);

  const highRiskConcepts = profile.intelligence_state?.weakness_risk_distribution || [];
  const weakest = highRiskConcepts[0];

  return {
    event_processed: true,
    performance,
    adaptive_decision: {
      recommended_difficulty: profile.recommended_difficulty,
      recommended_mode: performance.is_weak ? 'remediation' : 'progression',
      weakness_focus: weakest?.concept_name || null,
      reward_momentum: performance.reward_momentum,
    },
    profile_snapshot: {
      trend_summary: profile.trend_summary,
      next_best_actions: profile.intelligence_state?.next_best_actions || [],
      high_risk_concepts: highRiskConcepts.slice(0, 3),
    },
    graph_snapshot: {
      total_nodes: conceptMap.total,
      total_edges: conceptMap.edges?.length || 0,
      weak_nodes: conceptMap.weak,
    },
  };
}

// --- ACTION: build-knowledge-graph -------------------------------------------
async function buildKnowledgeGraph(
  supabase: any,
  userId: string,
  subjectId: string,
  chapterId: string,
  chapterText: string
) {
  const GOOGLE_AI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY');
  if (!GOOGLE_AI_API_KEY) throw new Error('GOOGLE_AI_API_KEY not configured');

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GOOGLE_AI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: `You are a textbook concept analyst specializing in identifying learning concepts and their prerequisite relationships from uploaded book content.

Extract all key concepts from the given chapter text. Return ONLY a valid JSON array with this exact shape:
[{
  "name": "string (concept name, preserve original language)",
  "difficulty": 1-10,
  "prerequisites": ["array of concept names from THIS list that must be known first"],
  "keywords": ["related terms"],
  "type": "foundational|procedural|conceptual|applied"
}]

Rules:
- Include 5-20 concepts depending on chapter depth
- difficulty 1-3 = basic, 4-6 = intermediate, 7-10 = advanced
- prerequisites must only reference concepts in the same array
- Preserve Bengali text as-is
- Return ONLY JSON, no markdown, no explanation`,
        },
        {
          role: 'user',
          content: `Extract concepts from this chapter text:\n\n${chapterText.slice(0, 8000)}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    console.error('AI concept extraction failed:', response.status);
    return { concepts_added: 0, error: 'AI extraction failed' };
  }

  const result = await response.json();
  const rawContent = result.choices?.[0]?.message?.content || '[]';

  let concepts: any[];
  try {
    const cleaned = rawContent.replace(/```(?:json)?\n?|\n?```/g, '').trim();
    concepts = JSON.parse(cleaned);
    if (!Array.isArray(concepts)) concepts = [];
  } catch {
    console.error('Failed to parse concepts JSON:', rawContent.slice(0, 200));
    return { concepts_added: 0, error: 'JSON parse failed' };
  }

  // Insert/update concepts and build ID map without duplication.
  const conceptMap: Record<string, string> = {};
  let insertedCount = 0;
  const { data: existingConcepts } = await supabase
    .from('concept_graph')
    .select('id, concept_name, metadata')
    .eq('user_id', userId)
    .eq('subject_id', subjectId)
    .eq('chapter_id', chapterId);

  const existingByName: Record<string, any> = {};
  for (const c of existingConcepts || []) {
    existingByName[String(c.concept_name).trim()] = c;
    conceptMap[String(c.concept_name).trim()] = c.id;
  }

  for (const c of concepts) {
    const conceptName = String(c.name || '').trim();
    if (!conceptName) continue;

    const normalizedDifficulty = Math.min(10, Math.max(1, parseInt(c.difficulty) || 5));
    const metadata = {
      keywords: Array.isArray(c.keywords) ? c.keywords : [],
      type: c.type || 'conceptual',
      prerequisites_raw: Array.isArray(c.prerequisites) ? c.prerequisites : [],
    };

    if (existingByName[conceptName]) {
      await supabase
        .from('concept_graph')
        .update({
          difficulty_level: normalizedDifficulty,
          metadata: {
            ...(existingByName[conceptName].metadata || {}),
            ...metadata,
          },
        })
        .eq('id', existingByName[conceptName].id);
      conceptMap[conceptName] = existingByName[conceptName].id;
      continue;
    }

    try {
      const { data: inserted } = await supabase
        .from('concept_graph')
        .insert({
          user_id: userId,
          subject_id: subjectId,
          concept_name: conceptName,
          chapter_id: chapterId,
          difficulty_level: normalizedDifficulty,
          metadata,
        })
        .select('id, concept_name')
        .single();

      if (inserted) {
        conceptMap[inserted.concept_name] = inserted.id;
        insertedCount += 1;
      }
    } catch (e) {
      console.error('Concept insert failed:', c.name, e);
    }
  }

  const dependencyEdges: Array<{ from: string; to: string }> = [];

  // Wire prerequisite relationships (fire sequentially to avoid races)
  for (const c of concepts) {
    const conceptId = conceptMap[c.name];
    if (!conceptId || !Array.isArray(c.prerequisites)) continue;

    const mappedPrereqIds = c.prerequisites
      .map((prereqName: string) => conceptMap[prereqName])
      .filter(Boolean);

    if (mappedPrereqIds.length === 0) continue;

    const primaryPrereqId = mappedPrereqIds[0];

    await supabase
      .from('concept_graph')
      .update({
        parent_concept_id: primaryPrereqId,
        metadata: {
          keywords: Array.isArray(c.keywords) ? c.keywords : [],
          type: c.type || 'conceptual',
          prerequisite_names: c.prerequisites,
          prerequisite_ids: mappedPrereqIds,
        },
      })
      .eq('id', conceptId);

    for (const prereqId of mappedPrereqIds) {
      dependencyEdges.push({ from: prereqId, to: conceptId });
    }
  }

  // ── Cross-chapter prerequisite linking ────────────────────────────────────
  // After building within-chapter graph, find matching concepts in OTHER chapters
  // and wire cross-chapter prerequisite edges automatically.
  let crossChapterEdges = 0;
  try {
    const { data: allSubjectConcepts } = await supabase
      .from('concept_graph')
      .select('id, concept_name, chapter_id, difficulty_level, metadata')
      .eq('user_id', userId)
      .eq('subject_id', subjectId)
      .neq('chapter_id', chapterId)
      .limit(500);

    if (allSubjectConcepts && allSubjectConcepts.length > 0) {
      // Build a lookup of concept names in other chapters
      const otherConceptsByName: Record<string, any[]> = {};
      for (const oc of allSubjectConcepts) {
        const name = String(oc.concept_name || '').toLowerCase().trim();
        if (!otherConceptsByName[name]) otherConceptsByName[name] = [];
        otherConceptsByName[name].push(oc);
      }

      // For each concept in THIS chapter, check if its prerequisites exist in other chapters
      for (const c of concepts) {
        const conceptId = conceptMap[c.name];
        if (!conceptId || !Array.isArray(c.prerequisites)) continue;

        for (const prereqName of c.prerequisites) {
          // Already linked within chapter?
          if (conceptMap[prereqName]) continue;

          // Search in other chapters by name match
          const lowerPrereq = String(prereqName).toLowerCase().trim();
          const matches = otherConceptsByName[lowerPrereq];
          if (matches && matches.length > 0) {
            // Link to the most foundational (lowest difficulty) match
            const bestMatch = matches.sort((a: any, b: any) => (a.difficulty_level || 5) - (b.difficulty_level || 5))[0];
            
            // Only link if not already linked
            const { data: currentConcept } = await supabase
              .from('concept_graph')
              .select('parent_concept_id, metadata')
              .eq('id', conceptId)
              .single();

            const existingPrereqIds: string[] = currentConcept?.metadata?.prerequisite_ids || [];
            if (!existingPrereqIds.includes(bestMatch.id) && currentConcept?.parent_concept_id !== bestMatch.id) {
              // If no parent yet, set as parent; otherwise add to prerequisite_ids
              const updates: any = {
                metadata: {
                  ...(currentConcept?.metadata || {}),
                  prerequisite_ids: [...existingPrereqIds, bestMatch.id],
                  cross_chapter_prereqs: [
                    ...((currentConcept?.metadata as any)?.cross_chapter_prereqs || []),
                    { id: bestMatch.id, name: bestMatch.concept_name, chapter_id: bestMatch.chapter_id },
                  ],
                },
              };
              if (!currentConcept?.parent_concept_id) {
                updates.parent_concept_id = bestMatch.id;
              }
              await supabase.from('concept_graph').update(updates).eq('id', conceptId);
              dependencyEdges.push({ from: bestMatch.id, to: conceptId });
              crossChapterEdges++;
            }
          }
        }
      }

      // Also check if OTHER chapters' concepts list THIS chapter's concepts as keywords
      // (reverse linking: if another chapter has a concept that matches a keyword here)
      for (const [thisName, thisId] of Object.entries(conceptMap)) {
        const lowerName = thisName.toLowerCase().trim();
        for (const oc of allSubjectConcepts) {
          const ocKeywords: string[] = (oc.metadata?.keywords || []).map((k: string) => String(k).toLowerCase().trim());
          if (ocKeywords.includes(lowerName) && oc.difficulty_level > 5) {
            // This concept is a keyword for a harder concept in another chapter — potential prereq
            const ocPrereqIds: string[] = oc.metadata?.prerequisite_ids || [];
            if (!ocPrereqIds.includes(thisId) && oc.parent_concept_id !== thisId) {
              await supabase.from('concept_graph').update({
                metadata: {
                  ...(oc.metadata || {}),
                  prerequisite_ids: [...ocPrereqIds, thisId],
                  cross_chapter_prereqs: [
                    ...((oc.metadata as any)?.cross_chapter_prereqs || []),
                    { id: thisId, name: thisName, chapter_id: chapterId },
                  ],
                },
              }).eq('id', oc.id);
              crossChapterEdges++;
            }
          }
        }
      }
    }
  } catch (e) {
    console.error('Cross-chapter linking failed (non-blocking):', e);
  }

  return {
    concepts_added: insertedCount,
    concept_names: Object.keys(conceptMap),
    dependency_edges: dependencyEdges,
    cross_chapter_edges: crossChapterEdges,
    dependency_density: Object.keys(conceptMap).length === 0
      ? 0
      : Number((dependencyEdges.length / Object.keys(conceptMap).length).toFixed(2)),
  };
}

// ─── ACTION: verify-answer ────────────────────────────────────────────────────
async function verifyAnswer(
  supabase: any,
  userId: string,
  question: string,
  generatedAnswer: string,
  bookContext?: string
) {
  const GOOGLE_AI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY');
  if (!GOOGLE_AI_API_KEY) throw new Error('GOOGLE_AI_API_KEY not configured');

  const hasBookContext = bookContext && bookContext.length > 100;

  const systemPrompt = `You are an educational fact-checker for Bengali students (Classes 1-10). 
Assess the accuracy of an AI-generated answer.
Return ONLY valid JSON:
{
  "confidence": 0-100,
  "is_accurate": boolean,
  "accuracy_label": "accurate|mostly_accurate|inaccurate|uncertain",
  "issues": ["list of factual errors if any"],
  "corrected_answer": "corrected version if needed, otherwise null",
  "explanation": "brief explanation of your assessment"
}`;

  const userPrompt = hasBookContext
    ? `Reference Book Content:\n${bookContext!.slice(0, 5000)}\n\nQuestion: ${question}\n\nGenerated Answer: ${generatedAnswer.slice(0, 3000)}\n\nVerify the answer against the book content.`
    : `Question: ${question}\n\nGenerated Answer: ${generatedAnswer.slice(0, 3000)}\n\nAssess factual accuracy for a student aged 10-16.`;

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GOOGLE_AI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  let verification: any = {
    confidence: 75,
    is_accurate: true,
    accuracy_label: 'uncertain',
    issues: [],
    corrected_answer: null,
    explanation: 'Verification unavailable',
  };

  if (response.ok) {
    const result = await response.json();
    const raw = result.choices?.[0]?.message?.content || '{}';
    try {
      const cleaned = raw.replace(/```(?:json)?\n?|\n?```/g, '').trim();
      verification = JSON.parse(cleaned);
    } catch {
      console.error('Verification parse failed');
    }
  }

  // Log verification asynchronously
  supabase.from('ai_verification_log').insert({
    user_id: userId,
    question: question.slice(0, 1000),
    generated_answer: generatedAnswer.slice(0, 5000),
    verification_result: verification,
  }).then(() => {}).catch(() => {});

  return verification;
}

// ─── ACTION: store-memory ─────────────────────────────────────────────────────
async function storeMemory(
  supabase: any,
  userId: string,
  memoryType: string,
  key: string,
  value: any,
  subjectId?: string
) {
  const expiresAt = memoryType === 'short_term'
    ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    : null;
  const structuredValue = buildStructuredMemoryValue({
    event: memoryType === 'short_term' ? 'short_term_signal' : 'long_term_fact',
    subjectId,
    confidence: memoryType === 'short_term' ? 0.7 : 0.9,
    details: { key, payload: value },
  });

  if (memoryType === 'long_term') {
    // Upsert long-term memories by key
    const { data: existing } = await supabase
      .from('adaptive_memory')
      .select('id')
      .eq('user_id', userId)
      .eq('memory_type', 'long_term')
      .eq('key', key)
      .single();

    if (existing) {
      await supabase
        .from('adaptive_memory')
        .update({ value: structuredValue, relevance_score: 1.0, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      return { stored: true, updated: true };
    }
  }

  await supabase.from('adaptive_memory').insert({
    user_id: userId,
    memory_type: memoryType,
    subject_id: subjectId || null,
    key,
    value: structuredValue,
    relevance_score: 1.0,
    expires_at: expiresAt,
  });

  return { stored: true, updated: false };
}

// ─── ACTION: get-concept-map ──────────────────────────────────────────────────
async function getConceptMap(supabase: any, userId: string, subjectId: string) {
  const { data: concepts } = await supabase
    .from('concept_graph')
    .select('*')
    .eq('user_id', userId)
    .eq('subject_id', subjectId)
    .order('difficulty_level', { ascending: true });

  const { data: mastery } = await supabase
    .from('concept_mastery')
    .select('concept_id, mastery_score, is_weak, streak, difficulty_calibration, last_scores')
    .eq('user_id', userId);

  const masteryMap: Record<string, any> = {};
  for (const m of mastery || []) {
    masteryMap[m.concept_id] = m;
  }

  const nodes = (concepts || []).map((c: any) => ({
    id: c.id,
    name: c.concept_name,
    difficulty: c.difficulty_level,
    parent_id: c.parent_concept_id,
    prerequisite_ids: c.metadata?.prerequisite_ids || (c.parent_concept_id ? [c.parent_concept_id] : []),
    mastery: masteryMap[c.id]?.mastery_score ?? null,
    is_weak: masteryMap[c.id]?.is_weak ?? false,
    streak: masteryMap[c.id]?.streak ?? 0,
    trend: detectTrend(masteryMap[c.id]?.last_scores || []),
    status: masteryMap[c.id]
      ? (masteryMap[c.id].mastery_score >= 80 ? 'mastered'
        : masteryMap[c.id].is_weak ? 'weak'
        : 'learning')
      : 'not_started',
    metadata: c.metadata,
  }));

  const edges = nodes.flatMap((n: any) => (n.prerequisite_ids || []).map((pid: string) => ({ from: pid, to: n.id })));

  return {
    nodes,
    edges,
    total: nodes.length,
    mastered: nodes.filter((n: any) => n.status === 'mastered').length,
    weak: nodes.filter((n: any) => n.status === 'weak').length,
    learning: nodes.filter((n: any) => n.status === 'learning').length,
    not_started: nodes.filter((n: any) => n.status === 'not_started').length,
  };
}

// ─── ACTION: generate-prep-content ───────────────────────────────────────────
async function generatePrepContent(
  supabase: any,
  userId: string,
  subjectId: string,
  chapterId: string | null,
  prepType: string,
  language: string
) {
  const GOOGLE_AI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY');
  if (!GOOGLE_AI_API_KEY) throw new Error('GOOGLE_AI_API_KEY not configured');

  const context = await fetchBookKnowledgeContext(
    supabase,
    userId,
    subjectId,
    chapterId,
    25,
  );
  const bookContent = context.content;

  if (!bookContent) {
    return { error: 'no_content', message: 'No OCR-ready book content found for this subject yet. Upload book pages first.' };
  }

  // Fetch student adaptive profile for personalization
  const profile = await getStudentProfile(supabase, userId, subjectId);

  const isBangla = language === 'bangla' || language === 'bn';
  const langInstruction = isBangla
    ? 'Respond primarily in Bengali (বাংলা). Use clear Bengali script.'
    : 'Respond in clear, simple English suitable for students aged 10-16.';

  const weakContext = profile.weak_concepts.length > 0
    ? `\nStudent's weak areas: ${profile.weak_concepts.slice(0, 3).map((w: any) => w.name).join(', ')}. Emphasize these.`
    : '';

  const prompts: Record<string, string> = {
    'notes': `Create comprehensive study notes from this content. ${langInstruction}
Structure: Key Concepts, Important Definitions, Key Points, Summary.
Make notes clear, organized, and easy to remember.${weakContext}

Content:\n${bookContent}`,

    'revise': `Create a quick revision guide. ${langInstruction}
Include: 5-7 KEY POINTS to remember, 3-5 quick quiz questions (with answers), a 2-3 sentence summary.
Format clearly with emojis and headers.${weakContext}

Content:\n${bookContent}`,

    'visualize': `Create visual learning aids. ${langInstruction}
Include: A concept diagram description, a mind map structure, important relationships between topics, memory tricks/mnemonics.
Use ASCII art or structured text to simulate diagrams.${weakContext}

Content:\n${bookContent}`,

    'fix-confusion': `Identify and clarify the most confusing concepts in this content. ${langInstruction}
For each confusing concept: explain WHY students get confused, give a SIMPLE explanation, use a REAL-WORLD analogy, provide an example.
Focus on: ${profile.weak_concepts.slice(0, 3).map((w: any) => w.name).join(', ') || 'the most complex topics'}.

Content:\n${bookContent}`,

    'abbreviations': `Extract all abbreviations, acronyms, formulas, and important terms from this content. ${langInstruction}
Format as a clear glossary with: Term → Full form/Meaning.
Include Bengali translations where applicable.

Content:\n${bookContent}`,

    'quick-boost': `Create 10 rapid-fire drill questions for speed revision. ${langInstruction}
Format: Question | Answer (1-2 words max per answer).
Focus on facts, dates, names, formulas — things to memorize.${weakContext}

Content:\n${bookContent}`,

    'discover': `Find 5 fascinating and surprising facts from this content. ${langInstruction}
Each fact should: be genuinely interesting, connect to real life, be easy to remember.
Make learning fun!

Content:\n${bookContent}`,

    'study-plan': `Create a 7-day study plan for this content. ${langInstruction}
Day-by-day breakdown with: topic focus, activities (read/practice/review), estimated time.
Adapt for a student with ${profile.recommended_difficulty_label} difficulty level.${weakContext}

Content:\n${bookContent}`,

    'ai-coach': `Write an encouraging motivational message for this student. ${langInstruction}
Consider: They have studied ${profile.daily_sessions_today} sessions today, ${profile.streak_days}-day streak.
Be warm, specific, and genuinely encouraging. Reference their actual progress.
Then give 3 specific study tips for their current topics.`,

    'confidence': `Design 5 confidence-building exercises. ${langInstruction}
Each exercise: starts EASY and gets gradually harder, celebrates small wins, builds towards mastery.
Focus on these areas where student needs support: ${profile.weak_concepts.slice(0, 3).map((w: any) => w.name).join(', ') || 'all topics'}.

Content:\n${bookContent}`,
  };

  const systemPrompt = prompts[prepType];
  if (!systemPrompt) {
    return { error: 'unknown_type', message: `Unknown prep type: ${prepType}` };
  }

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GOOGLE_AI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gemini-2.5-flash',
      messages: [
        { role: 'system', content: 'You are a brilliant, warm AI tutor. STRICT MODE: Use ONLY the uploaded book context provided by the user. Do not use outside curriculum or prior knowledge when creating prep output. If the context is insufficient, explicitly say which page/chapter is missing and ask the student to upload it. Keep explanations clear and encouraging.' },
        { role: 'user', content: systemPrompt },
      ],
      stream: false,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) return { error: 'rate_limit', message: 'Rate limit exceeded. Please try again.' };
    if (response.status === 402) return { error: 'credits', message: 'AI credits exhausted.' };
    return { error: 'ai_error', message: 'AI generation failed.' };
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content || '';

  // Self-verification pass for generated prep content
  const verification = await verifyAnswer(
    supabase,
    userId,
    `Evaluate educational quality for prep type: ${prepType}`,
    content,
    bookContent
  );

  const finalContent = verification?.is_accurate === false && verification?.corrected_answer
    ? verification.corrected_answer
    : content;

  // Log activity
  supabase.from('learning_activity').insert({
    user_id: userId,
    subject_id: subjectId,
    chapter_id: chapterId || null,
    activity_type: `prep_${prepType}`,
    duration_minutes: 5,
    metadata: { prep_type: prepType, language },
  }).then(() => {}).catch(() => {});

  return { content: finalContent, prep_type: prepType, verification };
}

// ─── ACTION: generate-exam-questions ─────────────────────────────────────────
async function generateExamQuestions(
  supabase: any,
  userId: string,
  subjectId: string,
  chapterId: string | null,
  examType: string,
  questionCount: number,
  language: string,
  questionTypes?: string[],
  questionTypeCounts?: Record<string, number>,
) {
  const GOOGLE_AI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY');
  if (!GOOGLE_AI_API_KEY) throw new Error('GOOGLE_AI_API_KEY not configured');

  const [context, profile] = await Promise.all([
    fetchBookKnowledgeContext(supabase, userId, subjectId, chapterId, 25),
    getStudentProfile(supabase, userId, subjectId),
  ]);

  const bookContent = context.content;

  if (!bookContent) {
    return { error: 'no_content', message: 'No OCR-ready book content found for this subject yet. Please upload book pages first.' };
  }

  // Adaptive difficulty
  const diffLabel = profile.recommended_difficulty_label || 'medium';
  const weakNames = profile.weak_concepts.slice(0, 5).map((w: any) => w.name).filter(Boolean);
  const isBangla = language === 'bangla' || language === 'bn';
  const langInstruction = isBangla
    ? 'Generate questions in Bengali (বাংলা). Options and explanations should also be in Bengali.'
    : 'Generate questions in clear English suitable for students aged 10-16.';

  const diffInstruction = diffLabel === 'easy'
    ? 'Make 60% easy, 30% medium, 10% hard questions.'
    : diffLabel === 'hard'
    ? 'Make 20% easy, 30% medium, 50% hard questions.'
    : 'Make 30% easy, 50% medium, 20% hard questions.';

  const weakInstruction = weakNames.length > 0
    ? `Include at least 2-3 questions specifically targeting these weak areas: ${weakNames.join(', ')}.`
    : '';

  const examTypeInstruction = examType === 'real-exam'
    ? 'This is a formal exam simulation. Questions should be exam-style, covering breadth of the content. Include some tricky distractors.'
    : examType === 'practice-exam'
    ? 'This is a practice session. Include helpful hints in explanations. Be encouraging.'
    : 'Generate varied questions covering the content comprehensively.';

  // Build question type instructions
  const activeTypes = questionTypes && questionTypes.length > 0 ? questionTypes : ['mcq'];
  const typeCounts = questionTypeCounts || {};
  
  const typeDescriptions: Record<string, string> = {
    'mcq': 'Multiple Choice Question (MCQ) — 4 options, one correct answer',
    'fill-in-the-blanks': 'Fill in the Blanks — a sentence with a blank (____) the student must fill. The correct_answer field should be 0, and options should contain [correct answer, distractor1, distractor2, distractor3]',
    'true-or-false': 'True or False — a statement that is either true or false. Options should be ["True", "False", "—", "—"] and correct_answer is 0 for True, 1 for False',
    'one-word': 'Answer in One Word — question requiring a single word answer. Options should contain [correct answer, distractor1, distractor2, distractor3]',
    'make-sentence': 'Make a Sentence — give a word/phrase and ask to make a sentence. Options should contain [best sentence, ok sentence, wrong sentence, another wrong]. correct_answer=0',
    'abbreviation': 'Abbreviation/Full Form — ask for full form of abbreviation or vice versa. Options should contain [correct full form, wrong1, wrong2, wrong3]',
  };

  let typeInstruction = 'Generate the following types of questions:\n';
  for (const t of activeTypes) {
    const count = typeCounts[t] || Math.ceil(questionCount / activeTypes.length);
    const desc = typeDescriptions[t] || t;
    typeInstruction += `- ${count}x ${desc}\n`;
  }
  typeInstruction += '\nFor EACH question, set the "question_type" field to the type identifier (e.g., "mcq", "fill-in-the-blanks", "true-or-false", "one-word", "make-sentence", "abbreviation").\n';

  const prompt = `Generate exactly ${questionCount} questions from the following textbook content.

${langInstruction}
${diffInstruction}
${weakInstruction}
${examTypeInstruction}

${typeInstruction}

Return ONLY a valid JSON array with this exact shape:
[{
  "question": "string (the question text)",
  "options": ["option A", "option B", "option C", "option D"],
  "correct_answer": 0-3 (index of correct option),
  "explanation": "string (why this answer is correct, educational)",
  "difficulty": "easy" | "medium" | "hard",
  "topic": "string (the concept/topic this tests)",
  "hint": "string (a subtle hint without giving away the answer)",
  "question_type": "string (mcq, fill-in-the-blanks, true-or-false, one-word, make-sentence, or abbreviation)"
}]

Rules:
- Use ONLY the provided book context as source
- If context is insufficient for a question, skip it
- Exactly 4 options per question (use "—" as placeholder for unused options in true/false)
- Only ONE correct answer
- Explanations should teach, not just state the answer
- Distractors should be plausible but clearly wrong
- Cover different topics from the content
- Preserve Bengali text as-is in questions

Content:
${bookContent}`;

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GOOGLE_AI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gemini-2.5-flash',
      messages: [
        { role: 'system', content: 'You are an expert exam question generator. STRICT MODE: create questions ONLY from the uploaded book context provided in the prompt. Do not use outside curriculum or prior knowledge. If context is missing, return an empty JSON array. Generate high-quality MCQs that test understanding, and return ONLY valid JSON arrays.' },
        { role: 'user', content: prompt },
      ],
      stream: false,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) return { error: 'rate_limit', message: 'Rate limit exceeded.' };
    if (response.status === 402) return { error: 'credits', message: 'AI credits exhausted.' };
    return { error: 'ai_error', message: 'Question generation failed.' };
  }

  const result = await response.json();
  const rawContent = result.choices?.[0]?.message?.content || '[]';

  let questions: any[];
  try {
    const cleaned = rawContent.replace(/```(?:json)?\n?|\n?```/g, '').trim();
    questions = JSON.parse(cleaned);
    if (!Array.isArray(questions)) questions = [];
  } catch {
    console.error('Failed to parse questions JSON:', rawContent.slice(0, 300));
    return { error: 'parse_error', message: 'Failed to parse generated questions.' };
  }

  // Validate and sanitize questions
  const validQuestions = questions
    .filter((q: any) =>
      q.question &&
      Array.isArray(q.options) &&
      q.options.length === 4 &&
      typeof q.correct_answer === 'number' &&
      q.correct_answer >= 0 &&
      q.correct_answer <= 3
    )
    .map((q: any, i: number) => ({
      id: `q-${i}`,
      question: String(q.question),
      options: q.options.map(String),
      correct_answer: q.correct_answer,
      explanation: String(q.explanation || ''),
      difficulty: ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : 'medium',
      topic: String(q.topic || 'General'),
      hint: String(q.hint || ''),
    }));

  // Log activity
  supabase.from('learning_activity').insert({
    user_id: userId,
    subject_id: subjectId,
    chapter_id: chapterId || null,
    activity_type: `exam_${examType}`,
    duration_minutes: 0,
    metadata: { exam_type: examType, question_count: validQuestions.length, language, difficulty: diffLabel },
  }).then(() => {}).catch(() => {});

  return {
    questions: validQuestions,
    exam_type: examType,
    difficulty_level: diffLabel,
    total: validQuestions.length,
    weak_areas_targeted: weakNames,
  };
}

// ─── ACTION: generate-exam-feedback ─────────────────────────────────────────
async function generateExamFeedback(
  supabase: any,
  userId: string,
  subjectId: string,
  examData: any,
  language: string
) {
  const GOOGLE_AI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY');
  if (!GOOGLE_AI_API_KEY) throw new Error('GOOGLE_AI_API_KEY not configured');

  const isBangla = language === 'bangla' || language === 'bn';
  const langInstruction = isBangla
    ? 'Respond in Bengali script. Be warm and encouraging.'
    : 'Respond in clear English. Be warm and encouraging.';

  const { totalQuestions, correctAnswers, timeTaken, mistakes, examType } = examData;
  const safeTotalQuestions = Math.max(1, Number(totalQuestions || 0));
  const safeCorrect = Math.max(0, Math.min(safeTotalQuestions, Number(correctAnswers || 0)));
  const percentage = Math.round((safeCorrect / safeTotalQuestions) * 100);

  const mistakesSummary = (mistakes || []).map((m: any) =>
    `Q: "${m.question}" -> Student chose: "${m.studentAnswer}" | Correct: "${m.correctAnswer}" | Topic: ${m.topic}`
  ).join('\n');

  const prompt = `Analyze this student's exam performance and provide personalized feedback.
${langInstruction}

Exam Results:
- Score: ${safeCorrect}/${safeTotalQuestions} (${percentage}%)
- Time taken: ${Math.round((Number(timeTaken || 0)) / 60)} minutes
- Exam type: ${examType}

Mistakes made:
${mistakesSummary || 'No mistakes! Perfect score!'}

Provide:
1. Overall Assessment - Warm, encouraging summary of performance
2. Strength Areas - Topics they got right consistently
3. Improvement Areas - Specific topics to work on (based on mistakes)
4. Study Tips - 3-5 actionable, specific tips based on their weak areas
5. Motivation - End with genuine encouragement

Be specific, not generic. Reference actual topics from their mistakes.`;

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GOOGLE_AI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gemini-2.5-flash',
      messages: [
        { role: 'system', content: 'You are Adomo AI - a warm, brilliant AI tutor for Bengali students. Give personalized, encouraging exam feedback.' },
        { role: 'user', content: prompt },
      ],
      stream: false,
    }),
  });

  const resultPayload = {
    feedback: 'Unable to generate feedback at this time. Keep practicing!',
    percentage,
    correctAnswers: safeCorrect,
    totalQuestions: safeTotalQuestions,
  } as any;

  if (response.ok) {
    const result = await response.json();
    resultPayload.feedback = result.choices?.[0]?.message?.content || resultPayload.feedback;
  }

  // Closed-loop intelligence updates from exam signals
  const mistakeTopics = Array.isArray(mistakes)
    ? mistakes.map((m: any) => String(m.topic || '').trim()).filter(Boolean)
    : [];

  const examSignals: any[] = [];
  const uniqueTopics = Array.from(new Set(mistakeTopics)).slice(0, 8);

  for (const topic of uniqueTopics) {
    const matched = await extractRelevantConcepts(supabase, userId, subjectId, topic, 1);
    if (matched.length === 0) continue;

    const mappedConcept = matched[0];
    const perf = await logPerformance(
      supabase,
      userId,
      mappedConcept.id,
      clamp(35 + Math.round(percentage * 0.2), 20, 60),
      Number(timeTaken || 0) / safeTotalQuestions,
    );

    examSignals.push({
      topic,
      concept_id: mappedConcept.id,
      concept_name: mappedConcept.concept_name,
      performance: perf,
    });
  }

  await storeMemory(
    supabase,
    userId,
    'short_term',
    `exam_session_${Date.now()}`,
    {
      source: 'exam_feedback',
      exam_type: examType,
      percentage,
      total_questions: safeTotalQuestions,
      correct_answers: safeCorrect,
      mistake_topics: uniqueTopics,
      concept_updates: examSignals.map((s: any) => ({ concept_id: s.concept_id, concept_name: s.concept_name })),
    },
    subjectId,
  );

  const [profile, conceptMap] = await Promise.all([
    getStudentProfile(supabase, userId, subjectId),
    getConceptMap(supabase, userId, subjectId),
  ]);

  return {
    ...resultPayload,
    adaptive_summary: {
      recommended_difficulty: profile?.recommended_difficulty,
      recommended_label: profile?.recommended_difficulty_label,
      weak_concepts: profile?.weak_concepts?.slice(0, 5) || [],
      prerequisite_gaps: profile?.prerequisite_gaps?.slice(0, 5) || [],
      trend_summary: profile?.trend_summary || { improving: 0, declining: 0, stable: 0 },
      rewards: profile?.rewards || [],
      graph_nodes: conceptMap?.total || 0,
      graph_weak_nodes: conceptMap?.weak || 0,
      exam_signal_updates: examSignals,
    },
  };
}
async function getImplementationPlan(supabase: any, userId: string, subjectId: string) {
  const profile = await getStudentProfile(supabase, userId, subjectId);
  const conceptMap = await getConceptMap(supabase, userId, subjectId);

  const priorityWeaknesses = (profile.intelligence_state?.weakness_risk_distribution || []).slice(0, 5);

  return {
    objective: 'Operate a single closed-loop adaptive tutor system where every interaction updates knowledge graph, memory, mastery, difficulty, trend, and rewards.',
    architecture: {
      core_cycle: [
        'Input capture (chat/exam/prep event)',
        'Knowledge graph concept matching',
        'Self-verification scoring',
        'Mastery + weakness + trend update',
        'Difficulty calibration adjustment',
        'Structured memory write (short/long-term)',
        'Reward/prerequisite-aware adaptation output',
      ],
      integration_points: {
        chat: 'run-intelligence-cycle',
        exam_feedback: 'generate-exam-feedback (with concept-linked updates)',
        prep_generation: 'generate-prep-content (verification-backed)',
      },
    },
    implementation_plan: [
      {
        phase: 'Phase 1 - Data and graph reliability',
        tasks: [
          'Continuously build and refresh concept graph from OCR uploads',
          'Store prerequisite_ids in concept metadata and expose edges in concept map',
          'Add graph match scoring fallback (keywords + token overlap)',
        ],
      },
      {
        phase: 'Phase 2 - Closed-loop intelligence',
        tasks: [
          'Use run-intelligence-cycle for tutor responses (verify -> match concepts -> log mastery -> memory writes)',
          'Map exam mistake topics to concepts and update mastery/weakness automatically',
          'Auto-store style and session memory in structured schema',
        ],
      },
      {
        phase: 'Phase 3 - Adaptive control',
        tasks: [
          'Drive recommended difficulty from calibration + trend momentum',
          'Prioritize prerequisite gaps and high-risk weak concepts in next actions',
          'Attach reward momentum and streak rewards to guidance output',
        ],
      },
      {
        phase: 'Phase 4 - Scale hardening',
        tasks: [
          'Batch expensive recomputations through async jobs for large users',
          'Cache profile snapshots for short TTL per user/subject',
          'Add observability for verification confidence and correction rates',
        ],
      },
    ],
    current_system_snapshot: {
      total_concepts: conceptMap.total,
      weak_concepts: profile.critical_weak_count,
      trend_declining: profile.trend_summary?.declining || 0,
      recommended_difficulty: profile.recommended_difficulty,
      high_risk_concepts: priorityWeaknesses,
      next_best_actions: profile.intelligence_state?.next_best_actions || [],
      rewards: profile.rewards || [],
    },
  };
}
// ─── ACTION: get-book-summary ──────────────────────────────────────────────────
async function getBookSummary(supabase: any, userId: string, subjectId: string) {
  const { data: pages } = await supabase
    .from('book_pages')
    .select('id, chapter_name, chapter_id, page_number, ocr_status, extracted_text, structured_content, created_at')
    .eq('user_id', userId)
    .eq('subject_id', subjectId)
    .eq('is_archived', false)
    .order('page_number', { ascending: true });

  if (!pages || pages.length === 0) {
    return { has_book: false, total_pages: 0, chapters: [] };
  }

  const completed = pages.filter((p: any) => p.ocr_status === 'completed');
  const pending = pages.filter((p: any) => p.ocr_status === 'pending' || p.ocr_status === 'processing');
  const failed = pages.filter((p: any) => p.ocr_status === 'failed');

  // Group by chapter
  const chapterMap = new Map<string, any>();
  for (const page of pages) {
    const chKey = page.chapter_id || page.chapter_name || 'uncategorized';
    if (!chapterMap.has(chKey)) {
      chapterMap.set(chKey, {
        chapter_id: page.chapter_id,
        chapter_name: page.chapter_name || 'General',
        pages: [],
        topics: new Set<string>(),
        total_text_length: 0,
        diagram_count: 0,
      });
    }
    const ch = chapterMap.get(chKey)!;
    ch.pages.push({
      page_number: page.page_number,
      ocr_status: page.ocr_status,
      has_text: Boolean(page.extracted_text),
    });
    ch.total_text_length += String(page.extracted_text || '').length;

    const struct = page.structured_content;
    if (struct) {
      for (const h of (struct.headings || [])) ch.topics.add(h);
      for (const h of (struct.subheadings || [])) ch.topics.add(h);
      ch.diagram_count += Array.isArray(struct.diagrams) ? struct.diagrams.length : 0;
    }
  }

  const chapters = Array.from(chapterMap.values()).map((ch) => ({
    ...ch,
    topics: Array.from(ch.topics).slice(0, 15),
    page_range: ch.pages.length > 0
      ? { min: Math.min(...ch.pages.map((p: any) => p.page_number || 999)), max: Math.max(...ch.pages.map((p: any) => p.page_number || 0)) }
      : null,
    page_count: ch.pages.length,
    completed_count: ch.pages.filter((p: any) => p.ocr_status === 'completed').length,
  }));

  return {
    has_book: completed.length > 0,
    total_pages: pages.length,
    completed_pages: completed.length,
    pending_pages: pending.length,
    failed_pages: failed.length,
    chapters,
    subject_id: subjectId,
  };
}

// ─── ACTION: get-learning-path ────────────────────────────────────────────────
async function getLearningPath(supabase: any, userId: string, subjectId: string) {
  const conceptMap = await getConceptMap(supabase, userId, subjectId);
  const nodes = conceptMap.nodes || [];

  if (nodes.length === 0) {
    return { path: [], total_concepts: 0, next_topic: null, completion_percentage: 0 };
  }

  // Build adjacency: parent_id and prerequisite_ids → edges
  const childrenOf: Record<string, string[]> = {};
  const inDegree: Record<string, number> = {};
  const nodeById: Record<string, any> = {};

  for (const n of nodes) {
    nodeById[n.id] = n;
    inDegree[n.id] = 0;
    childrenOf[n.id] = [];
  }

  for (const n of nodes) {
    const prereqs = n.prerequisite_ids || (n.parent_id ? [n.parent_id] : []);
    for (const pid of prereqs) {
      if (nodeById[pid]) {
        if (!childrenOf[pid]) childrenOf[pid] = [];
        childrenOf[pid].push(n.id);
        inDegree[n.id] = (inDegree[n.id] || 0) + 1;
      }
    }
  }

  // Topological sort (Kahn's algorithm) to determine learning order
  const queue: string[] = [];
  for (const n of nodes) {
    if ((inDegree[n.id] || 0) === 0) queue.push(n.id);
  }

  // Sort roots by difficulty
  queue.sort((a, b) => (nodeById[a]?.difficulty || 5) - (nodeById[b]?.difficulty || 5));

  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);
    for (const child of (childrenOf[current] || [])) {
      inDegree[child]--;
      if (inDegree[child] === 0) queue.push(child);
    }
  }

  // Add any remaining nodes (cycles)
  for (const n of nodes) {
    if (!sorted.includes(n.id)) sorted.push(n.id);
  }

  // Build learning path with status
  const path = sorted.map((id, index) => {
    const node = nodeById[id];
    const prereqs = (node.prerequisite_ids || (node.parent_id ? [node.parent_id] : []))
      .filter((pid: string) => nodeById[pid])
      .map((pid: string) => ({
        id: pid,
        name: nodeById[pid]?.name,
        mastery: nodeById[pid]?.mastery,
        status: nodeById[pid]?.status,
      }));

    const prereqsMastered = prereqs.length === 0 || prereqs.every((p: any) => p.mastery !== null && p.mastery >= 60);
    const isReady = prereqsMastered && node.status !== 'mastered';
    const isBlocked = !prereqsMastered && node.status !== 'mastered';

    return {
      order: index + 1,
      id: node.id,
      name: node.name,
      difficulty: node.difficulty,
      mastery: node.mastery,
      status: node.status,
      trend: node.trend,
      is_weak: node.is_weak,
      is_ready: isReady,
      is_blocked: isBlocked,
      prerequisites: prereqs,
      blocked_by: isBlocked
        ? prereqs.filter((p: any) => p.mastery === null || p.mastery < 60).map((p: any) => p.name)
        : [],
    };
  });

  // Find the next recommended topic: first "ready" + not mastered, preferring weak ones
  const readyTopics = path.filter(p => p.is_ready);
  const nextTopic = readyTopics.find(p => p.is_weak) || readyTopics[0] || null;

  const masteredCount = path.filter(p => p.status === 'mastered').length;

  return {
    path,
    total_concepts: path.length,
    mastered_count: masteredCount,
    completion_percentage: path.length > 0 ? Math.round((masteredCount / path.length) * 100) : 0,
    next_topic: nextTopic ? {
      id: nextTopic.id,
      name: nextTopic.name,
      difficulty: nextTopic.difficulty,
      mastery: nextTopic.mastery,
      is_weak: nextTopic.is_weak,
      blocked_by: nextTopic.blocked_by,
    } : null,
    ready_count: readyTopics.length,
    blocked_count: path.filter(p => p.is_blocked).length,
  };
}

// ─── MAIN HANDLER ──────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createSupabaseClient(authHeader);
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);

    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = claimsData.claims.sub as string;
    const body = await req.json();
    const {
      action,
      subject_id,
      chapter_id,
      concept_id,
      score,
      time_spent,
      chapter_text,
      question,
      generated_answer,
      book_context,
      memory_type,
      memory_key,
      memory_value,
      prep_type,
      language,
      activity_metadata,
      user_message,
      assistant_answer,
      response_time_seconds,
    } = body;

    let result: any;

    switch (action) {
      case 'get-student-profile':
        result = await getStudentProfile(supabase, userId, subject_id);
        break;

      case 'log-performance': {
        let resolvedConceptId = concept_id;
        // Support topic name lookup: if concept_id looks like a name (not UUID), resolve it
        if (concept_id && !/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(concept_id)) {
          const { data: matched } = await supabase
            .from('concept_graph')
            .select('id')
            .eq('user_id', userId)
            .ilike('concept_name', `%${concept_id}%`)
            .limit(1)
            .single();
          if (matched) {
            resolvedConceptId = matched.id;
          } else {
            // No matching concept found — skip silently
            result = { updated: false, reason: 'concept_not_found', topic: concept_id };
            break;
          }
        }
        result = await logPerformance(supabase, userId, resolvedConceptId, score, time_spent);
        break;
      }

      case 'process-learning-event':
        result = await processLearningEvent(
          supabase,
          userId,
          subject_id,
          concept_id,
          score,
          time_spent,
          activity_metadata,
        );
        break;

      case 'build-knowledge-graph':
        result = await buildKnowledgeGraph(supabase, userId, subject_id, chapter_id, chapter_text);
        break;

      case 'verify-answer':
        result = await verifyAnswer(supabase, userId, question, generated_answer, book_context);
        break;

      case 'store-memory':
        result = await storeMemory(supabase, userId, memory_type, memory_key, memory_value, subject_id);
        break;

      case 'get-concept-map':
        result = await getConceptMap(supabase, userId, subject_id);
        break;

      case 'generate-prep-content':
        result = await generatePrepContent(supabase, userId, subject_id, chapter_id || null, prep_type, language || 'english');
        break;

      case 'generate-exam-questions':
        result = await generateExamQuestions(
          supabase, userId, subject_id, chapter_id || null,
          body.exam_type || 'practice-exam',
          body.question_count || 10,
          language || 'english',
          body.question_types,
          body.question_type_counts,
        );
        break;

      case 'generate-exam-feedback':
        result = await generateExamFeedback(
          supabase, userId, subject_id,
          body.exam_data || {},
          language || 'english'
        );
        break;

      case 'run-intelligence-cycle':
        result = await runIntelligenceCycle(
          supabase,
          userId,
          subject_id,
          user_message || '',
          assistant_answer || '',
          response_time_seconds,
          book_context,
        );
        break;
      case 'get-book-summary':
        result = await getBookSummary(supabase, userId, subject_id);
        break;

      case 'get-learning-path':
        result = await getLearningPath(supabase, userId, subject_id);
        break;

      case 'get-implementation-plan':
        result = await getImplementationPlan(supabase, userId, subject_id);
        break;

      case 'get-learning-dna': {
        const { data: dnaMem } = await supabase
          .from('adaptive_memory')
          .select('value')
          .eq('user_id', userId)
          .eq('key', 'learning_dna')
          .eq('memory_type', 'long_term')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        result = computeLearningDNAProfile(dnaMem?.value || null) || { type: 'Not enough data', total_interactions: 0 };
        break;
      }

      case 'generate-chat-title': {
        const { user_message } = reqBody;
        if (!user_message) throw new Error('user_message is required');
        
        const prompt = `Generate a very short, concise, and catchy title (maximum 3 to 4 words) for a chat conversation that begins with the following message. If the message is in Bengali, the title MUST be in Bengali. If English, in English. Do not use quotes or punctuation at the end.
        
User Message: "${user_message}"
Title:`;

        const GOOGLE_AI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY');
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GOOGLE_AI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gemini-2.5-flash',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 15,
          }),
        });

        if (!response.ok) throw new Error('Failed to generate title');
        const data = await response.json();
        const title = data.choices?.[0]?.message?.content?.trim().replace(/^["']|["']$/g, '') || 'New Chat';
        
        result = { title };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Learning engine error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});




