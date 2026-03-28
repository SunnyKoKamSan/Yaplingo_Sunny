import { useCallback, useEffect, useReducer, useRef } from "react";

import { createWebSocket } from "./client";

type Response<T = string, R = unknown> = { type: T; response: R };

type State<TStatus extends number | string, TResponse extends Response> = {
  status: TStatus;
  data: unknown;
  next?: TResponse["type"];
};

type Action<TResponse extends Response> = ["SUBMIT"] | ["RECEIVE", TResponse] | [string, ...unknown[]];

const useSession = <
  TStatus extends number | string,
  TState extends State<TStatus, TResponse>,
  TAction extends Action<TResponse>,
  TResponse extends Response,
  TSubmitResult = unknown,
>(
  config: {
    endpoint: string;
    initialState: TState;
    reduceState: (state: TState, action: TAction) => TState;
    submitResponseType: TResponse["type"];
    readyStatus: TStatus;
    completedStatus: TStatus;
  },
  { onClose }: { onClose?: (status: TStatus) => void },
) => {
  const c = useRef(config);

  const ws = useRef<WebSocket>(undefined);
  const resolveSubmit = useRef<(result: TSubmitResult) => void>(undefined);

  const [state, dispatch] = useReducer(config.reduceState, config.initialState);

  const handleMessage = useRef(async ({ data }: { data: any }) => {
    try {
      const response = JSON.parse(data) as TResponse;
      dispatch(["RECEIVE", response] as TAction);
      if (response.type === config.submitResponseType) {
        resolveSubmit.current?.(response.response as TSubmitResult);
        resolveSubmit.current = undefined;
      }
    } catch {}
  });

  const handleClose = useRef(() => {
    ws.current = undefined;
    onClose?.(state.status);
  });

  const open = useCallback(() => {
    if (ws.current) ws.current.close();
    ws.current = createWebSocket(c.current.endpoint);
    ws.current.onmessage = handleMessage.current;
    ws.current.onclose = handleClose.current;
  }, []);

  const close = useCallback(() => {
    if (ws.current) {
      ws.current.close();
      ws.current = undefined;
    }
  }, []);

  const send = useCallback((message: object | string) => {
    if (!ws.current) throw new Error("WebSocket undefined");
    ws.current.send(typeof message === "string" ? message : JSON.stringify(message));
  }, []);

  const submit = useCallback(
    (audio: string): Promise<TSubmitResult> => {
      return new Promise((resolve) => {
        if (!ws.current) throw new Error("WebSocket undefined");
        if (state.status !== c.current.readyStatus) {
          throw new Error("session not ready for submission");
        }
        resolveSubmit.current = resolve;
        ws.current.send(JSON.stringify({ type: "audio", input: audio }));
        dispatch(["SUBMIT"] as TAction);
      });
    },
    [state.status],
  );

  const abort = useCallback(() => {
    if (!ws.current) throw new Error("WebSocket undefined");
    if (ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: "abort" }));
    }
    close();
  }, [close]);

  const end = useCallback(() => {
    if (!ws.current) throw new Error("WebSocket undefined");
    if (state.status !== c.current.completedStatus) {
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
    state,
    _dispatch: dispatch,
    send,
    submit,
    abort,
    end,
    close,
  } as const;
};

export default useSession;
