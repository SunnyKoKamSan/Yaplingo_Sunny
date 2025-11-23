import { Stack } from "expo-router";

export default function AccountLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ presentation: "modal" }} />
      <Stack.Screen name="login" options={{ presentation: "modal" }} />
    </Stack>
  );
}
