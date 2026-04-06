import { Stack } from "expo-router";

export default function MainLeaderboardLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="profile"
        options={{
          presentation: "modal",
          headerShown: true,
        }}
      />
    </Stack>
  );
}
