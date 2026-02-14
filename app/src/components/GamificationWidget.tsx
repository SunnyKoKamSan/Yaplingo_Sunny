import { useEffect } from "react";
import { View } from "react-native";
import { useAtomValue } from "jotai";
import { FlameIcon } from "lucide-react-native";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import tw from "twrnc";

import { $dailyProgress, $streak } from "~/store";

import Text from "./Text";

export default function GamificationWidget() {
  const streak = useAtomValue($streak);
  const { current, target, met } = useAtomValue($dailyProgress);
  const goalMet = met || current >= target;

  const progress = useSharedValue(0);
  const targetPercentage = target > 0 ? Math.min(current / target, 1) : 0;

  useEffect(() => {
    progress.value = withTiming(targetPercentage, { duration: 1000 });
  }, [progress, targetPercentage]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
    backgroundColor: interpolateColor(
      progress.value,
      [0, 0.5, 1],
      ["#3b82f6", "#f97316", "#22c55e"], // blue-500 -> orange-500 -> green-500
    ),
  }));

  const streakActive = streak > 0;
  const streakColor = streakActive ? "text-orange-500" : "text-zinc-400";
  const flameColor = tw.color(streakActive ? "orange-500" : "zinc-400") ?? tw.color("zinc-400")!;

  return (
    <View style={tw`rounded-2xl bg-white p-4 dark:bg-zinc-900`}>
      <View style={tw`flex-row items-center justify-between`}>
        <Text style={tw`font-medium text-zinc-500`}>Daily Goal</Text>
        <View style={tw`flex-row items-center gap-1`}>
          <FlameIcon color={flameColor} fill={streakActive ? flameColor : "transparent"} size={16} />
          <Text style={tw.style("text-base font-bold", streakColor)}>{streak}</Text>
        </View>
      </View>
      <View style={tw`mt-3 h-3 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800`}>
        <Animated.View style={[tw`h-full rounded-full`, animatedStyle]} />
      </View>
      {goalMet ? (
        <Text style={tw`mt-2 text-sm font-medium text-green-500`}>🎉 Goal Complete!</Text>
      ) : (
        <Text style={tw`mt-2 text-sm font-medium text-zinc-500`}>{`${current} / ${target} XP`}</Text>
      )}
    </View>
  );
}
