import { useCallback, useEffect, useReducer, useRef } from "react";

import { createWebSocket } from "../client";
import type { Response, Result, Session, Summary } from "./models";

export enum EchoSessionStatus {
  LOADING_NEW,
  LOADING_NEXT,
  PENDING_ATTEMPT,
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
      status: EchoSessionStatus.PENDING_ATTEMPT | EchoSessionStatus.READY_NEXT;
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
        console.warn(`unexpected response type: ${type}, expected: ${state.next}`);
        return state;
      }
      switch (type) {
        case "session": {
          return {
            status: EchoSessionStatus.PENDING_ATTEMPT,
            data: response,
            next: "result",
          };
        }
        case "result": {
          return {
            status: response !== null ? EchoSessionStatus.READY_NEXT : EchoSessionStatus.PENDING_ATTEMPT,
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

const isSocketOpen = (socket: WebSocket | undefined): socket is WebSocket =>
  socket !== undefined && socket.readyState === WebSocket.OPEN;

export const useEchoSession = ({ onClose }: { onClose?: (status: EchoSessionStatus) => void }) => {
  const ws = useRef<WebSocket>(undefined);
  const resolveSubmit = useRef<(result: Result | null) => void>(undefined);
  const intentionalClose = useRef(false);
  const retryCount = useRef(0);
  const MAX_RETRIES = 3;

  const [state, dispatch] = useReducer(reduceState, initialState);

  // Keep refs to latest values so WebSocket callbacks always see current state
  const stateRef = useRef(state);
  stateRef.current = state;

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const open = useCallback(() => {
    intentionalClose.current = false;
    if (ws.current) {
      ws.current.onclose = null;
      ws.current.onerror = null;
      ws.current.onmessage = null;
      ws.current.close();
      ws.current = undefined;
    }
    const socket = createWebSocket("echo/ws");
    ws.current = socket;

    socket.onopen = () => {
      retryCount.current = 0;
    };

    socket.onerror = () => {
      console.warn("[Echo WS] socket error");
    };

    socket.onmessage = ({ data }: { data: any }) => {
      try {
        const response = JSON.parse(data) as Response;
        dispatch(["RECEIVE", response]);
        if (response.type === "result") {
          resolveSubmit.current?.(response.response);
          resolveSubmit.current = undefined;
        }
      } catch {} // TODO: handle parsing error
    };

    socket.onclose = () => {
      if (ws.current !== socket || intentionalClose.current) return;
      ws.current = undefined;
      // Auto-retry if we never got past LOADING_NEW (server wasn't ready)
      if (stateRef.current.status === EchoSessionStatus.LOADING_NEW && retryCount.current < MAX_RETRIES) {
        retryCount.current += 1;
        const delay = 1000 * retryCount.current; // 1s, 2s, 3s backoff
        setTimeout(() => {
          if (!intentionalClose.current) open();
        }, delay);
        return;
      }
      onCloseRef.current?.(stateRef.current.status);
    };
  }, []);

  const close = useCallback(() => {
    intentionalClose.current = true;
    if (ws.current) {
      ws.current.onclose = null;
      ws.current.onerror = null;
      ws.current.onmessage = null;
      ws.current.close();
      ws.current = undefined;
    }
  }, []);

  const submit = useCallback(
    (audio: string): Promise<Result | null> => {
      return new Promise((resolve) => {
        if (!isSocketOpen(ws.current)) throw new Error("WebSocket not connected");
        if (stateRef.current.status !== EchoSessionStatus.PENDING_ATTEMPT) {
          throw new Error("session not ready for attempt");
        }
        resolveSubmit.current = resolve;
        ws.current.send(JSON.stringify({ type: "audio", input: audio }));
        dispatch(["SUBMIT"]);
      });
    },
    [],
  );

  const proceed = useCallback(() => {
    if (!isSocketOpen(ws.current)) throw new Error("WebSocket not connected");
    if (![EchoSessionStatus.READY_NEXT, EchoSessionStatus.PENDING_ATTEMPT].includes(stateRef.current.status)) {
      throw new Error("session not ready to proceed");
    }
    ws.current.send(JSON.stringify({ type: "next", input: null }));
    dispatch(["PROCEED"]);
  }, []);

  const abort = useCallback(() => {
    // Gracefully handle abort even if socket is already gone
    if (isSocketOpen(ws.current)) {
      try {
        ws.current.send(JSON.stringify({ type: "abort", input: null }));
      } catch {
        // send may fail if socket is closing
      }
    }
    close();
    onCloseRef.current?.(stateRef.current.status);
  }, [close]);

  const complete = useCallback(() => {
    if (stateRef.current.status !== EchoSessionStatus.COMPLETED) {
      throw new Error("session not completed");
    }
    if (isSocketOpen(ws.current)) {
      try {
        ws.current.send("");
      } catch {
        // send may fail if socket is closing
      }
    }
    close();
    onCloseRef.current?.(stateRef.current.status);
  }, [close]);

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
    complete,
  } as const;
};

export * from "./models";
