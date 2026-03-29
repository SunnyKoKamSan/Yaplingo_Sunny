import { useEffect } from "react";
import { Image } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
  useDerivedValue,
  useAnimatedReaction,
} from "react-native-reanimated";
import { useAtomValue } from "jotai";
import tw from "twrnc";

import { $gemBalance } from "~/store";

import Text from "./Text";

const AnimatedText = Animated.createAnimatedComponent(Text);
const GEM_ICON_SOURCE = require("../../assets/gem.png");

export default function GemCounter({ style }: { style?: object }) {
  const balance = useAtomValue($gemBalance);
  const animatedBalance = useSharedValue(balance);
  const displayScale = useSharedValue(1);
  const displayValue = useSharedValue(balance);

  useEffect(() => {
    const prev = animatedBalance.value;
    animatedBalance.value = withTiming(balance, { duration: 600 });
    if (balance > prev) {
      displayScale.value = withSequence(
        withSpring(1.25, { damping: 6, stiffness: 200 }),
        withSpring(1, { damping: 10, stiffness: 150 }),
      );
    }
  }, [balance, animatedBalance, displayScale]);

  useAnimatedReaction(
    () => Math.round(animatedBalance.value),
    (current) => {
      displayValue.value = current;
    },
  );

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: displayScale.value }],
  }));

  return (
    <Animated.View
      style={[
        tw`flex-row items-center gap-2 rounded-2xl px-4 py-2`,
        {
          backgroundColor: "rgba(24, 24, 27, 0.9)",
          borderWidth: 1.5,
          borderColor: "rgba(255, 255, 255, 0.15)",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 6,
        },
        scaleStyle,
        style,
      ]}
    >
      <Image source={GEM_ICON_SOURCE} resizeMode="contain" style={{ width: 22, height: 22 }} />
      <Text style={[tw`text-lg font-bold`, { color: "#FFFFFF", letterSpacing: 0.5 }]}>
        {balance.toLocaleString()}
      </Text>
    </Animated.View>
  );
}
