import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@react-navigation/native";
import { CalendarIcon, FlameIcon, ZapIcon } from "lucide-react-native";
import tw from "twrnc";

import { useAuthedUserQuery } from "~/client";
import { Heatmap } from "~/components";
import { Text } from "~/components/primitives";
import { useNavigationOptions } from "~/hooks";
import { formatCompactNumber } from "~/utils";

const Header = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const query = useAuthedUserQuery();

  return (
    <View
      style={[
        tw`border-b pb-2`,
        {
          paddingTop: insets.top,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.card,
        },
      ]}>
      <View style={tw`h-10 flex-row items-center justify-between px-4`}>
        <View style={tw`flex-row items-center gap-1.5`}>
          <CalendarIcon size={18} strokeWidth={2.5} color={theme.colors.text} />
          <Text style={tw`text-lg font-medium`}>
            {new Date().toLocaleDateString("en-GB", { month: "short", day: "numeric" })}
          </Text>
        </View>
        <View style={tw`absolute inset-x-0 items-center justify-center`}>
          <Text style={[tw`text-3xl leading-[0] text-green-500`, { fontFamily: "Feather-Bold" }]}>yaplingo</Text>
        </View>
        {query.isSuccess && (
          <View style={tw`flex-row items-center gap-1.5 rounded-full bg-sky-500/25 px-2 py-0.5`}>
            <ZapIcon size={16} color={tw.color("sky-500")} fill={tw.color("sky-500")} />
            <Text style={tw`text-lg font-bold text-sky-500`}>{formatCompactNumber(query.data.points)}</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const StreakMeter = () => {
  return (
    <View style={tw`mt-4 items-center justify-center`}>
      <View style={tw`flex-row items-center`}>
        <FlameIcon color={tw.color("orange-500")} fill={tw.color("orange-500")} size={36} />
        <Text style={tw`text-5xl font-bold leading-[0] tracking-tighter text-orange-500`}>12</Text>
      </View>
      <Text style={tw`text-center text-xl font-medium text-orange-500`}>Day Streak</Text>
    </View>
  );
};

const WELCOME_MESSAGES = [
  "Let’s nail those tricky sounds today!",
  "Time to train those tongue muscles!",
  "Let’s make your words shine today!",
  "What are we practicing today?",
  "Ready to crush some goals?",
  "Good to have you back!",
];

const WelcomeMessage = () => {
  const message = WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)];
  return (
    <View style={tw`mx-4 items-center`}>
      <Text style={tw`text-center text-lg font-medium leading-tight`}>{`📢  ${message}`}</Text>
    </View>
  );
};

const ActivityCard = () => {
  const query = useAuthedUserQuery();
  return (
    <View style={tw`gap-4 rounded-2xl border-2 border-zinc-500/50 py-2.5`}>
      <Text style={tw`px-4 text-2xl font-bold`}>Activity</Text>
      <Heatmap entries={query.data?.activity ?? {}} contentContainerStyle={tw`px-4`} />
    </View>
  );
};

export default function MainHomeScreen() {
  useNavigationOptions({ header: () => <Header /> });
  return (
    <ScrollView alwaysBounceVertical={false} contentContainerStyle={tw`flex-1 gap-8 p-4`}>
      <StreakMeter />
      <WelcomeMessage />
      <ActivityCard />
    </ScrollView>
  );
}
