import { Stack } from "expo-router";

export default function MainLearnLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: "fullScreenModal",
      }}>
      <Stack.Screen
        name="index"
        options={{
          headerShown: true,
          presentation: "card",
        }}
      />
      <Stack.Screen name="echo" />
      <Stack.Screen name="yap" />
      <Stack.Screen name="chat" />
    </Stack>
  );
}
