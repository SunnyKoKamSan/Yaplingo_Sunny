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
  useQuery<User, AxiosError>({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const response = await client.get("/auth/me", {
        timeout: 5000,
        validateStatus: (status) => [200, 401, 403].includes(status),
      });
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
      const response = await client.get<Transcripts>(`/echo/transcripts`);
      return response.data;
    },
    enabled: false,
    staleTime: Infinity,
  });

export const useEchoMutation = (tid?: string) =>
  useMutation<Result | null, AxiosError, string>({
    mutationFn: async (audio: string) => {
      if (!tid) return null;
      const response = await client.post<Result | null>(`/echo/${tid}`, { audio });
      return response.data;
    },
  });

export const useEchoResultQuery = (tid?: string) =>
  useQuery<Result | null, AxiosError>({
    queryKey: ["echo", tid, "result"],
    queryFn: async () => {
      while (true) {
        const response = await client.get<Result | null>(`/echo/${tid}/result`, {
          validateStatus: (status) => [200, 425].includes(status),
        });
        if (response.status === 200) return response.data;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    },
    enabled: !!tid,
    staleTime: Infinity,
  });

export default client;
