import type { Pronunciation, Transcript } from "../models";

export type Session = Omit<Scenario, "tasks"> &
  Conversation &
  Evaluation & {
    limit: number;
    quota: number;
    finished: boolean;
  };

export type Scenario = {
  characters: [string, string]; // [assistant, user]
  scenario: string;
  tasks: string[];
};

export type Conversation = {
  messages: (ConversationAssistantMessage | ConversationUserMessage)[];
};

export type ConversationAssistantMessage = {
  role: "assistant";
  content: string;
};

export type ConversationUserMessage = {
  role: "user";
  transcript: Transcript;
  pronunciation: Pronunciation;
};

export type ConversationMessage = ConversationAssistantMessage | ConversationUserMessage;

export type ConversationTurn = {
  context: ConversationUserMessage;
  reply: ConversationAssistantMessage;
};

export type Evaluation = {
  tasks: {
    task: string;
    completed: boolean;
  }[];
};

export type Result = ConversationTurn & Evaluation;

export type Response = { type: "session"; response: Session } | { type: "result"; response: Result | null };
