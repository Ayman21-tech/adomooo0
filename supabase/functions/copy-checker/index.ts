import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { answer_key_text, answer_key_image_url, student_copy_urls, marks_per_mistake, language } = await req.json();
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");

    const results: any[] = [];

    for (const copyUrl of (student_copy_urls || [])) {
      const messages: any[] = [
        {
          role: "system",
          content: `You are a strict copy-checking AI. You check student answer copies against a correct answer key.

RULES:
- Extract the student's name and roll number from the copy image
- Compare the student's answer with the correct answer
- List ONLY the mistakes found
- Generate a corrected version of the student's answer
- NO explanations, NO feedback, NO encouragement
- ONLY correction, exactly like real copy checking
- Language: ${language === 'bangla' ? 'Bengali' : 'English'}
- Marks per mistake: ${marks_per_mistake}

You MUST respond using the suggest_results tool.`
        }
      ];

      // Build user message with images/text
      const userContent: any[] = [];
      
      if (answer_key_text) {
        userContent.push({ type: "text", text: `CORRECT ANSWER KEY:\n${answer_key_text}` });
      }
      if (answer_key_image_url) {
        userContent.push({ type: "text", text: "CORRECT ANSWER KEY (image):" });
        userContent.push({ type: "image_url", image_url: { url: answer_key_image_url } });
      }
      
      userContent.push({ type: "text", text: "STUDENT COPY (check this against the answer key):" });
      userContent.push({ type: "image_url", image_url: { url: copyUrl } });

      messages.push({ role: "user", content: userContent });

      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GOOGLE_AI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gemini-2.5-flash",
          messages,
          tools: [{
            type: "function",
            function: {
              name: "suggest_results",
              description: "Return the copy checking results",
              parameters: {
                type: "object",
                properties: {
                  student_name: { type: "string", description: "Student name from the copy" },
                  roll_number: { type: "string", description: "Roll number from the copy" },
                  mistakes: { type: "array", items: { type: "string" }, description: "List of mistakes found" },
                  corrected_answer: { type: "string", description: "Full corrected version of the answer" },
                  marks_deducted: { type: "number", description: "Total marks deducted" },
                },
                required: ["student_name", "roll_number", "mistakes", "corrected_answer", "marks_deducted"],
                additionalProperties: false,
              }
            }
          }],
          tool_choice: { type: "function", function: { name: "suggest_results" } },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("AI error:", response.status, errText);
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded, try again later." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Payment required, add credits." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        continue;
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        try {
          const parsed = JSON.parse(toolCall.function.arguments);
          results.push(parsed);
        } catch {
          console.error("Failed to parse tool call arguments");
        }
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("copy-checker error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
