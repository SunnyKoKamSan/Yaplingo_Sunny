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

export type Result = {
  feedback: {
    text: string;
    audio: string;
  };
  pronunciation: {
    alignments: {
      token: string;
      score: number;
      interval: [number, number];
    }[];
    phonemes: string[];
  };
};
