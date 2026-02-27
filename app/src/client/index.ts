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
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import axios, { AxiosError } from "axios";
import { useSetAtom } from "jotai";

import store, { $gemBalance, $lastCheckIn, $token } from "../store";
import type {
  AchievementResponse,
  CheckInParams,
  CheckInResponse,
  ClaimAchievementRequest,
  ClaimAchievementResponse,
  ActiveEvent,
  GemBalanceResponse,
  LeaderboardItem,
  MyRankResponse,
  Result,
  SpendGemsRequest,
  SpendGemsResponse,
  Topic,
  TopicMasteryResponse,
  Transcripts,
  User,
  UserInventoryResponse,
} from "./models";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";
let supportsDailyProgressEndpoint: boolean | null = null;
const GAMIFICATION_QUERY_KEY = ["gamification"] as const;
const GAMIFICATION_DAILY_PROGRESS_QUERY_KEY = [...GAMIFICATION_QUERY_KEY, "daily-progress"] as const;
const GAMIFICATION_LEADERBOARD_QUERY_KEY = [...GAMIFICATION_QUERY_KEY, "leaderboard"] as const;
const GAMIFICATION_MY_RANK_QUERY_KEY = [...GAMIFICATION_QUERY_KEY, "myRank"] as const;

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

const getLeaderboardQueryKey = (periodKey?: string, topic?: Topic) =>
  [...GAMIFICATION_LEADERBOARD_QUERY_KEY, periodKey ?? "current", topic ?? "Global"] as const;

const getMyRankQueryKey = (periodKey?: string, topic?: Topic) =>
  [...GAMIFICATION_MY_RANK_QUERY_KEY, periodKey ?? "current", topic ?? "Global"] as const;

const fetchLeaderboard = async (periodKey?: string, topic?: Topic): Promise<LeaderboardItem[]> => {
  const params: Record<string, string> = {};
  if (periodKey === "ALL_TIME") {
    params.all_time = "true";
  } else if (periodKey) {
    params.period_key = periodKey;
  }
  if (topic && topic !== "Global") params.topic = topic;
  const { data } = await client.get<LeaderboardItem[]>("/gamification/leaderboard", { params });
  return data;
};

const fetchMyRank = async (periodKey?: string, topic?: Topic): Promise<MyRankResponse> => {
  const params: Record<string, string> = {};
  if (periodKey === "ALL_TIME") {
    params.all_time = "true";
  } else if (periodKey) {
    params.period_key = periodKey;
  }
  if (topic && topic !== "Global") params.topic = topic;
  const { data } = await client.get<MyRankResponse>("/gamification/leaderboard/me", { params });
  return data;
};

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

export const useInvalidateGamification = () => {
  const queryClient = useQueryClient();
  return {
    all: () => queryClient.invalidateQueries({ queryKey: GAMIFICATION_QUERY_KEY }),
    leaderboard: () => queryClient.invalidateQueries({ queryKey: GAMIFICATION_LEADERBOARD_QUERY_KEY }),
    myRank: () => queryClient.invalidateQueries({ queryKey: GAMIFICATION_MY_RANK_QUERY_KEY }),
  };
};

// ============================================================================
// CHECK-IN MUTATION
// ============================================================================
export const useCheckInMutation = (): UseMutationResult<
  CheckInResponse,
  AxiosError,
  CheckInParams
> => {
  const queryClient = useQueryClient();
  const invalidateGamification = useInvalidateGamification();
  const setLastCheckIn = useSetAtom($lastCheckIn);
  const setGemBalance = useSetAtom($gemBalance);

  return useMutation({
    mutationFn: async (params: CheckInParams) => {
      // Server is the UTC authority; client never sends dates.
      const { data } = await client.post<CheckInResponse>("/gamification/check-in", params);
      return data;
    },
    onSuccess: (data) => {
      setLastCheckIn(data);
      queryClient.setQueryData(GAMIFICATION_DAILY_PROGRESS_QUERY_KEY, data);
      if (data.gems_earned > 0) {
        setGemBalance((prev) => prev + data.gems_earned);
        queryClient.invalidateQueries({ queryKey: [...GAMIFICATION_QUERY_KEY, "gems"] });
      }
      if (data.newly_unlocked.length > 0) {
        queryClient.invalidateQueries({ queryKey: [...GAMIFICATION_QUERY_KEY, "achievements"] });
      }
      invalidateGamification.all();
    },
  });
};

