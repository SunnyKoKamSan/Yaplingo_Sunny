import React from "react";
import { useTheme } from "@react-navigation/native";
import { Stack } from "expo-router";

export default function AccountLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerBackButtonMenuEnabled: false,
        headerBackButtonDisplayMode: "minimal",
        headerTintColor: theme.colors.primary,
        headerTitle: "yaplingo",
        headerTitleStyle: {
          fontSize: 24,
          fontWeight: "bold",
          fontFamily: "Feather-Bold",
        },
      }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="register" />
      <Stack.Screen name="login" />
    </Stack>
  );
}
