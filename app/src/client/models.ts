export type User = {
  id: string;
  name: string;
  language: string;
  timezone: string;
  activity: Record<string, number>;
};

// ── Gamification Types ─────────────────────────────────────────────────────

export type Topic = "Global" | "Food" | "Culture" | "Travel" | "Business" | "Technology";

export type CheckInParams = {
  xp_amount: number;
  topic?: Topic;
  accuracy_percentage?: number;
  completion_time_ms?: number;
};

export type CheckInResponse = {
  user_id: string;
  date_key: string;
  xp_earned: number;
  goal_met: boolean;
  lessons_completed: number;
  high_accuracy_hits: number;
  new_streak: number;
  bonus_xp: number;
  multiplier_active: boolean;
  event_name: string | null;
  gems_earned: number;
  newly_unlocked: string[];
};

export type LeaderboardItem = {
  rank: number;
  name: string;
  total_xp: number;
  user_id: string;
  rank_delta?: number;
};

export type ProximityNeighbour = {
  user_id: string;
  name: string;
  total_xp: number;
  rank: number;
  xp_gap: number;
};

export type ProximityResponse = {
  above: ProximityNeighbour[];
  below: ProximityNeighbour[];
  my_xp: number;
  my_rank: number;
};

export type MyRankResponse = {
  rank: number;
  total_xp: number;
  current_streak: number;
  period_key: string;
  is_current_period: boolean;
};

export type ActiveEvent = {
  id: number;
  name: string;
  description: string;
  multiplier: number;
  starts_at: string;
  ends_at: string;
};

export type MasteryTier = "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond";

export type TopicMasteryResponse = {
  topic: string;
  total_xp: number;
  lesson_count: number;
  avg_accuracy: number;
  avg_speed_ms: number;
  mastery_score: number;
  tier: MasteryTier;
  updated_at: string;
};

export type GemTransaction = {
  id: number;
  amount: number;
  reason: string;
  created_at: string;
};

export type GemBalanceResponse = {
  balance: number;
  transactions: GemTransaction[];
};

export type AchievementResponse = {
  key: string;
  title: string;
  desc: string;
  unlocked: boolean;
  unlocked_at: string | null;
  progress: number;
  gem_reward: number;
  ultimate: boolean;
};

export type SpendGemsRequest = { item_key: string };
export type SpendGemsResponse = { new_balance: number; item_key: string };

export type ClaimAchievementRequest = { achievement_key: string };
export type ClaimAchievementResponse = {
  achievement_key: string;
  gems_awarded: number;
  new_balance: number;
};

export type UserInventoryResponse = {
  streak_freezes: number;
};

export type HistoryEntry = {
  date_key: string;
  xp_earned: number;
  goal_met: boolean;
  lessons_completed: number;
};

export type StatsResponse = {
  seven_day_avg_xp: number;
  thirty_day_best_streak: number;
  completion_rate_30d: number;
  lifetime_xp: number;
};

export type GemConfigResponse = {
  earn_rates: Record<string, number>;
  spend_rates: Record<string, number>;
};

export type UseSkillResponse = {
  skill_key: string;
  message: string;
  remaining: number;
};
