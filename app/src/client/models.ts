export type User = {
  id: string;
  name: string;
  language: string;
  timezone: string;
  activity: Record<string, number>;
};

export type PronunciationAlignment = {
  token: string;
  score: number;
  interval: [number, number];
};

export type PronunciationDifference = {
  operation: "replace" | "insert" | "delete";
  word: string;
  expected?: string;
  predicted?: string;
};

export type Pronunciation = {
  phonemes: string[];
  alignments: PronunciationAlignment[];
  differences: PronunciationDifference[];
};

export type Transcript = {
  text: string;
  audio: string;
  sequence: string;
};
