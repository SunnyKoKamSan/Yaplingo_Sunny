import React from "react";
import { View, type ColorValue } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useTheme } from "@react-navigation/native";
import tw from "twrnc";

export default function Meter({
  percentage,
  size = 200,
  thickness = 15,
  color = tw.color("orange-500"),
  pointerColor = tw.color("orange-500"),
  showPointer = false,
  children,
}: {
  percentage: number;
  size?: number;
  thickness?: number;
  color?: ColorValue;
  pointerColor?: ColorValue;
  showPointer?: boolean;
  children?: React.ReactNode;
}) {
  const theme = useTheme();

  const center = size / 2;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  const progress = Math.min(Math.max(percentage, 0), 100);
  const length = ((circumference / 2) * progress) / 100;
  const pointerAngle = Math.PI - (Math.PI * progress) / 100;
  const pointerX = center + radius * Math.cos(pointerAngle);
  const pointerY = center + radius * Math.sin(pointerAngle);

  return (
    <View style={tw`items-center`}>
      <Svg width={size} height={center + thickness}>
        <Path
          fill="transparent"
          stroke={tw.color(theme.dark ? "zinc-800" : "zinc-200")}
          strokeWidth={thickness}
          strokeLinecap="round"
          d={`M ${thickness / 2}, ${center}
              A ${radius}, ${radius} 0 1 1 ${size - thickness / 2}, ${center}`}
        />
        <Path
          fill="transparent"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${length}, ${circumference}`}
          d={`M ${thickness / 2}, ${center}
              A ${radius}, ${radius} 0 ${progress > 50 ? 1 : 0} 1 ${size - thickness / 2}, ${center}`}
        />
        {showPointer && (
          <Circle
            cx={pointerX}
            cy={pointerY}
            r={Math.max(4, thickness / 2.1)}
            fill={pointerColor}
            stroke={tw.color(theme.dark ? "zinc-900" : "white")}
            strokeWidth={2}
          />
        )}
      </Svg>
      <View style={[tw`absolute inset-x-0 bottom-0 items-center justify-center`, { height: center - thickness }]}>
        {children}
      </View>
    </View>
  );
}
