import { useMutation, useQuery } from "@tanstack/react-query";
import axios, { AxiosError } from "axios";
import { useSetAtom } from "jotai";

import store, { $authed, $token } from "../store";
import type { Result, Transcript, User } from "./models";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

const client = axios.create({
  baseURL: API_URL,
  responseType: "json",
  timeout: 5000,
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
  return Promise.reject(error);
});

export const useAuthQuery = () =>
  useQuery<User, AxiosError>({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const response = await client.get("/auth/me");
      return response.data;
    },
    retry: false,
  });

export const useLoginMutation = () => {
  const setToken = useSetAtom($token);
  const setAuthed = useSetAtom($authed);

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
    onSuccess: ({ token }) => {
      setToken(token);
      setAuthed(true);
    },
  });
};

export const useRegisterMutation = () => {
  const setToken = useSetAtom($token);
  const setAuthed = useSetAtom($authed);

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
    onSuccess: ({ token }) => {
      setToken(token);
      setAuthed(true);
    },
  });
};

export const useTranscriptQuery = (id?: string) =>
  useQuery<Transcript, AxiosError>({
    queryKey: ["transcript", id],
    queryFn: async () => {
      const response = await client.get<Transcript>(`/transcript/${id ?? ""}`);
      return response.data;
    },
  });

export const useTeachMutation = (transcript?: Transcript) =>
  useMutation<Result | null, AxiosError, string>({
    mutationFn: async (audio: string) => {
      if (!transcript) return null;
      const response = await client.post<Result | null>(`/transcript/${transcript.id}`, { audio }, { timeout: 60000 });
      return response.data;
    },
  });

export default client;
