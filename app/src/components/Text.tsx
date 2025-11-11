import { Text as _Text, type TextProps } from "react-native";
import { useTheme } from "@react-navigation/native";

export default function Text({ style, children, ...props }: TextProps) {
  const theme = useTheme();
  return (
    <_Text style={[{ color: theme.colors.text }, style]} {...props}>
      {children}
    </_Text>
  );
}
