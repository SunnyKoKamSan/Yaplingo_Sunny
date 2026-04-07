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
