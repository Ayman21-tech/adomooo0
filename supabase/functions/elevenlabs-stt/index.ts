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
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    const language = formData.get('language') as string | null;
    
    if (!audioFile) {
      throw new Error('Audio file is required');
    }

    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    
    if (!ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY is not configured');
    }

    const apiFormData = new FormData();
    apiFormData.append('file', audioFile);
    apiFormData.append('model_id', 'scribe_v2');

    // Map ISO 639-1/legacy codes to ElevenLabs ISO 639-3 codes.
    // If language is unknown/missing, omit language_code → auto-detect.
    const langStr = String(language || '').toLowerCase();
    const ISO_MAP: Record<string, string> = {
      bangla: 'ben', bn: 'ben', 'bn-bd': 'ben', ben: 'ben',
      english: 'eng', en: 'eng', 'en-us': 'eng', 'en-gb': 'eng', eng: 'eng',
      hi: 'hin', hin: 'hin',
      es: 'spa', spa: 'spa', spanish: 'spa',
      fr: 'fra', fra: 'fra', french: 'fra',
      ar: 'ara', ara: 'ara', arabic: 'ara',
      zh: 'zho', zho: 'zho', chinese: 'zho',
      ja: 'jpn', jpn: 'jpn', japanese: 'jpn',
      ko: 'kor', kor: 'kor', korean: 'kor',
      pt: 'por', por: 'por', portuguese: 'por',
      de: 'deu', deu: 'deu', german: 'deu',
      tr: 'tur', tur: 'tur', turkish: 'tur',
      id: 'ind', ind: 'ind',
      ur: 'urd', urd: 'urd', urdu: 'urd',
      th: 'tha', tha: 'tha', thai: 'tha',
      ru: 'rus', rus: 'rus', russian: 'rus',
      it: 'ita', ita: 'ita', italian: 'ita',
    };
    const mapped = ISO_MAP[langStr];
    if (mapped) {
      apiFormData.append('language_code', mapped);
    }
    // else: let ElevenLabs auto-detect language

    const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: apiFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs STT error:', response.status, errorText);
      throw new Error(`STT failed: ${response.status}`);
    }

    const transcription = await response.json();

    return new Response(JSON.stringify(transcription), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('STT error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
