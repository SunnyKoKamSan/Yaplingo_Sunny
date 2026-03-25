import type { Pronunciation, Transcript } from "../models";

export type Session = {
  total: number;
  progress: number;
  attempts: number[];
  topic: string;
  scenario: string;
  transcript: Transcript;
};

export type Result = {
  feedback: string;
  pronunciation: Pronunciation & {
    words: [string, Omit<Pronunciation, "words">][];
  };
};

export type Summary = {
  total: number;
  topic: string;
  scenario: string;
  attempts: (Result & { audio: string })[][];
  transcripts: Transcript[];
};

export type Response =
  | { type: "session"; response: Session }
  | { type: "result"; response: Result | null }
  | { type: "summary"; response: Summary };
