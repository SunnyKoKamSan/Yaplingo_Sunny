import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { TrendingUpIcon, TrendingDownIcon } from "lucide-react-native";
import tw from "twrnc";

import { Text } from "~/components";

type Props = { delta: number | undefined };

export default function RankChangeIndicator({ delta }: Props) {
  const scale = useSharedValue(0);

  useEffect(() => {
    if (delta != null && delta !== 0) {
      scale.value = withSpring(1, { damping: 10, stiffness: 150, mass: 0.8 });
    }
  }, [delta, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (delta == null || delta === 0) return null;

  const isUp = delta > 0;

  return (
    <Animated.View
      entering={FadeInDown.duration(400)}
      style={[tw`flex-row items-center gap-0.5 ml-1`, animatedStyle]}
    >
      {isUp ? (
        <TrendingUpIcon size={14} color={tw.color("green-500")} />
      ) : (
        <TrendingDownIcon size={14} color={tw.color("red-500")} />
      )}
      <Text
        style={tw.style(
          "text-xs font-bold",
          isUp ? "text-green-500" : "text-red-500",
        )}
      >
        {Math.abs(delta)}
      </Text>
    </Animated.View>
  );
}
