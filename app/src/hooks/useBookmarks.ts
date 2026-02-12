import { useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { AppState } from "react-native";

const STORAGE_KEY = "yaplingo:bookmarks:v1";
let mmkv: any = null;
try {
  // require dynamically because native module may not be available in plain Expo Go
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { MMKV } = require("react-native-mmkv");
  mmkv = new MMKV({ id: "yaplingo_bookmarks" });
} catch (e) {
  mmkv = null;
}

export type Bookmarks = Record<string, string[]>;

// Module-level cache + subscribers so multiple hook instances stay in sync.
let cached: Bookmarks | null = null;
let initialized = false;
const subs = new Set<() => void>();

const notify = () => subs.forEach((s) => s());

async function loadFromStorage() {
  try {
    // prefer fast local mmkv copy if available
    if (mmkv) {
      const mm = mmkv.getString(STORAGE_KEY);
      if (mm) {
        cached = JSON.parse(mm);
      } else {
        const raw = await SecureStore.getItemAsync(STORAGE_KEY);
        cached = raw ? JSON.parse(raw) : {};
        // mirror to mmkv for faster access
        try {
          mmkv.set(STORAGE_KEY, JSON.stringify(cached));
        } catch (e) {
          // ignore mmkv write errors
        }
      }
    } else {
      const raw = await SecureStore.getItemAsync(STORAGE_KEY);
      cached = raw ? JSON.parse(raw) : {};
    }
  } catch (e) {
    cached = {};
  }
  initialized = true;
  notify();
}

async function writeToStorage(next: Bookmarks) {
  try {
    // write both secure store and mmkv as a backup
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next));
    if (mmkv) {
      try {
        mmkv.set(STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        // ignore mmkv write errors
      }
    }
    cached = next;
    notify();
  } catch (e) {
    // still update cache so UI reflects change
    if (mmkv) {
      try {
        mmkv.set(STORAGE_KEY, JSON.stringify(next));
      } catch (er) {
        // ignore
      }
    }
    cached = next;
    notify();
  }
}

export default function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<Bookmarks>(cached ?? {});
  const [loading, setLoading] = useState(!initialized);

  useEffect(() => {
    let mounted = true;
    const subscriber = () => {
      if (!mounted) return;
      setBookmarks(cached ?? {});
      setLoading(!initialized);
    };
    subs.add(subscriber);
    // if not initialized, kick off load
    if (!initialized) loadFromStorage();
    else {
      // ensure local state is up to date
      setBookmarks(cached ?? {});
      setLoading(false);
    }
    // reload from storage when app resumes (helps when user signs out/in or app restarts)
    const onStateChange = (next: string) => {
      if (next === "active") {
        loadFromStorage();
      }
    };
  const appStateSub = AppState.addEventListener("change", onStateChange);
    return () => {
      mounted = false;
      subs.delete(subscriber);
      try {
        appStateSub.remove();
      } catch (e) {
        // ignore
      }
    };
  }, []);

  const addBookmark = async (topic: string, sentence: string) => {
    if (!topic || !sentence) return;
    // ensure latest data
    if (!initialized) await loadFromStorage();
    const current = cached ?? {};
    const list = current[topic] ?? [];
    if (list.includes(sentence)) return;
    const next = { ...current, [topic]: [...list, sentence] };
    await writeToStorage(next);
  };

  const removeBookmark = async (topic: string, sentence: string) => {
    if (!initialized) await loadFromStorage();
    const current = cached ?? {};
    const list = (current[topic] ?? []).filter((s) => s !== sentence);
    const next = { ...current } as Bookmarks;
    if (list.length) next[topic] = list;
    else delete next[topic];
    await writeToStorage(next);
  };

  const clearAll = async () => {
    cached = {};
    try {
      await SecureStore.deleteItemAsync(STORAGE_KEY);
    } catch (e) {
      // ignore
    }
    if (mmkv) {
      try {
        mmkv.delete(STORAGE_KEY);
      } catch (e) {
        // ignore
      }
    }
    notify();
  };

  return { bookmarks, loading, addBookmark, removeBookmark, clearAll } as const;
}
