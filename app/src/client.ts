import { useMutation, useQuery } from "@tanstack/react-query";
import axios, { AxiosError } from "axios";
import { useSetAtom } from "jotai";

import store, { $token } from "./store";
import { encodeArrayBufferBase64 } from "./utils";

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

const API_URL = process.env.EXPO_PUBLIC_API_URL;

const client = axios.create({
  baseURL: API_URL,
  responseType: "json",
});

// attach token to every request
client.interceptors.request.use((config) => {
  const token = store.get($token);
  if (token) config.headers.setAuthorization(`Bearer ${token}`);
  return config;
});

// log error responses globally
client.interceptors.response.use(undefined, (error) => {
  if (error instanceof AxiosError) {
    console.error(`${error.message}: ${error.response?.data as string}`);
  }
  return error;
});

export const useLoginMutation = () => {
  const setToken = useSetAtom($token);

  type Data = { token: string };
  type Variables = { username: string; password: string };

  return useMutation<Data, AxiosError, Variables>({
    mutationFn: async (credentials) => {
      const response = await client.post("/auth/login", {
        name: credentials.username,
        password: credentials.password,
      });
      return response.data;
    },
    onSuccess: ({ token }) => setToken(token),
  });
};

export const useRegisterMutation = () => {
  const setToken = useSetAtom($token);

  type Data = { token: string };
  type Variables = { username: string; password: string };

  return useMutation<Data, AxiosError, Variables>({
    mutationFn: async (data) => {
      const response = await client.post("/auth/register", {
        name: data.username,
        password: data.password,
        language: "en", // TODO: remove hardcoding
      });
      return response.data;
    },
    onSuccess: ({ token }) => setToken(token),
  });
};

export const useTranscriptQuery = () =>
  useQuery<Transcript, AxiosError>({
    queryKey: ["transcript"],
    queryFn: async () => {
      const response = await client.get<Transcript>("/transcript/");
      return response.data;
    },
  });

export const useTeachMutation = (transcript?: Transcript) =>
  useMutation<Result | null, AxiosError, string>({
    mutationFn: async (uri: string) => {
      if (!transcript) return null;
      const { data } = await axios.get<ArrayBuffer>(uri, {
        responseType: "arraybuffer",
        responseEncoding: "binary",
      });
      const audio = encodeArrayBufferBase64(data);
      const response = await client.post<Result | null>(`/transcript/${transcript.id}`, { audio });
      return response.data;
    },
  });

export default client;
