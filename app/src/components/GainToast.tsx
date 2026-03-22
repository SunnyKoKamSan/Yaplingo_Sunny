import { useEffect } from "react";
import { Pressable, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  FadeInDown,
  FadeOutUp,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import tw from "twrnc";

import Text from "./Text";

export default function GainToast({
  id,
  message,
  durationMs = 2400,
  onDone,
  style,
}: {
  id: string;
  message: string;
  durationMs?: number;
  onDone: (id: string) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const safeDurationMs = Math.max(300, durationMs);
  const progress = useSharedValue(1);

  useEffect(() => {
    progress.value = withSequence(
      withTiming(1, { duration: 60 }),
      withTiming(0, { duration: safeDurationMs }, (finished) => {
        if (finished) runOnJS(onDone)(id);
      }),
    );
  }, [id, onDone, progress, safeDurationMs]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, progress.value) * 100}%`,
  }));

  return (
    <Animated.View
      entering={FadeInDown.duration(220)}
      exiting={FadeOutUp.duration(220)}
      style={[
        tw`rounded-2xl border border-green-500/30 bg-zinc-900/95 px-4 py-3 shadow-xl`,
        style,
      ]}
      pointerEvents="none"
    >
      <Pressable pointerEvents="none">
        <Text style={tw`text-sm font-semibold text-white`}>{message}</Text>
      </Pressable>
      <Animated.View style={[tw`mt-2 h-1 rounded-full bg-green-400`, barStyle]} />
    </Animated.View>
  );
}
