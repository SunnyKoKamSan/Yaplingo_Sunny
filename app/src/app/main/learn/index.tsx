import { Image, ScrollView, View, type ImageRequireSource } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@react-navigation/native";
import { useRouter } from "expo-router";
import tw from "twrnc";

import { Button, Text } from "~/components";
import { useNavigationOptions } from "~/hooks";

type Mode = {
  disabled?: boolean;
  href: string;
  title: string;
  description: string;
  icon: ImageRequireSource;
};

const MODES: Mode[] = [
  {
    href: "/main/learn/echo",
    title: "ECHO",
    description: "Read sentences of a given scenario and get feedback.",
    icon: require("@/icons/modes/echo.png"),
  },
  {
    disabled: true,
    href: "/main/learn/yap",
    title: "YAP",
    description: "Speak freely on a selected topic without a script.",
    icon: require("@/icons/modes/yap.png"),
  },
  {
    disabled: true,
    href: "/main/learn/chat",
    title: "CHAT",
    description: "Engage in a conversation with Yappie based on a selected scenario.",
    icon: require("@/icons/modes/chat.png"),
  },
];

const ModeCard = ({ mode }: { mode: Mode }) => {
  const router = useRouter();
  return (
    <View style={tw`rounded-2xl border-2 border-zinc-500/50`}>
      <View style={tw`w-5/6 gap-2 p-4`}>
        <Text style={tw`text-3xl font-bold tracking-wider`}>{mode.title}</Text>
        <Text style={tw`text-xl leading-tight`}>{mode.description}</Text>
      </View>
      <Image source={mode.icon} style={tw`absolute right-4 top-4 size-16`} />
      <Button
        disabled={mode.disabled}
        onPress={() => router.navigate(mode.href)}
        style={tw`m-4 bg-zinc-100 dark:bg-zinc-800`}>
        <Text style={tw`text-center text-base font-medium`}>{mode.disabled ? "COMING SOON" : "START"}</Text>
      </Button>
    </View>
  );
};

const Header = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        tw`relative flex-row border-b bg-green-50 p-6 dark:bg-green-950`,
        { paddingTop: insets.top + 16, borderColor: theme.colors.border },
      ]}>
      <View>
        <Text style={tw`text-4xl font-bold text-green-500`}>LEARN</Text>
        <Text style={tw`text-xl font-bold`}>choose your practice mode</Text>
      </View>
      <Image source={require("@/icons/tabs/learn.png")} style={[tw`absolute right-0 size-24`, { top: insets.top }]} />
    </View>
  );
};

export default function MainLearnIndexScreen() {
  useNavigationOptions({ header: () => <Header /> });
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={tw`flex-1 gap-4 px-4 py-6`}>
      {MODES.map((mode) => (
        <ModeCard key={mode.title} mode={mode} />
      ))}
    </ScrollView>
  );
}
