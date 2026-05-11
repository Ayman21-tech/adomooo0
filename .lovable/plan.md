## Plan: Fix AI behavior, voice, sign-in, home, and remaining errors

### 1. AI: Work without books, but heavily encourage uploading

In `supabase/functions/ai-tutor/index.ts`:
- Remove the strict "ONLY teach from uploaded book" framing from the BASE_PROMPT (currently it forbids using outside knowledge — that's why answers feel wrong/limited).
- Replace it with a "book-preferred" mode:
  - If book content exists → use it as the **primary** source, cite chapter/page.
  - If no book content → answer freely from general knowledge using the student's class level and language, **but** prepend a friendly nudge in the very first reply of the session and add a soft 1-line reminder once every ~5 turns: "📚 Tip: Upload your textbook page in the Books tab so I can teach from your exact syllabus."
- Switch model default from `gemini-2.5-flash` to `google/gemini-2.5-flash` via the official endpoint already in use, but also fallback to `gemini-2.5-pro` if the flash request returns 5xx (improves reliability and accuracy — addresses "sometimes wrong details").
- Honor `preferred_language` (ISO code) sent from client, not just english/bangla. Translate the language hint into a natural-language directive ("Respond in {language name}").
- Pass `preferred_language` from `useAIChat` → `lessonContext` (currently only `default_language` is sent).

### 2. Voice features (record + read aloud) — make them work

Root causes:
- **TTS playback** sometimes fails because `audio.play()` is called *after* an `await` (network fetch + blob), losing the user-gesture context in some browsers (especially Safari/iOS and strict autoplay policies).
- **STT** sometimes silently does nothing because the recorder permissions error path is unclear, and the language code passed (`'en'` / ISO codes from new picker) isn't mapped to ElevenLabs language codes.

Fixes:
- `src/components/subject/AIChatPanel.tsx` (`speakText`):
  - Pre-create a silent `<audio>` element synchronously inside the click handler, attach it to `audioRef`, then set `audio.src` after the fetch and call `play()` — same pattern that survives gesture loss. Also prime an `AudioContext.resume()` on first user interaction.
  - On `audio.play()` rejection, surface a clear "Click again to allow audio" toast instead of generic failure.
- `supabase/functions/elevenlabs-tts/index.ts`:
  - Accept ISO codes (`bn`, `en`, `hi`, `es`, `fr`, …) and map: Bengali script detection still wins; otherwise default to multilingual voice (Sarah) for any non-Bengali language.
- `supabase/functions/elevenlabs-stt/index.ts`:
  - Map ISO `preferred_language` → ElevenLabs ISO 639-3 codes (en→eng, bn→ben, hi→hin, es→spa, fr→fra, ar→ara, etc.). If unknown, omit `language_code` so it auto-detects (better than forcing wrong language).
- `AIChatPanel` STT call: send `user.preferred_language` (ISO) instead of `primaryLanguage` (legacy bangla/english).
- Add explicit microphone permission probe before recording with friendly error messages (NotAllowed / NotFound / NotReadable).
- Auto-send the transcribed text option: after STT returns, focus the textarea and surface a "Send" hint (don't auto-send, but make it obvious).

### 3. Sign-in fixes

In `src/pages/SignIn.tsx`:
- The current `useEffect` calls `getSession` and redirects, but doesn't subscribe to `onAuthStateChange`, so a slow session restore can race with form submission. Add an `onAuthStateChange` listener (set up **before** `getSession`) that handles `SIGNED_IN` → `checkProfileAndRedirect`, and remove the duplicate redirect call after `signInWithPassword` (let the listener handle it). This eliminates the "have to sign in every time" symptom (it's actually session restore racing with the redirect).
- Wrap profile read in a try/catch — if `profiles` row is missing for an old user, create it on the fly (don't bounce them back to sign in).
- Show a loading screen on first mount while session is being restored, so the UI doesn't briefly flash the form for already-signed-in users.

In `src/contexts/UserContext.tsx`:
- The current `onAuthStateChange` early-returns if localStorage already has `onboarding_step === 'complete'`. Bug: if the localStorage was cleared (different device / browser) but the DB profile exists, the user gets stuck. Remove that early return; always sync from DB on `SIGNED_IN`/`TOKEN_REFRESHED`.
- Don't await DB calls inside the auth callback — fire-and-forget the fetch, then setUser when it resolves (prevents auth deadlocks).

### 4. Home dashboard fixes

In `src/components/home/tabs/ProgressTab.tsx`:
- The progress circle currently shows a value that may be 0 or stale. Wire it to a real metric: `(mastered_concepts / total_concepts) * 100` from the learning engine's `get-student-profile`. If no data yet, show `--%` and a "Start a lesson to see progress" hint instead of a frozen 0%.
- Refresh the value when the tab becomes active (re-query on mount, not just on first load).

In `src/pages/Home.tsx`:
- Fix the "ref" warning from console (Website route's `ThemeToggle` and `Website` itself need `forwardRef` since BottomNav passes refs through). Wrap `ThemeToggle` with `React.forwardRef` to silence the warning and prevent any tooltip ref bug.

### 5. Remaining errors

- **Exam tab** (already partially fixed earlier) — verify that `selectedQuestionTypes` from `ExamSetup` is honored in `ExamSession` for non-MCQ types and that the AI generator branches correctly. Add a fallback: if AI returns 0 questions of a requested type, retry once with simpler prompt.
- **Saved chat history** (`chat_messages` table already exists):
  - In `useAIChat.ts`: on first render, load last 50 messages for `(user_id, subject_id)` from `chat_messages`. After every successful exchange, insert both user + assistant rows. Add a "Clear history" that also deletes from DB.
- **Forwarded ref warnings** (console): wrap `ThemeToggle` and verify `BottomNav`/`NavLink` use `forwardRef` where needed.
- **Web search button**: currently does its own pre-fetch then calls `sendMessage`. Move the firecrawl call server-side into `web-search` edge function (already exists) and ensure CORS headers list `apikey` (it does). Verify it's deployed.

### Files to change

- `supabase/functions/ai-tutor/index.ts` — book-preferred mode, language handling, model fallback
- `supabase/functions/elevenlabs-tts/index.ts` — ISO language mapping
- `supabase/functions/elevenlabs-stt/index.ts` — ISO language mapping, auto-detect fallback
- `src/components/subject/AIChatPanel.tsx` — TTS gesture-safe playback, STT language ISO, mic permission UX, send `preferred_language`
- `src/hooks/useAIChat.ts` — load + persist chat history, pass preferred_language
- `src/pages/SignIn.tsx` — onAuthStateChange listener, loading screen, profile auto-create
- `src/contexts/UserContext.tsx` — remove early-return in auth callback, fire-and-forget DB sync
- `src/components/home/tabs/ProgressTab.tsx` — wire circle to real mastery metric
- `src/components/ThemeToggle.tsx` — wrap in `React.forwardRef`
- `src/components/exam/ExamSession.tsx` — verify all question types honored, retry on empty

### Out of scope (ask first)

- I will not change the database schema; existing `chat_messages` table is sufficient for history.
- No new secrets needed; ELEVENLABS_API_KEY and GOOGLE_AI_API_KEY are already configured.