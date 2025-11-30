import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@react-navigation/native";
import { CalendarIcon, FlameIcon, ZapIcon } from "lucide-react-native";
import tw from "twrnc";

import { Heatmap, Meter, Progress, Text } from "~/components";
import { useNavigationOptions } from "~/hooks";

const Header = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
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
        <View style={tw`flex-row items-center gap-1.5`}>
          <ZapIcon size={18} color={tw.color("sky-500")} fill={tw.color("sky-500")} />
          <Text style={tw`text-lg font-bold text-sky-500`}>4729</Text>
        </View>
      </View>
    </View>
  );
};

const StreakMeter = () => {
  return (
    <View style={tw`mt-4 items-center justify-center`}>
      <Meter percentage={80}>
        <View style={tw`flex-row items-center`}>
          <FlameIcon color={tw.color("orange-500")} fill={tw.color("orange-500")} size={36} />
          <Text style={tw`text-5xl font-bold leading-[0] tracking-tighter text-orange-500`}>12</Text>
        </View>
        <Text style={tw`text-center text-xl font-medium text-orange-500`}>Day Streak</Text>
      </Meter>
      <Text style={tw`text-base font-medium text-orange-500/80`}>3 days until next milestone</Text>
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
      <Text style={tw`text-center text-xl font-bold leading-tight`}>{`📢  ${message}`}</Text>
    </View>
  );
};

const ActivityCard = () => {
  const entries = [
    { date: new Date("2025-11-20"), count: 1 },
    { date: new Date("2025-11-21"), count: 6 },
    { date: new Date("2025-11-24"), count: 12 },
  ];
  return (
    <View style={tw`gap-4 rounded-2xl border-2 border-zinc-500/50 py-4`}>
      <Text style={tw`px-4 text-2xl font-bold`}>📊 Activity</Text>
      <Heatmap entries={entries} contentContainerStyle={tw`px-4`} />
    </View>
  );
};

const DailyGoalsCard = () => {
  return (
    <View style={tw`gap-4 rounded-2xl border-2 border-zinc-500/50 p-4`}>
      <Text style={tw`text-2xl font-bold`}>🎯 Daily Goals</Text>
      <View style={tw`gap-4`}>
        <Text style={tw`text-lg leading-tight`}>Complete 5 practices in Echo mode.</Text>
        <Progress value={3} total={5} />
      </View>
      <View style={tw`gap-4`}>
        <Text style={tw`text-lg leading-tight`}>Hit 85% accuracy 5 times in Echo mode.</Text>
        <Progress value={1} total={5} />
      </View>
    </View>
  );
};

export default function MainHomeScreen() {
  useNavigationOptions({ header: () => <Header /> });
  return (
    <ScrollView contentContainerStyle={tw`flex-1 gap-4 p-4`}>
      <StreakMeter />
      <WelcomeMessage />
      <ActivityCard />
      <DailyGoalsCard />
    </ScrollView>
  );
}
