import React from "react";
import { Stack } from "expo-router";
import tw from "twrnc";

export default function AccountLayout() {
  return (
    <Stack
      screenOptions={{
        headerBackButtonMenuEnabled: false,
        headerBackButtonDisplayMode: "minimal",
        headerTintColor: tw.color("green-500"),
        headerTitle: "yaplingo",
        headerTitleStyle: {
          fontSize: 24,
          fontWeight: "bold",
          fontFamily: "Feather-Bold",
        },
        contentStyle: { backgroundColor: tw.color("white") },
      }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="register" />
      <Stack.Screen name="login" />
    </Stack>
  );
}
