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
        tw`flex-row items-center gap-1.5 rounded-full bg-green-600/15 px-3 py-1.5 border border-green-400/30`,
        scaleStyle,
        style,
      ]}
    >
      <Image source={GEM_ICON_SOURCE} resizeMode="contain" style={{ width: 16, height: 16 }} />
      <Text style={tw`text-base font-bold text-green-700 dark:text-green-300`}>
        {balance.toLocaleString()}
      </Text>
    </Animated.View>
  );
}
