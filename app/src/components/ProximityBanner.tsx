import { useCallback, useEffect } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { XIcon, TrendingUpIcon } from "lucide-react-native";
import tw from "twrnc";

import { Text } from "~/components";
import type { ProximityNeighbour } from "~/client/models";

type Props = {
  neighbour: ProximityNeighbour | null;
  onDismiss: () => void;
};

export default function ProximityBanner({ neighbour, onDismiss }: Props) {
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(1);

  const dismiss = useCallback(() => {
    translateY.value = withTiming(-100, { duration: 300 });
    opacity.value = withTiming(0, { duration: 300 });
    scale.value = withTiming(1, { duration: 300 }, (finished) => {
      if (finished) runOnJS(onDismiss)();
    });
  }, [translateY, opacity, scale, onDismiss]);

  useEffect(() => {
    if (neighbour && neighbour.xp_gap <= 50) {
      translateY.value = withSpring(0, { damping: 16, stiffness: 120 });
      opacity.value = withTiming(1, { duration: 250 });
      scale.value = withTiming(0.9, { duration: 250 });
      const timer = setTimeout(dismiss, 5000);
      return () => clearTimeout(timer);
    }
  }, [neighbour, translateY, opacity, scale, dismiss]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!neighbour || neighbour.xp_gap > 50) return null;

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          top: 64,
          left: 16,
          right: 16,
          zIndex: 50,
          borderRadius: 20,
          backgroundColor: "#0f172a",
          paddingHorizontal: 16,
          paddingVertical: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.28,
          shadowRadius: 18,
          elevation: 14,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.06)",
        },
        animatedStyle,
      ]}
    >
      {/* Icon badge */}
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          backgroundColor: "rgba(34,197,94,0.12)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <TrendingUpIcon size={22} color="#22c55e" strokeWidth={2.5} />
      </View>

      {/* Text */}
      <View style={tw`flex-1`}>
        <Text style={{ color: "#f1f5f9", fontWeight: "700", fontSize: 15, lineHeight: 20 }}>
          Stay ahead! 🏃
        </Text>
        <Text style={{ color: "#94a3b8", fontSize: 13, lineHeight: 18, marginTop: 2 }}>
          {neighbour.name} is only {neighbour.xp_gap} XP behind you
        </Text>
      </View>

      {/* Dismiss */}
      <Pressable
        onPress={dismiss}
        hitSlop={10}
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          backgroundColor: "rgba(255,255,255,0.04)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <XIcon size={16} color="#94a3b8" strokeWidth={2.5} />
      </Pressable>
    </Animated.View>
  );
}
