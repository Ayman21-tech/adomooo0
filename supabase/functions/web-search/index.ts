import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const query = String(body?.query || '').trim();
    const maxResults = Math.max(1, Math.min(8, Number(body?.max_results || 5)));

    if (!query) {
      return new Response(JSON.stringify({ error: 'Missing query' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const GOOGLE_AI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY');
    
    if (GOOGLE_AI_API_KEY) {
      // Use Google Gemini with grounding for high-quality web search
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_AI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [{ text: `Search the web for: "${query}"\n\nProvide ${maxResults} relevant results with title, a brief summary snippet, and source URL for each. Format as a factual, educational summary suitable for a student.` }]
              }],
              tools: [{ google_search: {} }],
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const groundingMetadata = data.candidates?.[0]?.groundingMetadata;
          
          // Extract search results from grounding metadata
          const results: Array<{ title: string; snippet: string; url: string; source: string }> = [];
          
          if (groundingMetadata?.groundingChunks) {
            for (const chunk of groundingMetadata.groundingChunks.slice(0, maxResults)) {
              if (chunk.web) {
                results.push({
                  title: chunk.web.title || 'Web Result',
                  snippet: '',
                  url: chunk.web.uri || '',
                  source: 'Google Search',
                });
              }
            }
          }

          // If we got grounding results, use them; otherwise parse the text
          if (results.length > 0 || content) {
            return new Response(JSON.stringify({
              query,
              provider: 'google-grounded',
              result_count: results.length,
              results,
              summary: content,
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
      } catch (e) {
        console.error('Google grounded search failed, falling back to DuckDuckGo:', e);
      }
    }

    // Fallback: DuckDuckGo Instant Answers API
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(ddgUrl, {
      headers: { 'User-Agent': 'Adomo-AI/1.0' },
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'Search provider unavailable' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const json = await res.json();
    const results: Array<{ title: string; snippet: string; url: string; source: string }> = [];

    if (json?.Heading && json?.AbstractText && json?.AbstractURL) {
      results.push({
        title: String(json.Heading),
        snippet: String(json.AbstractText),
        url: String(json.AbstractURL),
        source: 'DuckDuckGo Instant Answer',
      });
    }

    const walkRelated = (items: any[]) => {
      for (const item of items || []) {
        if (results.length >= maxResults) break;
        if (Array.isArray(item?.Topics)) { walkRelated(item.Topics); continue; }
        const text = String(item?.Text || '').trim();
        const url = String(item?.FirstURL || '').trim();
        if (!text || !url) continue;
        results.push({
          title: text.split(' - ')[0]?.slice(0, 120) || 'Result',
          snippet: text.slice(0, 300),
          url,
          source: 'DuckDuckGo',
        });
      }
    };

    walkRelated(json?.RelatedTopics || []);

    return new Response(JSON.stringify({
      query,
      provider: 'duckduckgo',
      result_count: results.length,
      results: results.slice(0, maxResults),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
