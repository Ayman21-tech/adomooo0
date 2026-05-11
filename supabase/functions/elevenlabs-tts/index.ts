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
    const { text, voiceId, language, speed } = await req.json();
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    
    if (!ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY is not configured');
    }

    if (!text) {
      throw new Error('Text is required');
    }

    // Detect if text contains Bengali characters
    const hasBengali = /[\u0980-\u09FF]/.test(text);
    // Accept ISO codes (bn, en, hi, …) as well as legacy 'bangla'/'english'
    const langStr = String(language || '').toLowerCase();
    const isBangla = hasBengali
      || langStr === 'bangla'
      || langStr === 'bn'
      || langStr === 'bn-bd'
      || langStr.startsWith('bn');

    // eleven_multilingual_v2 has the best Bengali/Bangla support
    const modelId = 'eleven_multilingual_v2';

    // Voice selection: Always use "Raju" (eyVoIoi3vo6sJoHOKgAc)
    // Natural and warm voice — works great in both English and Bangla
    const selectedVoiceId = voiceId || 'eyVoIoi3vo6sJoHOKgAc';

    // For Bangla: tuned for natural, clear Bengali pronunciation
    // Lower stability allows more natural intonation; higher similarity preserves voice character
    const normalizedSpeed = Math.max(0.75, Math.min(1.25, Number(speed) || 1.0));

    const voiceSettings = isBangla
      ? { stability: 0.55, similarity_boost: 0.85, style: 0.15, use_speaker_boost: true, speed: normalizedSpeed }
      : { stability: 0.65, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true, speed: normalizedSpeed };

    console.log(`TTS Request - Language: ${language}, Has Bengali: ${hasBengali}, Using Bangla mode: ${isBangla}, Voice: ${selectedVoiceId}, Speed: ${normalizedSpeed}`);

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          voice_settings: voiceSettings,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs TTS error:', response.status, errorText);
      throw new Error(`TTS failed: ${response.status}`);
    }

    const audioBuffer = await response.arrayBuffer();

    return new Response(audioBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
      },
    });
  } catch (error) {
    console.error('TTS error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
