import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Returns a JSON weekly summary for the authenticated student (SQL-backed, no LLM).
 * Intended for in-app “digest” UI or future email/WhatsApp templates.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(supabaseUrl, anon, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const iso = weekAgo.toISOString();

    const { count: activityCount } = await supabase
      .from("learning_activity")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", iso);

    const { data: masteryRows } = await supabase
      .from("subject_mastery")
      .select("mastery_score, subject_id")
      .eq("user_id", user.id);

    const scores = (masteryRows || [])
      .map((m) => m.mastery_score)
      .filter((s): s is number => typeof s === "number" && !Number.isNaN(s));
    const avgMastery = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;
    const weakSlots = (masteryRows || []).filter(
      (m) => typeof m.mastery_score === "number" && m.mastery_score < 40,
    ).length;

    const { count: examCount } = await supabase
      .from("exam_results")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", iso);

    const summary = {
      period_days: 7,
      activity_sessions: activityCount ?? 0,
      avg_subject_mastery: avgMastery,
      weak_chapter_rows: weakSlots,
      exams_completed_7d: examCount ?? 0,
      suggested_actions: [
        weakSlots > 0
          ? "Focus one weak chapter in Prep this week."
          : "Maintain momentum with one review session.",
        (activityCount ?? 0) < 3
          ? "Aim for at least three short study sessions this week."
          : "Strong activity — tackle a harder topic next.",
        "Keep textbook pages uploaded so vector search matches your class book.",
      ],
    };

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("weekly-learning-digest", e);
    return new Response(JSON.stringify({ error: "Digest failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
