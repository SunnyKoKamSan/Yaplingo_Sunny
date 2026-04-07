import useSession from "../useSession";
import type { Response, Session, Turn } from "./models";

export enum ChatSessionStatus {
  LOADING,
  READY_TURN,
  PENDING_TURN,
  FINISHED,
}

export type ChatSession =
  | {
      status: ChatSessionStatus.LOADING;
      data: undefined;
    }
  | {
      status: ChatSessionStatus.READY_TURN | ChatSessionStatus.PENDING_TURN | ChatSessionStatus.FINISHED;
      data: Session;
    };

type State = ChatSession & { next?: Response["type"] };

type Action = ["SUBMIT"] | ["RECEIVE", Response];

const reduceState = (state: State, [type, payload]: Action): State => {
  switch (type) {
    case "SUBMIT": {
      return {
        status: ChatSessionStatus.PENDING_TURN,
        data: state.data as Session,
        next: "turn",
      };
    }
    case "RECEIVE": {
      const { type, response } = payload;
      if (type !== state.next) {
        throw new Error(`unexpected response type: ${type}, expected: ${state.next}`);
      }
      switch (type) {
        case "session": {
          return {
            status: response.finished ? ChatSessionStatus.FINISHED : ChatSessionStatus.READY_TURN,
            data: response,
            next: response.finished ? undefined : "turn",
          };
        }
        case "turn": {
          const session = state.data as Session;
          const turns = response ? [...session.turns, response] : session.turns; // local optimistic update
          return {
            status: ChatSessionStatus.READY_TURN,
            data: { ...session, turns },
            next: response === null ? "turn" : "session",
          };
        }
      }
    }
  }
};

const initialState: State = {
  status: ChatSessionStatus.LOADING,
  data: undefined,
  next: "session",
};

export const useChatSession = ({ onClose }: { onClose?: (status: ChatSessionStatus) => void }) => {
  const { state, submit, abort, end } = useSession<ChatSessionStatus, State, Action, Response, Turn | null>(
    {
      endpoint: "chat/ws",
      initialState,
      reduceState,
      readyStatus: ChatSessionStatus.READY_TURN,
      completedStatus: ChatSessionStatus.FINISHED,
      submitResponseType: "turn",
    },
    { onClose },
  );

  return {
    session: {
      status: state.status,
      data: state.data,
    } as ChatSession,
    submit,
    abort,
    end,
  } as const;
};

export * from "./models";
