import { useCallback, useEffect, useReducer, useRef } from "react";

import { createWebSocket } from "../client";
import type { Response, Result, Session } from "./models";

export type EchoSession = Session & {
  result?: Result | null;
};

export enum EchoSessionStatus {
  LOADING_NEW,
  LOADING_NEXT,
  PENDING_ATTEMPT,
  PENDING_RESULT,
  READY_NEXT,
}

export type EchoSessionState =
  | {
      status: EchoSessionStatus.LOADING_NEW;
      session: undefined;
    }
  | {
      status: Exclude<EchoSessionStatus, EchoSessionStatus.LOADING_NEW>;
      session: EchoSession;
    };

type State = EchoSessionState & {
  next: Response["type"];
};

type Action = ["SUBMIT"] | ["PROCEED"] | ["RECEIVE", Response];

const reduceState = (state: State, [type, payload]: Action): State => {
  switch (type) {
    case "SUBMIT": {
      return {
        status: EchoSessionStatus.PENDING_RESULT,
        session: state.session!,
        next: "result",
      };
    }
    case "PROCEED": {
      return {
        status: EchoSessionStatus.LOADING_NEXT,
        session: {
          ...state.session!,
          result: undefined,
        },
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
            status: EchoSessionStatus.PENDING_ATTEMPT,
            session: response,
            next: "result",
          };
        }
        case "result": {
          return {
            status: response !== null ? EchoSessionStatus.READY_NEXT : EchoSessionStatus.PENDING_ATTEMPT,
            session: { ...state.session!, result: response },
            next: "session",
          };
        }
      }
    }
  }
};

const initialState: State = {
  status: EchoSessionStatus.LOADING_NEW,
  session: undefined,
  next: "session",
};

export const useEchoSession = ({ onClose }: { onClose?: () => void }) => {
  const handleClose = useRef(onClose);

  const ws = useRef<WebSocket>(undefined);
  const resolveSubmit = useRef<(result: Result | null) => void>(undefined);

  const [state, dispatch] = useReducer(reduceState, initialState);

  const handleResponse = useCallback((response: Response) => {
    dispatch(["RECEIVE", response]);
    const { type, response: res } = response;
    switch (type) {
      case "result": {
        if (type === "result") {
          resolveSubmit.current?.(res);
          resolveSubmit.current = undefined;
        }
        break;
      }
    }
  }, []);

  const open = useCallback(() => {
    if (ws.current) ws.current.close();
    ws.current = createWebSocket("echo/ws");
    ws.current.onmessage = async ({ data }) => {
      try {
        const response = JSON.parse(data) as Response;
        handleResponse(response);
      } catch {} // TODO: handle parsing error
    };
    ws.current.onclose = () => {
      ws.current = undefined;
      handleClose.current?.();
    };
  }, [handleResponse]);

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
        if (state.status !== EchoSessionStatus.PENDING_ATTEMPT) {
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
    if (![EchoSessionStatus.READY_NEXT, EchoSessionStatus.PENDING_ATTEMPT].includes(state.status)) {
      throw new Error("session not ready to proceed");
    }
    ws.current.send(JSON.stringify({ type: "next", input: null }));
    dispatch(["PROCEED"]);
  }, [state.status]);

  const abort = useCallback(() => {
    // FIXME: handle abort during loading new session
    if (!ws.current) throw new Error("WebSocket undefined");
    ws.current.send(JSON.stringify({ type: "abort", input: null }));
    close();
  }, [close]);

  useEffect(() => {
    open();
    return () => close();
  }, [open, close]);

  return {
    ...({
      status: state.status,
      session: state.session,
    } as EchoSessionState),
    submit,
    proceed,
    abort,
  } as const;
};

export * from "./models";
