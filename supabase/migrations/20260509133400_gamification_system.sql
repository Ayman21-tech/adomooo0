-- ─── Gamification System Migration ───────────────────────────────────────────

-- 1. Update Profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_xp INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_level INTEGER DEFAULT 1;

-- 2. Badges Table
CREATE TABLE IF NOT EXISTS public.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon_url TEXT,
  criteria_type TEXT NOT NULL, -- 'mastery', 'streak', 'exam_count', 'score'
  criteria_value INTEGER,
  subject_id TEXT,
  rarity TEXT DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. User Badges (Achievements)
CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id UUID REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

-- 4. XP Transactions (Audit Log)
CREATE TABLE IF NOT EXISTS public.xp_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL, -- e.g., 'Exam Completion: Physics', 'Daily Streak'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5. Award XP Function
CREATE OR REPLACE FUNCTION public.award_xp(target_user_id UUID, xp_amount INTEGER, xp_reason TEXT)
RETURNS VOID AS $$
BEGIN
  -- Log transaction
  INSERT INTO public.xp_transactions (user_id, amount, reason)
  VALUES (target_user_id, xp_amount, xp_reason);
  
  -- Update total XP
  UPDATE public.profiles
  SET total_xp = total_xp + xp_amount,
      current_level = floor(sqrt((total_xp + xp_amount) / 100)) + 1
  WHERE user_id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Trigger for Exam Completion (using user_progress table as proxy if exam_results isn't direct)
-- Actually, let's create a trigger on exam_results if it exists.
-- Checking migrations, I see 'saveResult' in useExamResults. Let's find that table.

-- 7. Leaderboard View
CREATE OR REPLACE VIEW public.leaderboard AS
SELECT 
  p.id,
  p.user_id,
  p.name,
  p.total_xp,
  p.current_level,
  RANK() OVER (ORDER BY p.total_xp DESC) as rank
FROM public.profiles p
ORDER BY p.total_xp DESC;

-- Enable RLS
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xp_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Badges are publicly readable" ON public.badges FOR SELECT USING (true);
CREATE POLICY "Users can view their own badges" ON public.user_badges FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own xp transactions" ON public.xp_transactions FOR SELECT USING (auth.uid() = user_id);

-- Seed Initial Badges
INSERT INTO public.badges (name, description, icon_url, criteria_type, criteria_value, rarity) VALUES
('Early Bird', 'Join the Adomo AI learning community', '🥚', 'signup', 1, 'common'),
('Consistent Learner', 'Maintain a 7-day study streak', '🔥', 'streak', 7, 'common'),
('Study Warrior', 'Maintain a 30-day study streak', '⚔️', 'streak', 30, 'rare'),
('Master of Knowledge', 'Master 10 concepts with 80%+ mastery', '🧠', 'mastery_count', 10, 'epic'),
('Perfect Score', 'Get 100% in a Real Exam', '🎯', 'score', 100, 'rare'),
('The Specialist', 'Reach level 5 in any subject', '🏆', 'subject_level', 5, 'rare');
