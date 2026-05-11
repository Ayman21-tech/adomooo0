import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Simple in-memory rate limiting (resets on function cold start)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 3; // 3 reports per hour
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);
  
  if (!userLimit || now > userLimit.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  
  if (userLimit.count >= RATE_LIMIT) {
    return false;
  }
  
  userLimit.count++;
  return true;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, email, classLevel, school, problem, userId } = await req.json();

    // Validate required fields
    if (!name || !email || !problem) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: name, email, and problem are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting check
    const limitKey = userId || email;
    if (!checkRateLimit(limitKey)) {
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded. You can only send 3 reports per hour. Please try again later.',
          retryAfter: 'Try again in about an hour'
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format the report
    const reportContent = `
=== ADOMO AI - USER REPORT ===
Date: ${new Date().toISOString()}

--- USER DETAILS ---
Name: ${name}
Email: ${email}
Class: ${classLevel || 'Not provided'}
School: ${school || 'Not provided'}

--- PROBLEM/FEEDBACK ---
${problem}

=== END OF REPORT ===
    `.trim();

    // For now, we'll log the report (in production, you'd send via email service)
    console.log('Report received:', reportContent);

    // Check if we have Resend API key for actual email sending
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    
    if (RESEND_API_KEY) {
      // Send email via Resend
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Adomo AI <noreply@adomo-ai.com>',
          to: ['Rahmatullahkhanayman@gmail.com'],
          subject: `[Report] From ${name} - Adomo AI`,
          text: reportContent,
        }),
      });

      if (!emailResponse.ok) {
        const errorData = await emailResponse.text();
        console.error('Resend error:', errorData);
        // Don't fail - just log and continue with fallback
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Report submitted successfully! Thank you for your feedback.' 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Report submission error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to submit report' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
