import { Image, View, type ImageRequireSource } from "react-native";
import { Tabs } from "expo-router";
import tw from "twrnc";

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
  return (
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
          options={{
            headerTitle: tab.title,
            headerShown: tab.header ?? true,
            tabBarIcon: ({ focused }) => <TabBarIcon tab={tab} focused={focused} />,
          }}
        />
      ))}
    </Tabs>
  );
}
