export type Transcript = {
  id: string;
  text: string;
  audio: string;
  sequence: string;
};

export type Session = {
  total: number;
  progress: number;
  topic: string;
  scenario: string;
  transcript: Transcript;
};

type PronunciationAlignment = {
  token: string;
  score: number;
  interval: [number, number];
};

// type PronunciationDifference = {
//   operation: "replace" | "insert" | "delete";
//   word: string;
//   expected?: string;
//   actual?: string;
// };

export type Result = {
  feedback: string;
  pronunciation: {
    phonemes: string[];
    alignments: PronunciationAlignment[];
    words: [string, PronunciationAlignment[]][];
  };
};

export type Response = { type: "session"; response: Session } | { type: "result"; response: Result | null };
