import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAtomValue } from "jotai";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import tw from "twrnc";

import { $activeEvent } from "~/store";

import Text from "./Text";

function formatRemaining(ms: number): string {
  if (ms <= 0) return "Ended";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (parts.length === 0 || (d === 0 && h === 0)) parts.push(`${sec}s`);
  return parts.join(" ");
}

export default function EventBanner({ onExpire }: { onExpire?: () => void }) {
  const event = useAtomValue($activeEvent);
  const [remaining, setRemaining] = useState("");

  // Animations
  const translateY = useSharedValue(-60);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!event) return;
    translateY.value = withSpring(0, { damping: 14, stiffness: 120 });
    opacity.value = withRepeat(
      withSequence(withTiming(0.85, { duration: 800 }), withTiming(1.0, { duration: 800 })),
      -1,
      true,
    );
  }, [event, translateY, opacity]);

  const handleExpire = useCallback(() => {
    translateY.value = withTiming(-60, { duration: 300 });
    setTimeout(() => onExpire?.(), 300);
  }, [onExpire, translateY]);

  useEffect(() => {
    if (!event) return;
    const tick = () => {
      const ms = new Date(event.ends_at).getTime() - Date.now();
      if (ms <= 0) {
        setRemaining("Ended");
        handleExpire();
        return;
      }
      setRemaining(formatRemaining(ms));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [event, handleExpire]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!event) return null;

  return (
    <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(300)} style={[tw`w-full z-50`, animatedStyle]}>
      <LinearGradient colors={["#f59e0b", "#ef4444"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={tw`px-4 py-2 flex-row items-center justify-between`}>
        <View style={tw`flex-row items-center gap-2`}>
          <Text style={tw`text-white font-bold text-sm`}>{event.name}</Text>
          <View style={tw`bg-white/25 rounded-full px-2 py-0.5`}>
            <Text style={tw`text-white font-bold text-xs`}>{event.multiplier}x</Text>
          </View>
        </View>
        <Text style={tw`text-white font-medium text-xs`}>Ends in {remaining}</Text>
      </LinearGradient>
    </Animated.View>
  );
}
