import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useAtomValue } from "jotai";

import { $authed } from "~/store";

const client = new QueryClient();

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const authed = useAtomValue($authed);

  const [loaded] = useFonts({
    "Feather-Bold": require("@/fonts/Feather-Bold.otf"),
  });

  React.useEffect(() => {
    if (loaded) SplashScreen.hide();
  });

  if (!loaded) return null;

  return (
    <QueryClientProvider client={client}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={authed}>
          <Stack.Screen name="main" />
        </Stack.Protected>
        <Stack.Protected guard={!authed}>
          <Stack.Screen name="(account)" />
        </Stack.Protected>
      </Stack>
    </QueryClientProvider>
  );
}
