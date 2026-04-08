export type User = {
  id: string;
  name: string;
  language: string;
  timezone: string;
  streak: number;
  milestone: number;
  points: [number, number]; // [today, total]
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

export type AchievementResponse = {
  key: string;
  title: string;
  desc: string;
  unlocked: boolean;
  unlocked_at: string | null;
  progress: number;
};

export type ClaimAchievementRequest = {
  achievement_key: string;
};

export type ClaimAchievementResponse = {
  achievement_key: string;
  unlocked_at: string;
};
