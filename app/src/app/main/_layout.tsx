import { useEffect } from "react";
import { AppState, Image, View, type ImageRequireSource } from "react-native";
import { Tabs } from "expo-router";
import { useSetAtom } from "jotai";
import tw from "twrnc";

import { useActiveEventsQuery, usePrefetchLeaderboard } from "~/client";
import client from "~/client/client";
import store, { $activeEvent, $rankAlertsEnabled } from "~/store";

type Tab = {
  header?: boolean;
  title: string;
  icon: ImageRequireSource;
};

const TABS: Record<string, Tab> = {
  index: {
    title: "Home",
    icon: require("@/icons/tabs/home.png"),
  },
  learn: {
    header: false,
    title: "Learn",
    icon: require("@/icons/tabs/learn.png"),
  },
  progress: {
    header: false,
    title: "Progress",
    icon: require("@/icons/tabs/progress.png"),
  },
  community: {
    title: "Community",
    icon: require("@/icons/tabs/community.png"),
  },
  profile: {
    title: "Profile",
    icon: require("@/icons/tabs/profile.png"),
  },
};

const TabBarIcon = ({ tab, focused }: { tab: Tab; focused: boolean }) => (
  <View style={tw.style("rounded-xl border-2 border-transparent p-1.5", focused && "border-sky-500/50 bg-sky-500/10")}>
    <Image source={tab.icon} style={tw`size-7`} />
  </View>
);

export default function MainLayout() {
  const prefetchLeaderboard = usePrefetchLeaderboard();
  const { data: events } = useActiveEventsQuery();
  const setActiveEvent = useSetAtom($activeEvent);

  useEffect(() => {
    setActiveEvent(events?.[0] ?? null);
  }, [events, setActiveEvent]);

  // Schedule local notification when app gains focus and a rival is close
  useEffect(() => {
    const subscription = AppState.addEventListener("change", async (state) => {
      if (state !== "active") return;
      const alertsEnabled = store.get($rankAlertsEnabled);
      if (!alertsEnabled) return;
      try {
        const Notifications = await import("expo-notifications");
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== "granted") return;
        const { data } = await client.get("/gamification/leaderboard/proximity");
        const below = data?.below?.[0];
        if (below && below.xp_gap <= 50) {
          await Notifications.dismissAllNotificationsAsync();
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "Someone's catching up!",
              body: `${below.name} is only ${below.xp_gap} XP behind. Study now!`,
              sound: true,
            },
            trigger: null, // immediate
          });
        }
      } catch {
        // Fail silently — proximity fetch or notification may not be available
      }
    });
    return () => subscription.remove();
  }, []);
    // Future: push via Expo Push Service (NOT in scope for Week 15).
  // Infrastructure needed:
  //   - Backend: POST /notifications/register device token endpoint
  //   - Backend: APScheduler or Celery cron job for hourly proximity checks
  //   - Expo Push Service API calls with APNs/FCM credentials
  //   - Frontend: push token registration on app launch

  return (
    <View style={tw`flex-1`}>
      <Tabs
      screenOptions={{
        tabBarShowLabel: false,
        tabBarStyle: tw`h-22 border-t-2 pt-4`,
        headerTitleStyle: [tw`text-2xl tracking-tight`, { fontFamily: "DINNextRoundedLTW01-Medium" }],
      }}>
      {Object.entries(TABS).map(([name, tab]) => (
        <Tabs.Screen
          key={name}
          name={name}
          listeners={
            name === "community"
              ? {
                  tabPress: () => {
                    prefetchLeaderboard();
                  },
                }
              : undefined
          }
          options={{
            headerTitle: tab.title,
            headerShown: tab.header ?? true,
            tabBarIcon: ({ focused }) => <TabBarIcon tab={tab} focused={focused} />,
          }}
        />
      ))}
      </Tabs>
    </View>
  );
}
