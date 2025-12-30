import * as SecureStore from "expo-secure-store";
import { atom, getDefaultStore } from "jotai";
import { atomWithStorage, createJSONStorage } from "jotai/utils";
import { type SyncStringStorage } from "jotai/vanilla/utils/atomWithStorage";

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

export default store;
