export type User = {
  id: string;
  name: string;
};

export type Transcript = {
  id: string;
  text: string;
  audio: string;
  sequence: string;
};

export type Transcripts = {
  id: string;
  topic: string;
  scenario: string;
  items: Transcript[];
};

type Alignment = {
  token: string;
  score: number;
  interval: [number, number];
};

export type Result = {
  feedback: {
    text: string;
    audio: string;
  };
  pronunciation: {
    phonemes: string[];
    alignments: Alignment[];
    words: [string, Alignment[]][];
  };
};

// ============================================================================
// CONTENT TOPICS (for UI categorization - backend doesn't filter by these yet)
// ============================================================================
export type Topic = "Global" | "Food" | "Culture" | "Travel" | "Business" | "Technology";

// ============================================================================
// GAMIFICATION API TYPES (matching actual backend responses)
// ============================================================================

// POST /gamification/check-in request
export type CheckInParams = {
  xp_amount: number;
  topic?: Topic;
  accuracy_percentage?: number;
};

// POST /gamification/check-in response
export type CheckInResponse = {
  user_id: string;
  date_key: string;
  xp_earned: number;
  goal_met: boolean;
  lessons_completed: number;
  high_accuracy_hits: number;
  new_streak: number;
};

export type LeaderboardItem = {
  rank: number;
  name: string;
  total_xp: number;
  user_id: string;
  // Note: Backend doesn't return avatar_url yet
};

export type MyRankResponse = {
  rank: number;
  total_xp: number;
  current_streak: number;
  period_key: string;
  is_current_period: boolean;
};
