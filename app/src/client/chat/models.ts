import type { Pronunciation, Transcript } from "../models";

export type Scenario = {
  scenario: string;
  opening: string;
  tasks: string[];
};

export type Session = {
  scenario: Scenario;
  limit: number;
  quota: number;
  finished: boolean;
  turns: Turn[];
  tasks: EvaluationTask[];
  conversation: Conversation;
};

export type Turn = {
  index: number;
  audio: string;
  context: ConversationUserMessage;
  reply: ConversationAssistantMessage;
  pronunciation: Pronunciation;
  evaluation: Evaluation;
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
};

export type ConversationMessage = ConversationAssistantMessage | ConversationUserMessage;

export type Evaluation = {
  explanation: string;
  tasks: EvaluationTask[];
  criteria: EvaluationCriteria;
};

export type EvaluationTask = {
  task: string;
  completed: boolean;
};

export type EvaluationCriteria = {
  accuracy: number;
  appropriacy: number;
  vocabulary: number;
};

export type Response = { type: "session"; response: Session } | { type: "turn"; response: Turn | null };
