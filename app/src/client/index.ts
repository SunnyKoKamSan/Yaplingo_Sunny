import { useMutation, useQuery } from "@tanstack/react-query";
import axios, { AxiosError } from "axios";
import { useSetAtom } from "jotai";

import store, { $token } from "../store";
import type { Result, Transcripts, User } from "./models";

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
    if (error.status === 401) store.set($token, ""); // clear token on unauthorized
    console.error(`${error.message}: ${error.response?.data as string}`);
  }
  return Promise.reject(error);
});

export const useAuthedUserQuery = () =>
  useQuery<User | null, AxiosError>({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const response = await client.get("/auth/me", {
        timeout: 5000,
        validateStatus: (status) => [200, 401, 403].includes(status),
      });
      if (response.status === 401) {
        store.set($token, "");
      }
      return response.data;
    },
    retry: true,
    staleTime: Infinity,
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

export const useEchoTranscriptsQuery = () =>
  useQuery<Transcripts, AxiosError>({
    queryKey: ["echo", "transcripts"],
    queryFn: async () => {
      const response = await client.get<Transcripts>(`/echo/`);
      return response.data;
    },
    staleTime: Infinity,
    refetchOnMount: "always", // important
  });

export const useEchoMutation = (tid?: string) =>
  useMutation<Result | null, AxiosError, string>({
    mutationFn: async (audio: string) => {
      if (!tid) throw new Error("transcript id is not provided");
      const response = await client.post<Result | null>(`/echo/${tid}`, { audio });
      return response.status === 200 ? response.data : null;
    },
  });

export const useEchoFeedbackAudioQuery = (tid?: string) =>
  useQuery<string | null, AxiosError>({
    queryKey: ["echo", tid, "result", "feedback.wav"],
    queryFn: async () => {
      const response = await client.get<string | null>(`/echo/${tid}/feedback.wav`);
      return response.data;
    },
    enabled: !!tid,
    staleTime: Infinity,
  });

export default client;
