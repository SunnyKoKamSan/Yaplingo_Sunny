import * as SecureStore from "expo-secure-store";
import { atom, getDefaultStore } from "jotai";
import { atomWithStorage, createJSONStorage } from "jotai/utils";
import { type SyncStringStorage } from "jotai/vanilla/utils/atomWithStorage";

import type { CheckInResponse, ActiveEvent } from "~/client/models";

const store = getDefaultStore();

const createSecureStorage = (): SyncStringStorage => ({
  getItem: (key) => SecureStore.getItem(key),
  setItem: (key, value) => SecureStore.setItem(key, value),
  removeItem: (key) => {
    SecureStore.deleteItemAsync(key);
  },
});

const atomWithSecureStore = <T>(key: string, initialValue: T, { getOnInit = false }) => {
  const storage = createJSONStorage<T>(createSecureStorage);
  return atomWithStorage<T>(key, initialValue, storage, { getOnInit });
};

export const $token = atomWithSecureStore("token", "", { getOnInit: true });

export const $authed = atom((get) => !!get($token));

export const $lastCheckIn = atomWithSecureStore<CheckInResponse | null>("last_check_in", null, {
  getOnInit: true,
});

const DAILY_XP_TARGET = 200;

export const $streak = atom((get) => get($lastCheckIn)?.new_streak ?? 0);

export const $dailyProgress = atom((get) => {
  const data = get($lastCheckIn);
  const current = data?.xp_earned ?? 0;
  return {
    current,
    target: DAILY_XP_TARGET,
    met: current >= DAILY_XP_TARGET,
  };
});

export const $dailyLessonProgress = atom((get) => ({
  current: get($lastCheckIn)?.lessons_completed ?? 0,
  target: 5,
}));

export const $dailyAccuracyProgress = atom((get) => ({
  current: get($lastCheckIn)?.high_accuracy_hits ?? 0,
  target: 5,
}));

export const $activeEvent = atom<ActiveEvent | null>(null);

export const $gemBalance = atom<number>(0);

export const $lastKnownRanks = atomWithSecureStore<Record<string, number>>(
  "last_known_ranks", {}, { getOnInit: true }
);

export const $rankAlertsEnabled = atomWithSecureStore<boolean>(
  "rank_alerts_enabled", false, { getOnInit: true }
);

export default store;
