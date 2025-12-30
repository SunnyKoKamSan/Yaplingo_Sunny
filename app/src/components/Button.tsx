import { Pressable, StyleSheet, type ColorValue, type PressableProps, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import tw from "twrnc";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function Button({
  style,
  children,
  shadowWidth,
  shadowColor,
  scaleDown = 0.95,
  ...props
}: {
  style?: ViewStyle;
  shadowWidth?: number;
  shadowColor?: ColorValue;
  scaleDown?: number;
} & Omit<PressableProps, "style">) {
  const {
    borderColor = tw.color("zinc-500/50")!,
    borderWidth = 2,
    borderBottomWidth = borderWidth,
    ...styles
  } = StyleSheet.flatten(style) ?? {};
  shadowWidth = shadowWidth ?? borderBottomWidth * 2.5;
  shadowColor = shadowColor ?? borderColor;

  const _scale = useSharedValue(1);
  const _shadowWidth = useSharedValue(!props.disabled ? shadowWidth : borderBottomWidth);
  const _shadowColor = useSharedValue(shadowColor);
  const astyle = useAnimatedStyle(() => ({
    transform: [{ scale: _scale.value }],
    borderBottomWidth: _shadowWidth.value,
    borderBottomColor: _shadowColor.value,
    marginTop: shadowWidth - _shadowWidth.value,
  }));

  return (
    <AnimatedPressable
      style={[
        tw.style("items-center rounded-xl py-2", props.disabled && "opacity-50"),
        { borderColor, borderWidth, borderBottomWidth },
        styles,
        astyle,
      ]}
      onPressIn={() => {
        if (props.disabled) return;
        _scale.value = withTiming(scaleDown, { duration: 100 });
        _shadowWidth.value = withTiming(borderBottomWidth, { duration: 100 });
        _shadowColor.value = withTiming(borderColor.toString(), { duration: 100 });
      }}
      onPressOut={() => {
        if (props.disabled) return;
        _scale.value = withTiming(1, { duration: 100 });
        _shadowWidth.value = withTiming(shadowWidth, { duration: 100 });
        _shadowColor.value = withTiming(shadowColor.toString(), { duration: 100 });
      }}
      {...props}>
      {children}
    </AnimatedPressable>
  );
}
