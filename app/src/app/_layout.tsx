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
    background: tw.color("white")!,
    card: tw.color("neutral-50")!,
    text: tw.color("black")!,
    border: tw.color("neutral-200")!,
    notification: tw.color("sky-500")!,
  },
};

const DarkTheme = {
  ...NavigationDarkTheme,
  colors: {
    primary: tw.color("green-500")!,
    background: tw.color("slate-950")!,
    card: tw.color("slate-950")!,
    text: tw.color("neutral-50")!,
    border: tw.color("neutral-800")!,
    notification: tw.color("sky-500")!,
  },
};

const client = new QueryClient();

SplashScreen.preventAutoHideAsync();

const Layout = () => {
  const authed = useAtomValue($authed);

  const [loaded] = useFonts({
    "Feather-Bold": require("@/fonts/Feather-Bold.otf"),
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
