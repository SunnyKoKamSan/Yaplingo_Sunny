export type User = {
  id: string;
  name: string;
};

export type Transcript = {
  id: string;
  text: string;
  sequence: string;
};

export type Result = {
  feedback: {
    text: string;
    audio: string;
  };
  phonemes: {
    alignments: {
      token: string;
      score: number;
      interval: [number, number];
    }[];
    predictions: string[];
    differences: unknown[]; // TODO: type this properly
  };
};
