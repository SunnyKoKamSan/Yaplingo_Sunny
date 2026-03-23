import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useAtomValue } from "jotai";
import Animated, {
  FadeInRight,
  FadeOutRight,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import tw from "twrnc";

import { $activeEvent } from "~/store";

import Text from "./Text";

const PURCHASE_EVENT_WINDOW_MS = 2 * 60 * 1000;
const BANNER_VISIBLE_MS = 2200;

const hasTimezone = (value: string): boolean =>
  /(?:[zZ]|[+-]\d{2}:\d{2})$/.test(value);

const parseServerUtcMs = (value: string): number => {
  const normalized = hasTimezone(value) ? value : `${value}Z`;
  return new Date(normalized).getTime();
};

const formatMultiplier = (value: number): string =>
  Number.isInteger(value) ? `${value}` : value.toFixed(1).replace(/\.0$/, "");

export default function EventBanner() {
  const insets = useSafeAreaInsets();
  const event = useAtomValue($activeEvent);
  const [visibleEvent, setVisibleEvent] = useState<{ id: number; multiplier: number } | null>(null);
  const shownEventIdsRef = useRef(new Set<number>());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!event) return;
    if (shownEventIdsRef.current.has(event.id)) return;

    const now = Date.now();
    const startsAtMs = parseServerUtcMs(event.starts_at);
    const endsAtMs = parseServerUtcMs(event.ends_at);
    if (!Number.isFinite(startsAtMs) || !Number.isFinite(endsAtMs) || endsAtMs <= now) {
      shownEventIdsRef.current.add(event.id);
      return;
    }

    shownEventIdsRef.current.add(event.id);

    // Treat newly started events as purchase-triggered boosts and show the one-time indicator.
    if (now - startsAtMs > PURCHASE_EVENT_WINDOW_MS) return;

    setVisibleEvent({ id: event.id, multiplier: event.multiplier });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setVisibleEvent(null);
    }, BANNER_VISIBLE_MS);
  }, [event]);

  if (!visibleEvent) return null;

  return (
    <View
      pointerEvents="none"
      style={[tw`absolute z-50`, { top: insets.top + 8, right: 12 }]}
    >
      <Animated.View
        key={visibleEvent.id}
        entering={FadeInRight.duration(180)}
        exiting={FadeOutRight.duration(180)}
        style={tw`rounded-full bg-violet-600 px-3 py-2 shadow-lg`}
      >
        <Text style={tw`text-[11px] font-extrabold text-white`}>
          {`${formatMultiplier(visibleEvent.multiplier)}x XP BOOSTING!!!`}
        </Text>
      </Animated.View>
    </View>
  );
}
