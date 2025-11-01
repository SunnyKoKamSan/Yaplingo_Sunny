import React from "react";
import { Stack } from "expo-router";
import tw from "twrnc";

export default function MainLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: tw.color("green-500"),
        headerTitle: "yaplingo",
        headerTitleStyle: {
          fontSize: 24,
          fontWeight: "bold",
          fontFamily: "Feather-Bold",
        },
      }}
    />
  );
}
