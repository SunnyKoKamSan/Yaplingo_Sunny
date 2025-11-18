import React from "react";
import { Image, ImageRequireSource, View } from "react-native";
import { Tabs } from "expo-router";
import tw from "twrnc";

type Tab = {
  href: string;
  title: string;
  icon: ImageRequireSource;
};

const TABS: Record<string, Tab> = {
  index: {
    href: "./",
    title: "Home",
    icon: require("@/icons/tabs/home.png"),
  },
  learn: {
    href: "./learn",
    title: "Learn",
    icon: require("@/icons/tabs/learn.png"),
  },
  community: {
    href: "./community",
    title: "Community",
    icon: require("@/icons/tabs/community.png"),
  },
  profile: {
    href: "./profile",
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
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: tw`h-22 border-t-2 pt-4`,
      }}>
      {Object.entries(TABS).map(([name, tab]) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            headerTitle: tab.title,
            tabBarIcon: ({ focused }) => <TabBarIcon tab={tab} focused={focused} />,
          }}
        />
      ))}
    </Tabs>
  );
}
