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
