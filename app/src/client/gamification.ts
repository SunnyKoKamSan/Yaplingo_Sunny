import { useEffect } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { type AxiosError } from "axios";
import { useSetAtom } from "jotai";

import store, { $gemBalance, $lastCheckIn, $lastKnownRanks } from "../store";
import client from "./client";
import type {
  AchievementResponse,
  CheckInParams,
  CheckInResponse,
  ClaimAchievementRequest,
  ClaimAchievementResponse,
  ActiveEvent,
  GemBalanceResponse,
  GemConfigResponse,
  HistoryEntry,
  LeaderboardItem,
  MyRankResponse,
  ProximityResponse,
  SpendGemsRequest,
  SpendGemsResponse,
  StatsResponse,
  Topic,
  TopicMasteryResponse,
  UseSkillResponse,
  UserInventoryResponse,
} from "./models";

let supportsDailyProgressEndpoint: boolean | null = null;
const GAMIFICATION_QUERY_KEY = ["gamification"] as const;
const GAMIFICATION_DAILY_PROGRESS_QUERY_KEY = [...GAMIFICATION_QUERY_KEY, "daily-progress"] as const;
const GAMIFICATION_LEADERBOARD_QUERY_KEY = [...GAMIFICATION_QUERY_KEY, "leaderboard"] as const;
const GAMIFICATION_MY_RANK_QUERY_KEY = [...GAMIFICATION_QUERY_KEY, "myRank"] as const;

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

// ── Hooks ──────────────────────────────────────────────────────────────────

export const useInvalidateGamification = () => {
  const queryClient = useQueryClient();
  return {
    all: () => queryClient.invalidateQueries({ queryKey: GAMIFICATION_QUERY_KEY }),
    leaderboard: () => queryClient.invalidateQueries({ queryKey: GAMIFICATION_LEADERBOARD_QUERY_KEY }),
    myRank: () => queryClient.invalidateQueries({ queryKey: GAMIFICATION_MY_RANK_QUERY_KEY }),
  };
};

export const useCheckInMutation = (): UseMutationResult<CheckInResponse, AxiosError, CheckInParams> => {
  const queryClient = useQueryClient();
  const invalidateGamification = useInvalidateGamification();
  const setLastCheckIn = useSetAtom($lastCheckIn);
  const setGemBalance = useSetAtom($gemBalance);

  return useMutation({
    mutationFn: async (params: CheckInParams) => {
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
      const fallback: CheckInResponse = store.get($lastCheckIn) ?? {
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

export const useLeaderboardQuery = (periodKey?: string, topic?: Topic): UseQueryResult<LeaderboardItem[], AxiosError> =>
  useQuery({
    queryKey: getLeaderboardQueryKey(periodKey, topic),
    queryFn: () => fetchLeaderboard(periodKey, topic),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
    retry: 2,
    refetchOnWindowFocus: false,
    select: (data) => {
      const rankKey = `${periodKey ?? "current"}:${topic ?? "Global"}`;
      const lastRanks = store.get($lastKnownRanks) ?? {};
      const enriched = data.map((item) => ({
        ...item,
        rank_delta:
          lastRanks[`${rankKey}:${item.user_id}`] != null
            ? lastRanks[`${rankKey}:${item.user_id}`] - item.rank
            : undefined,
      }));
      const newRanks = { ...lastRanks };
      data.forEach((item) => {
        newRanks[`${rankKey}:${item.user_id}`] = item.rank;
      });
      store.set($lastKnownRanks, newRanks);
      return enriched;
    },
  });

export const useMyRankQuery = (periodKey?: string, topic?: Topic): UseQueryResult<MyRankResponse, AxiosError> =>
  useQuery({
    queryKey: getMyRankQueryKey(periodKey, topic),
    queryFn: () => fetchMyRank(periodKey, topic),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

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
    onSuccess: (data, variables) => {
      setGemBalance(data.new_balance);

      const xpAdded =
        data.xp_added > 0
          ? data.xp_added
          : variables.item_key === "buy_xp_500"
            ? 500
            : 0;
      if (xpAdded > 0) {
        queryClient.setQueryData<MyRankResponse>(getMyRankQueryKey(), (prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            total_xp: data.weekly_total_xp ?? prev.total_xp + xpAdded,
          };
        });
        queryClient.setQueryData<StatsResponse>([...GAMIFICATION_QUERY_KEY, "stats"], (prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            lifetime_xp: data.lifetime_total_xp ?? prev.lifetime_xp + xpAdded,
          };
        });
      }

      queryClient.invalidateQueries({ queryKey: GAMIFICATION_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
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
      const { data } = await client.post<ClaimAchievementResponse>("/gamification/achievements/claim", req);
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

export const useGemConfigQuery = (): UseQueryResult<GemConfigResponse, AxiosError> =>
  useQuery({
    queryKey: [...GAMIFICATION_QUERY_KEY, "gems", "config"],
    queryFn: async () => {
      const { data } = await client.get<GemConfigResponse>("/gamification/gems/config");
      return data;
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

export const useProximityQuery = (topic?: Topic, allTime?: boolean) =>
  useQuery<ProximityResponse, AxiosError>({
    queryKey: [...GAMIFICATION_QUERY_KEY, "proximity", topic ?? "Global", allTime ?? false],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (topic && topic !== "Global") params.topic = topic;
      if (allTime) params.all_time = "true";
      const { data } = await client.get<ProximityResponse>("/gamification/leaderboard/proximity", { params });
      return data;
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

export const useXPHistoryQuery = (days: 7 | 30 = 30) =>
  useQuery<HistoryEntry[], AxiosError>({
    queryKey: [...GAMIFICATION_QUERY_KEY, "history", days],
    queryFn: async () => {
      const { data } = await client.get<HistoryEntry[]>(`/gamification/history?days=${days}`);
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

export const useStatsQuery = () =>
  useQuery<StatsResponse, AxiosError>({
    queryKey: [...GAMIFICATION_QUERY_KEY, "stats"],
    queryFn: async () => {
      const { data } = await client.get<StatsResponse>("/gamification/stats");
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

export const useUseSkillMutation = () => {
  const queryClient = useQueryClient();
  return useMutation<UseSkillResponse, AxiosError, string>({
    mutationFn: async (item_key: string) => {
      const { data } = await client.post<UseSkillResponse>(
        `/gamification/inventory/use?item_key=${encodeURIComponent(item_key)}`,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...GAMIFICATION_QUERY_KEY, "inventory"] });
    },
  });
};
