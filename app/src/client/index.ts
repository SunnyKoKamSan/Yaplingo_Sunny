import { useMutation, useQuery } from "@tanstack/react-query";
import { getCalendars, getLocales } from "expo-localization";
import { type AxiosError } from "axios";
import { useSetAtom } from "jotai";

import store, { $token } from "../store";
import client from "./client";
import type { User } from "./models";

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
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
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
      const [locale] = getLocales();
      const [calendar] = getCalendars();
      const response = await client.post("/auth/register", {
        name: data.username,
        password: data.password,
        language: locale.languageCode,
        timezone: calendar.timeZone,
      });
      return response.data;
    },
    onSuccess: ({ token }) => setToken(token),
  });
};

export * from "./models";
export * from "./gamification";
