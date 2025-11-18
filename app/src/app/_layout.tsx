import React from "react";
import { Alert, useColorScheme } from "react-native";
import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationDefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useAtomValue } from "jotai";
import tw, { useDeviceContext } from "twrnc";

import { useAuthCheck } from "~/hooks";
import { $authed } from "~/store";

const DefaultTheme = {
  ...NavigationDefaultTheme,
  colors: {
    primary: tw.color("green-500")!,
    background: tw.color("zinc-50")!,
    card: tw.color("zinc-100")!,
    text: tw.color("black/80")!,
    border: tw.color("zinc-500/50")!,
    notification: tw.color("sky-500")!,
  },
};

const DarkTheme = {
  ...NavigationDarkTheme,
  colors: {
    primary: tw.color("green-500")!,
    background: tw.color("zinc-900")!,
    card: tw.color("zinc-950")!,
    text: tw.color("white/80")!,
    border: tw.color("zinc-500/50")!,
    notification: tw.color("sky-500")!,
  },
};

const client = new QueryClient();

SplashScreen.preventAutoHideAsync();

const Layout = () => {
  const authed = useAtomValue($authed);

  const [loaded] = useFonts({
    "Feather-Bold": require("@/fonts/Feather-Bold.otf"),
    "DINNextRoundedLTW01-Light": require("@/fonts/DINNextRoundedLTW01-Light.otf"),
    "DINNextRoundedLTW01-Regular": require("@/fonts/DINNextRoundedLTW01-Regular.otf"),
    "DINNextRoundedLTW01-Medium": require("@/fonts/DINNextRoundedLTW01-Medium.otf"),
    "DINNextRoundedLTW01-Bold": require("@/fonts/DINNextRoundedLTW01-Bold.otf"),
  });

  const [checking, error] = useAuthCheck();
  const isValidError = error === null || error.status === 401 || error.status === 403;

  React.useEffect(() => {
    if (loaded && !checking && isValidError) {
      SplashScreen.hide();
    }
  }, [loaded, checking, isValidError]);

  React.useEffect(() => {
    if (!isValidError) {
      Alert.alert(error.message);
    }
  }, [error, isValidError]);

  if (!loaded || checking || !isValidError) return <></>;

  return (
    <Stack
      key={tw.memoBuster}
      screenOptions={{
        headerShown: false,
        animation: "fade",
      }}>
      <Stack.Protected guard={authed}>
        <Stack.Screen name="main" />
      </Stack.Protected>
      <Stack.Protected guard={!authed}>
        <Stack.Screen name="(account)" />
      </Stack.Protected>
    </Stack>
  );
};

export default function RootLayout() {
  useDeviceContext(tw);

  const scheme = useColorScheme();
  const theme = scheme === "dark" ? DarkTheme : DefaultTheme;

  return (
    <ThemeProvider value={theme}>
      <QueryClientProvider client={client}>
        <Layout />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
