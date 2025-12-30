import React from "react";
import { View, type ColorValue } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useTheme } from "@react-navigation/native";
import tw from "twrnc";

export default function Meter({
  percentage,
  size = 200,
  thickness = 15,
  color = tw.color("orange-500"),
  children,
}: {
  percentage: number;
  size?: number;
  thickness?: number;
  color?: ColorValue;
  children?: React.ReactNode;
}) {
  const theme = useTheme();

  const center = size / 2;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  const progress = Math.min(Math.max(percentage, 0), 100);
  const length = ((circumference / 2) * progress) / 100;

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
      </Svg>
      <View style={[tw`absolute inset-x-0 bottom-0 items-center justify-center`, { height: center - thickness }]}>
        {children}
      </View>
    </View>
  );
}
