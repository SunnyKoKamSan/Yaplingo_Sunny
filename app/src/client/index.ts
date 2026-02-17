/**
 * XP CALCULATION STRATEGY
 * ========================
 *
 * The backend check-in endpoint expects 'xp_amount' to be provided by the client.
 *
 * CURRENT APPROACH:
 * - After user completes a lesson via Echo API (POST /echo/analyze),
 * - Client receives analysis results with phoneme error counts in logs
 * - Client calculates XP score based on accuracy:
 *   Example: xp = Math.max(10, 100 - (error_count * 5))
 * - Client then calls useCheckInMutation().mutate({ xp_amount: calculatedXP })
 *
 * FUTURE: Echo could return 'xp_score' directly in response to simplify client logic.
 */
import { useEffect } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import axios, { AxiosError } from "axios";
import { useSetAtom } from "jotai";

import store, { $lastCheckIn, $token } from "../store";
import type {
  CheckInParams,
  CheckInResponse,
  LeaderboardItem,
  MyRankResponse,
  Result,
  Topic,
  Transcripts,
  User,
} from "./models";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";
let supportsDailyProgressEndpoint: boolean | null = null;

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
      const response = await client.get<Transcripts>(`/echo/transcripts`);
      return response.data;
    },
    retry: (failureCount, error) => {
      const status = error.response?.status;
      if ([429, 500, 502, 503, 504].includes(status ?? 0)) return failureCount < 6;
      return failureCount < 2;
    },
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    staleTime: Infinity,
    refetchOnMount: "always", // important
  });

export const useEchoMutation = (tid?: string) =>
  useMutation<void, AxiosError, string>({
    mutationFn: async (audio: string) => {
      if (!tid) return;
      await client.post<void>(`/echo/${tid}`, { audio });
    },
  });

export const useEchoResultQuery = (tid?: string) =>
  useQuery<Result | null, AxiosError>({
    queryKey: ["echo", tid, "result"],
    queryFn: async ({ client: qclient }) => {
      while (true) {
        const { status, data } = await client.get<Result | null>(`/echo/${tid}/result`, {
          validateStatus: (status) => [200, 204, 425].includes(status),
        });
        if (status !== 425) {
          if (status === 204) {
            qclient.removeQueries({ queryKey: ["echo", tid, "result"] });
            return null;
          }
          return data;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    },
    enabled: !!tid,
    staleTime: Infinity,
  });

// ============================================================================
// CHECK-IN MUTATION
// ============================================================================
export const useCheckInMutation = (): UseMutationResult<
  CheckInResponse,
  AxiosError,
  CheckInParams
> => {
  const queryClient = useQueryClient();
  const setLastCheckIn = useSetAtom($lastCheckIn);

  return useMutation({
    mutationFn: async (params: CheckInParams) => {
      // Server is the UTC authority; client never sends dates.
      const { data } = await client.post<CheckInResponse>("/gamification/check-in", params);
      return data;
    },
    onSuccess: (data) => {
      setLastCheckIn(data);
      queryClient.setQueryData(["gamification", "daily-progress"], data);
      queryClient.invalidateQueries({ queryKey: ["gamification"] });
    },
  });
};

export const useDailyProgressQuery = (): UseQueryResult<CheckInResponse, AxiosError> => {
  const setLastCheckIn = useSetAtom($lastCheckIn);
  const query = useQuery<CheckInResponse, AxiosError>({
    queryKey: ["gamification", "daily-progress"],
    queryFn: async () => {
      const fallback = store.get($lastCheckIn) ?? {
        user_id: "",
        date_key: new Date().toISOString().slice(0, 10),
        xp_earned: 0,
        goal_met: false,
        lessons_completed: 0,
        high_accuracy_hits: 0,
        new_streak: 0,
      };

      if (supportsDailyProgressEndpoint === false) return fallback;

      const response = await client.get<CheckInResponse>("/gamification/daily-progress", {
        validateStatus: (status) => [200, 404].includes(status),
      });

      if (response.status === 404) {
        supportsDailyProgressEndpoint = false;
        return fallback;
      }

      supportsDailyProgressEndpoint = true;
      return response.data;
    },
    staleTime: 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: false,
  });

  useEffect(() => {
    if (query.data) setLastCheckIn(query.data);
  }, [query.data, setLastCheckIn]);

  return query;
};

// ============================================================================
// LEADERBOARD QUERIES
// ============================================================================
export const useLeaderboardQuery = (
  periodKey?: string,
  topic?: Topic
): UseQueryResult<LeaderboardItem[], AxiosError> => {
  const isAllTime = periodKey === "ALL_TIME";
  return useQuery({
    queryKey: ["gamification", "leaderboard", periodKey ?? "current", topic ?? "Global"],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (isAllTime) {
        params.all_time = "true";
      } else if (periodKey) {
        params.period_key = periodKey;
      }
      if (topic && topic !== "Global") params.topic = topic;
      const { data } = await client.get<LeaderboardItem[]>("/gamification/leaderboard", { params });
      return data;
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });
};

export const useMyRankQuery = (
  periodKey?: string,
  topic?: Topic
): UseQueryResult<MyRankResponse, AxiosError> => {
  const isAllTime = periodKey === "ALL_TIME";
  return useQuery({
    queryKey: ["gamification", "myRank", periodKey ?? "current", topic ?? "Global"],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (isAllTime) {
        params.all_time = "true";
      } else if (periodKey) {
        params.period_key = periodKey;
      }
      if (topic && topic !== "Global") params.topic = topic;
      const { data } = await client.get<MyRankResponse>("/gamification/leaderboard/me", { params });
      return data;
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });
};

export default client;
