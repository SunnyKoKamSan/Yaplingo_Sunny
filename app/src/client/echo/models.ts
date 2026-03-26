import type { Pronunciation, Transcript } from "../models";

export type Scenario = {
  topic: string;
  scenario: string;
  transcripts: Transcript[];
};

export type Session = {
  scenario: Scenario;
  total: number;
  progress: number;
  attempts: Attempt[][];
  completed: boolean;
};

export type Attempt = {
  audio: string;
  feedback: string;
  pronunciation: Pronunciation & {
    words: [string, Omit<Pronunciation, "words">][];
  };
};

export type Summary = {
  points: number;
};

export type Response =
  | { type: "session"; response: Session }
  | { type: "attempt"; response: Attempt | null }
  | { type: "summary"; response: Summary };
