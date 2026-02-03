export type Transcript = {
  id: string;
  text: string;
  audio: string;
  sequence: string;
};

export type Session = {
  total: number;
  progress: number;
  attempts: number[];
  topic: string;
  scenario: string;
  transcript: Transcript;
};

type PronunciationAlignment = {
  token: string;
  score: number;
  interval: [number, number];
};

type PronunciationDifference = {
  operation: "replace" | "insert" | "delete";
  word: string;
  expected?: string;
  predicted?: string;
};

type Pronunciation = {
  phonemes: string[];
  alignments: PronunciationAlignment[];
  differences: PronunciationDifference[];
};

export type Result = {
  feedback: string;
  pronunciation: Pronunciation & {
    words: [string, Pronunciation][];
  };
};

export type Response = { type: "session"; response: Session } | { type: "result"; response: Result | null };
