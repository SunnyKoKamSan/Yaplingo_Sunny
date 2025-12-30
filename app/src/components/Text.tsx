import { Text as _Text, StyleSheet, type TextProps } from "react-native";
import { useTheme } from "@react-navigation/native";

export default function Text({ style, children, ...props }: TextProps) {
  const theme = useTheme();
  const { fontFamily, fontWeight, ...styles } = StyleSheet.flatten(style) ?? {};
  return (
    <_Text
      style={[
        {
          fontWeight,
          fontFamily:
            fontFamily ??
            {
              300: "DINNextRoundedLTW01-Light",
              400: "DINNextRoundedLTW01-Regular",
              500: "DINNextRoundedLTW01-Medium",
              bold: "DINNextRoundedLTW01-Bold",
            }[String(fontWeight)] ??
            "DINNextRoundedLTW01-Regular",
          color: theme.colors.text,
        },
        styles,
      ]}
      {...props}>
      {children}
    </_Text>
  );
}