export const useDailyProgressQuery = (): UseQueryResult<CheckInResponse, AxiosError> => {
  const setLastCheckIn = useSetAtom($lastCheckIn);
  const query = useQuery<CheckInResponse, AxiosError>({
    queryKey: GAMIFICATION_DAILY_PROGRESS_QUERY_KEY,
    queryFn: async () => {
      const fallback = store.get($lastCheckIn) ?? {
        user_id: "",
        date_key: new Date().toISOString().slice(0, 10),
        xp_earned: 0,
        goal_met: false,
        lessons_completed: 0,
        high_accuracy_hits: 0,
        new_streak: 0,
        bonus_xp: 0,
        multiplier_active: false,
        event_name: null,
        gems_earned: 0,
        newly_unlocked: [],
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
  return useQuery({
    queryKey: getLeaderboardQueryKey(periodKey, topic),
    queryFn: () => fetchLeaderboard(periodKey, topic),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
    retry: 2,
    refetchOnWindowFocus: false,
  });
};

export const useMyRankQuery = (
  periodKey?: string,
  topic?: Topic
): UseQueryResult<MyRankResponse, AxiosError> => {
  return useQuery({
    queryKey: getMyRankQueryKey(periodKey, topic),
    queryFn: () => fetchMyRank(periodKey, topic),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

export const usePrefetchLeaderboard = () => {
  const queryClient = useQueryClient();
  return (periodKey?: string, topic?: Topic) => {
    void queryClient.prefetchQuery({
      queryKey: getLeaderboardQueryKey(periodKey, topic),
      queryFn: () => fetchLeaderboard(periodKey, topic),
      staleTime: 60 * 1000,
    });
  };
};

// ============================================================================
// ACTIVE EVENTS QUERY
// ============================================================================
export const useActiveEventsQuery = () =>
  useQuery<ActiveEvent[], AxiosError>({
    queryKey: [...GAMIFICATION_QUERY_KEY, "active-events"],
    queryFn: async () => {
      const { data } = await client.get<ActiveEvent[]>("/gamification/active-events");
      return data;
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    refetchInterval: 60 * 1000,
  });

// ============================================================================
// MASTERY QUERY
// ============================================================================
export const useMasteryQuery = (): UseQueryResult<TopicMasteryResponse[], AxiosError> =>
  useQuery({
    queryKey: [...GAMIFICATION_QUERY_KEY, "mastery"],
    queryFn: async () => {
      const { data } = await client.get<TopicMasteryResponse[]>("/gamification/mastery");
      return data;
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

// ============================================================================
// GEM & ACHIEVEMENT HOOKS
// ============================================================================

export const useGemBalanceQuery = (): UseQueryResult<GemBalanceResponse, AxiosError> => {
  const setGemBalance = useSetAtom($gemBalance);
  const query = useQuery<GemBalanceResponse, AxiosError>({
    queryKey: [...GAMIFICATION_QUERY_KEY, "gems"],
    queryFn: async () => {
      const { data } = await client.get<GemBalanceResponse>("/gamification/gems");
      return data;
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (query.data) setGemBalance(query.data.balance);
  }, [query.data, setGemBalance]);

  return query;
};

export const useSpendGemsMutation = () => {
  const queryClient = useQueryClient();
  const setGemBalance = useSetAtom($gemBalance);
  return useMutation<SpendGemsResponse, AxiosError, SpendGemsRequest>({
    mutationFn: async (req) => {
      const { data } = await client.post<SpendGemsResponse>("/gamification/gems/spend", req);
      return data;
    },
    onSuccess: (data) => {
      setGemBalance(data.new_balance);
      queryClient.invalidateQueries({ queryKey: [...GAMIFICATION_QUERY_KEY, "gems"] });
      queryClient.invalidateQueries({ queryKey: [...GAMIFICATION_QUERY_KEY, "inventory"] });
    },
  });
};

export const useAchievementsQuery = (): UseQueryResult<AchievementResponse[], AxiosError> =>
  useQuery({
    queryKey: [...GAMIFICATION_QUERY_KEY, "achievements"],
    queryFn: async () => {
      const { data } = await client.get<AchievementResponse[]>("/gamification/achievements");
      return data;
    },
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

export const useClaimAchievementMutation = () => {
  const queryClient = useQueryClient();
  const setGemBalance = useSetAtom($gemBalance);
  return useMutation<ClaimAchievementResponse, AxiosError, ClaimAchievementRequest>({
    mutationFn: async (req) => {
      const { data } = await client.post<ClaimAchievementResponse>(
        "/gamification/achievements/claim",
        req,
      );
      return data;
    },
    onSuccess: (data) => {
      setGemBalance(data.new_balance);
      queryClient.invalidateQueries({ queryKey: [...GAMIFICATION_QUERY_KEY, "achievements"] });
      queryClient.invalidateQueries({ queryKey: [...GAMIFICATION_QUERY_KEY, "gems"] });
    },
  });
};

export const useInventoryQuery = (): UseQueryResult<UserInventoryResponse, AxiosError> =>
  useQuery({
    queryKey: [...GAMIFICATION_QUERY_KEY, "inventory"],
    queryFn: async () => {
      const { data } = await client.get<UserInventoryResponse>("/gamification/inventory");
      return data;
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });

export default client;
