import { View, type ColorValue, type ViewProps } from "react-native";
import tw from "twrnc";

export default function Progress({
  value,
  total,
  thickness = 8,
  color = tw.color("green-500"),
  style,
  ...props
}: {
  value: number;
  total: number;
  thickness?: number;
  color?: ColorValue;
} & ViewProps) {
  return (
    <View style={[tw`flex-row gap-0.5 rounded-full`, style]} {...props}>
      {Array.from({ length: total }).map((_, index) => (
        <View
          key={index}
          style={tw.style(
            "flex-1",
            { height: thickness },
            index === 0 && "rounded-l-full",
            index === total - 1 && "rounded-r-full",
            index < value ? { backgroundColor: color } : "bg-zinc-200 dark:bg-zinc-800",
          )}
        />
      ))}
    </View>
  );
}
