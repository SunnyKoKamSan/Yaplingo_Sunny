import React from "react";
import { View, type ColorValue } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { useTheme } from "@react-navigation/native";
import tw from "twrnc";

export default function Meter({
  percentage,
  size = 200,
  thickness = 15,
  color,
  children,
}: {
  percentage: number;
  size?: number;
  thickness?: number;
  color?: ColorValue;
  children?: React.ReactNode;
}) {
  const theme = useTheme();
  const gradientId = React.useMemo(
    () => `meter-gradient-${Math.random().toString(36).slice(2, 10)}`,
    [],
  );

  const center = size / 2;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  const progress = Math.min(Math.max(percentage, 0), 100);
  const length = ((circumference / 2) * progress) / 100;
  const endpointAngle = Math.PI - (Math.PI * progress) / 100;
  const endpointX = center + radius * Math.cos(endpointAngle);
  const endpointY = center + radius * Math.sin(endpointAngle);
  const endpointStroke = tw.color("green-500") ?? "#22c55e";
  const endpointFill = tw.color(theme.dark ? "zinc-900" : "zinc-800") ?? "#27272a";
  const progressStroke = color ?? `url(#${gradientId})`;

  return (
    <View style={tw`items-center`}>
      <Svg width={size} height={center + thickness}>
        <Defs>
          <LinearGradient id={gradientId} x1="0%" y1="100%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#ff8a00" />
            <Stop offset="55%" stopColor="#ffd400" />
            <Stop offset="100%" stopColor="#4ade80" />
          </LinearGradient>
        </Defs>
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
          stroke={progressStroke}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${length}, ${circumference}`}
          d={`M ${thickness / 2}, ${center}
              A ${radius}, ${radius} 0 ${progress > 50 ? 1 : 0} 1 ${size - thickness / 2}, ${center}`}
        />
        {progress > 0 && (
          <Circle
            cx={endpointX}
            cy={endpointY}
            r={Math.max(8, thickness * 0.55)}
            fill={endpointFill}
            stroke={endpointStroke}
            strokeWidth={Math.max(3, thickness / 3)}
          />
        )}
      </Svg>
      <View style={[tw`absolute inset-x-0 bottom-0 items-center justify-center`, { height: center - thickness }]}>
        {children}
      </View>
    </View>
  );
}
