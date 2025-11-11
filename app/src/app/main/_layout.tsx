import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@react-navigation/native";
import { Tabs } from "expo-router";
import { BookOpenTextIcon, HomeIcon, ShapesIcon, UserIcon } from "lucide-react-native";
import tw from "twrnc";

const TABS = {
  index: {
    title: "Home",
    Icon: HomeIcon,
  },
  learn: {
    title: "Learn",
    Icon: BookOpenTextIcon,
  },
  community: {
    title: "Community",
    Icon: ShapesIcon,
  },
  profile: {
    title: "Profile",
    Icon: UserIcon,
  },
};

export default function MainLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { height: insets.top + 55 },
        headerTintColor: theme.colors.primary,
        headerTitleAlign: "left",
        headerTitleStyle: {
          fontSize: 32,
          fontWeight: "bold",
          fontFamily: "Feather-Bold",
        },
        tabBarShowLabel: false,
        tabBarStyle: tw`pt-1.5`,
      }}>
      {Object.entries(TABS).map(([name, { title, Icon }]) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            headerTitle: title,
            tabBarIcon: ({ color }) => <Icon color={color} size={26} />,
          }}
        />
      ))}
    </Tabs>
  );
}
