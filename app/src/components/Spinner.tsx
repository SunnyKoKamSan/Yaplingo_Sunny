import React from "react";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { LoaderCircleIcon } from "lucide-react-native";
import tw from "twrnc";

export default function Spinner({ size = 24, color = tw.color("green-500/50") }: { size?: number; color?: string }) {
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
