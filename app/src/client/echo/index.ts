import { useCallback, useEffect, useReducer, useRef } from "react";

import { createWebSocket } from "../client";
import type { Response, Result, Session, Summary } from "./models";

export enum EchoSessionStatus {
  LOADING_NEW,
  LOADING_NEXT,
  READY_ATTEMPT,
  PENDING_RESULT,
  READY_NEXT,
  COMPLETED,
}

export type EchoSessionData = EchoSession["data"];

export type EchoSession =
  | {
      status: EchoSessionStatus.LOADING_NEW;
      data: undefined;
    }
  | {
      status: EchoSessionStatus.LOADING_NEXT | EchoSessionStatus.PENDING_RESULT;
      data: Session;
    }
  | {
      status: EchoSessionStatus.READY_ATTEMPT | EchoSessionStatus.READY_NEXT;
      data: Session & { result?: Result | null };
    }
  | {
      status: EchoSessionStatus.COMPLETED;
      data: Summary;
    };

type State = EchoSession & {
  next?: Response["type"];
};

type Action = ["SUBMIT"] | ["PROCEED"] | ["RECEIVE", Response];

const reduceState = (state: State, [type, payload]: Action): State => {
  switch (type) {
    case "SUBMIT": {
      const session = state.data as Session;
      return {
        status: EchoSessionStatus.PENDING_RESULT,
        data: session,
        next: "result",
      };
    }
    case "PROCEED": {
      const session = state.data as Session;
      return {
        status: EchoSessionStatus.LOADING_NEXT,
        data: session,
        next: session.progress < session.total - 1 ? "session" : "summary",
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
            data: response, // result not included
            next: "result",
          };
        }
        case "result": {
          return {
            status: response !== null ? EchoSessionStatus.READY_NEXT : EchoSessionStatus.READY_ATTEMPT,
            data: { ...(state.data as Session), result: response },
            next: "session",
          };
        }
        case "summary": {
          return {
            status: EchoSessionStatus.COMPLETED,
            data: response,
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
  const ws = useRef<WebSocket>(undefined);
  const resolveSubmit = useRef<(result: Result | null) => void>(undefined);

  const [state, dispatch] = useReducer(reduceState, initialState);

  const handleMessage = useRef(async ({ data }: { data: any }) => {
    try {
      const response = JSON.parse(data) as Response;
      dispatch(["RECEIVE", response]);
      if (response.type === "result") {
        resolveSubmit.current?.(response.response);
        resolveSubmit.current = undefined;
      }
    } catch {} // TODO: handle parsing error
  });

  const handleClose = useRef(() => {
    ws.current = undefined;
    onClose?.(state.status);
  });

  const open = useCallback(() => {
    if (ws.current) ws.current.close();
    ws.current = createWebSocket("echo/ws");
    ws.current.onmessage = handleMessage.current;
    ws.current.onclose = handleClose.current;
  }, []);

  const close = useCallback(() => {
    if (ws.current) {
      ws.current.close();
      ws.current = undefined;
    }
  }, []);

  const submit = useCallback(
    (audio: string): Promise<Result | null> => {
      return new Promise((resolve) => {
        if (!ws.current) throw new Error("WebSocket undefined");
        if (state.status !== EchoSessionStatus.READY_ATTEMPT) {
          throw new Error("session not ready for attempt");
        }
        resolveSubmit.current = resolve;
        ws.current.send(JSON.stringify({ type: "audio", input: audio }));
        dispatch(["SUBMIT"]);
      });
    },
    [state.status],
  );

  const proceed = useCallback(() => {
    if (!ws.current) throw new Error("WebSocket undefined");
    if (![EchoSessionStatus.READY_NEXT, EchoSessionStatus.READY_ATTEMPT].includes(state.status)) {
      throw new Error("session not ready to proceed");
    }
    ws.current.send(JSON.stringify({ type: "next" }));
    dispatch(["PROCEED"]);
  }, [state.status]);

  const abort = useCallback(() => {
    // FIXME: handle abort during loading new session
    if (!ws.current) throw new Error("WebSocket undefined");
    ws.current.send(JSON.stringify({ type: "abort" }));
    close();
  }, [close]);

  const end = useCallback(() => {
    if (!ws.current) throw new Error("WebSocket undefined");
    if (state.status !== EchoSessionStatus.COMPLETED) {
      throw new Error("session not completed");
    }
    ws.current.send(""); // acknowledge completion
    close(); // probably redundant since server should close the connection at this point
  }, [state.status, close]);

  useEffect(() => {
    open();
    return () => close();
  }, [open, close]);

  return {
    session: {
      status: state.status,
      data: state.data,
    } as EchoSession,
    submit,
    proceed,
    abort,
    end,
  } as const;
};

export * from "./models";
