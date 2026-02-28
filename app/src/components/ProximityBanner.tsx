import { useCallback, useEffect } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { XIcon } from "lucide-react-native";
import tw from "twrnc";

import { Text } from "~/components";
import type { ProximityNeighbour } from "~/client/models";

type Props = {
  neighbour: ProximityNeighbour | null;
  onDismiss: () => void;
};

export default function ProximityBanner({ neighbour, onDismiss }: Props) {
  const translateY = useSharedValue(-80);

  const dismiss = useCallback(() => {
    translateY.value = withTiming(-80, { duration: 300 }, (finished) => {
      if (finished) runOnJS(onDismiss)();
    });
  }, [translateY, onDismiss]);

  useEffect(() => {
    if (neighbour && neighbour.xp_gap <= 50) {
      translateY.value = withSpring(0, { damping: 14, stiffness: 100 });
      // Auto-dismiss after 5 seconds
      const timer = setTimeout(dismiss, 5000);
      return () => clearTimeout(timer);
    }
  }, [neighbour, translateY, dismiss]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!neighbour || neighbour.xp_gap > 50) return null;

  return (
    <Animated.View
      style={[
        tw`absolute top-16 left-4 right-4 bg-orange-500 rounded-2xl p-3 flex-row items-center shadow-xl z-50`,
        animatedStyle,
      ]}
    >
      <View style={tw`flex-1`}>
        <Text style={tw`text-white font-bold text-sm`}>
          {neighbour.name} is only {neighbour.xp_gap} XP behind you!
        </Text>
      </View>
      <Pressable onPress={dismiss} hitSlop={8}>
        <XIcon size={18} color="white" />
      </Pressable>
    </Animated.View>
  );
}
