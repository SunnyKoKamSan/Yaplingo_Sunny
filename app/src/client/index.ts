import { useMutation, useQuery } from "@tanstack/react-query";
import { getCalendars, getLocales } from "expo-localization";
import { type AxiosError, type AxiosRequestConfig } from "axios";
import { useSetAtom } from "jotai";

import { $token } from "../store";
import client from "./client";
import type { Achievement, Leaderboard, User, UserInsights } from "./models";

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
    onSettled: (_data, _error, _variables, _onMutateResult, context) =>
      context.client.invalidateQueries({ queryKey: ["user", "me"] }),
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
    onSettled: (_data, _error, _variables, _onMutateResult, context) =>
      context.client.invalidateQueries({ queryKey: ["user", "me"] }),
  });
};

export const useCurrentUserQuery = ({ check = false }: { check?: boolean } = {}) =>
  useQuery<User, AxiosError>({
    queryKey: ["user", "me"],
    queryFn: async () => {
      const options: AxiosRequestConfig = {
        timeout: 5000,
        validateStatus: (status) => [200, 401, 403].includes(status),
      };
      const response = await client.get("/user/@", check ? options : undefined);
      return response.data;
    },
    retry: true,
    staleTime: Infinity,
  });

export const useCurrentUserInsightsQuery = () =>
  useQuery<UserInsights | null, AxiosError>({
    queryKey: ["user", "me", "insights"],
    queryFn: async () => {
      const response = await client.get(`/user/@/insights`);
      return response.data;
    },
    staleTime: Infinity,
  });

export const useUserQuery = (uid: string) =>
  useQuery<User, AxiosError>({
    queryKey: ["user", uid],
    queryFn: async () => {
      const response = await client.get(`/user/${uid}`);
      return response.data;
    },
  });

export const useLeaderboardQuery = () =>
  useQuery<Leaderboard, AxiosError>({
    queryKey: ["game", "leaderboard"],
    queryFn: async () => {
      const response = await client.get("/game/leaderboard");
      return response.data;
    },
  });

export const useAchievementsQuery = () =>
  useQuery<Achievement[], AxiosError>({
    queryKey: ["game", "achievements"],
    queryFn: async () => {
      const response = await client.get("/game/achievements");
      return response.data;
    },
  });

export const useClaimAchievementMutation = () =>
  useMutation<Achievement, AxiosError, { key: string }>({
    mutationFn: async ({ key }: { key: string }) => {
      const response = await client.post(`/game/achievements/claim/${key}`);
      return response.data;
    },
    onSettled: (_data, _error, _variables, _onMutateResult, context) =>
      context.client.invalidateQueries({ queryKey: ["game", "achievements"] }),
  });

export * from "./models";
export * from "./client";
