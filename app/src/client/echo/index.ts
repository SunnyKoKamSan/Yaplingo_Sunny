import { useCallback } from "react";

import useSession from "../useSession";
import type { Attempt, Response, Session, Summary } from "./models";

export enum EchoSessionStatus {
  LOADING_NEW,
  LOADING_NEXT,
  READY_ATTEMPT,
  PENDING_ATTEMPT,
  READY_NEXT,
  COMPLETED,
}

export type EchoSession =
  | {
      status: EchoSessionStatus.LOADING_NEW;
      data: undefined;
    }
  | {
      status: EchoSessionStatus.LOADING_NEXT | EchoSessionStatus.PENDING_ATTEMPT;
      data: Session;
    }
  | {
      status: EchoSessionStatus.READY_ATTEMPT | EchoSessionStatus.READY_NEXT;
      data: Session;
    }
  | {
      status: EchoSessionStatus.COMPLETED;
      data: Session & { summary: Summary };
    };

type State = EchoSession & { next?: Response["type"] };

type Action = ["SUBMIT"] | ["BUY"] | ["PROCEED"] | ["RECEIVE", Response];

const reduceState = (state: State, [type, payload]: Action): State => {
  switch (type) {
    case "SUBMIT": {
      const session = state.data as Session;
      return {
        status: EchoSessionStatus.PENDING_ATTEMPT,
        data: session,
        next: "attempt",
      };
    }
    case "BUY":
    case "PROCEED": {
      const session = state.data as Session;
      return {
        status: EchoSessionStatus.LOADING_NEXT,
        data: session,
        next: "session",
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
            status: EchoSessionStatus.READY_ATTEMPT,
            data: response,
            next: response.completed ? "summary" : "attempt",
          };
        }
        case "attempt": {
          const session = state.data as Session;
          const attempts = session.attempts.slice(); // copy
          attempts[session.progress] = response
            ? [...attempts[session.progress], response]
            : attempts[session.progress]; // local optimistic update
          const attemptable =
            response === null || session.chances[session.progress] > attempts[session.progress].length;
          return {
            status: attemptable ? EchoSessionStatus.READY_ATTEMPT : EchoSessionStatus.READY_NEXT,
            data: { ...session, attempts, attemptable },
            next: "session",
          };
        }
        case "summary": {
          return {
            status: EchoSessionStatus.COMPLETED,
            data: { ...(state.data as Session), summary: response },
            next: undefined,
          };
        }
      }
    }
  }
};

const initialState: State = {
  status: EchoSessionStatus.LOADING_NEW,
  data: undefined,
  next: "session",
};

export const useEchoSession = ({ onClose }: { onClose?: (status: EchoSessionStatus) => void }) => {
  const { state, _dispatch, send, submit, abort, end } = useSession<
    EchoSessionStatus,
    State,
    Action,
    Response,
    Attempt | null
  >(
    {
      endpoint: "echo/ws",
      initialState,
      reduceState,
      readyStatus: EchoSessionStatus.READY_ATTEMPT,
      completedStatus: EchoSessionStatus.COMPLETED,
      submitResponseType: "attempt",
    },
    { onClose },
  );

  const buy = useCallback(() => {
    if (![EchoSessionStatus.READY_NEXT, EchoSessionStatus.READY_ATTEMPT].includes(state.status)) {
      throw new Error("session not ready to buy");
    }
    send({ type: "buy" });
    _dispatch(["BUY"]);
  }, [state.status, send, _dispatch]);

  const proceed = useCallback(() => {
    if (![EchoSessionStatus.READY_NEXT, EchoSessionStatus.READY_ATTEMPT].includes(state.status)) {
      throw new Error("session not ready to proceed");
    }
    send({ type: "next" });
    _dispatch(["PROCEED"]);
  }, [state.status, send, _dispatch]);

  return {
    session: {
      status: state.status,
      data: state.data,
    } as EchoSession,
    submit,
    buy,
    proceed,
    abort,
    end,
  } as const;
};

export * from "./models";
