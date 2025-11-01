import React from "react";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { LoaderCircleIcon } from "lucide-react-native";

export default function Spinner({ size = 24, color = "white" }: { size?: number; color?: string }) {
  const rotation = useSharedValue(0);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotateZ: `${rotation.value}deg` }],
  }));

  React.useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, {
        duration: 1000,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
  }, [rotation]);

  return (
    <Animated.View style={style}>
      <LoaderCircleIcon size={size} color={color} />
    </Animated.View>
  );
}
