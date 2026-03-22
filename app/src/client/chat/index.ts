import { useCallback, useEffect, useReducer, useRef } from "react";

import { createWebSocket } from "../client";
import type { Response, Result, Session } from "./models";

export enum ChatSessionStatus {
  LOADING,
  READY_ATTEMPT,
  PENDING_RESULT,
  FINISHED,
}

export type ChatSessionData = ChatSession["data"];

export type ChatSession =
  | {
      status: ChatSessionStatus.LOADING;
      data: undefined;
    }
  | {
      status: ChatSessionStatus.READY_ATTEMPT | ChatSessionStatus.PENDING_RESULT;
      data: Session;
    }
  | {
      status: ChatSessionStatus.FINISHED;
      data: Session;
    };

type State = ChatSession & {
  next?: Response["type"];
};

type Action = ["SUBMIT"] | ["RECEIVE", Response];

const reduceState = (state: State, [type, payload]: Action): State => {
  switch (type) {
    case "SUBMIT": {
      return {
        status: ChatSessionStatus.PENDING_RESULT,
        data: state.data as Session,
        next: "result",
      };
    }
    case "RECEIVE": {
      const { type, response } = payload;
      switch (type) {
        case "session": {
          return {
            status: response.finished ? ChatSessionStatus.FINISHED : ChatSessionStatus.READY_ATTEMPT,
            data: response,
            next: response.finished ? undefined : "result",
          };
        }
        case "result": {
          return {
            status: ChatSessionStatus.READY_ATTEMPT,
            data: state.data as Session,
            next: response === null ? "result" : "session",
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
    ws.current = createWebSocket("chat/ws");
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
        if (state.status !== ChatSessionStatus.READY_ATTEMPT) {
          throw new Error("session not ready for attempt");
        }
        resolveSubmit.current = resolve;
        ws.current.send(JSON.stringify({ type: "audio", input: audio }));
        dispatch(["SUBMIT"]);
      });
    },
    [state.status],
  );

  const abort = useCallback(() => {
    // FIXME: handle abort during loading
    if (!ws.current) throw new Error("WebSocket undefined");
    ws.current.send(JSON.stringify({ type: "abort" }));
    close();
  }, [close]);

  const end = useCallback(() => {
    if (!ws.current) throw new Error("WebSocket undefined");
    if (state.status !== ChatSessionStatus.FINISHED) {
      throw new Error("session not completed");
    }
    ws.current.send(""); // acknowledge completion
    close();
  }, [state.status, close]);

  useEffect(() => {
    open();
    return () => close();
  }, [open, close]);

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
