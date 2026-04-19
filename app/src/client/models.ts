export type User = {
  id: string;
  name: string;
  language: string;
  timezone: string;
  streak: number;
  streak_freezes: number;
  gems: number;
  points: {
    total: number;
    today: number;
    milestone: number;
  };
  boost: {
    multiplier: number;
    expiry: number;
  } | null;
  activity: Record<string, number>;
};

// TODO: define this properly
export type UserInsights = {
  summary: string;
};

export type LeaderboardEntry = {
  uid: string;
  name: string;
  rank: number;
  score: number;
};

export type Leaderboard = {
  entries: LeaderboardEntry[];
  me: LeaderboardEntry;
};

export type PronunciationAlignment = {
  token: string;
  score: number;
  interval: [number, number];
};

export type PronunciationDifference = {
  operation: "~" | "+" | "-";
  word: string;
  expected?: string;
  predicted?: string;
};

export type Pronunciation = {
  score: number;
  phonemes: string[];
  alignments: PronunciationAlignment[];
  differences: PronunciationDifference[];
  words: [string, Pronunciation][];
};

export type Transcript = {
  text: string;
  audio: string;
  sequence: string;
};

export type UserStats = {
  progress: {
    date: string;
    points: number;
    count: number;
  }[];
  average_points_7d: number;
  best_streak_30d: number;
  total_points_30d: number;
  completion_rate_30d: number;
};

export type Achievement = {
  key: string;
  title: string;
  description: string;
  progress: number;
  claimed_at: string | null;
};

export type ShopItem = {
  key: string;
  name: string;
  description: string;
  price: number;
  purchasable: boolean;
};
