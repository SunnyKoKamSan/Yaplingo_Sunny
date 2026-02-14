import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@react-navigation/native";
import { useAtomValue } from "jotai";
import { CalendarIcon, FlameIcon, ZapIcon } from "lucide-react-native";
import tw from "twrnc";

import { useDailyProgressQuery, useMyRankQuery } from "~/client";
import { Heatmap, Meter, Progress, Text } from "~/components";
import { useNavigationOptions } from "~/hooks";
import { $dailyAccuracyProgress, $dailyLessonProgress, $dailyProgress } from "~/store";

const STREAK_MILESTONE_STEP = 5;
const formatXP = (xp: number) => xp.toLocaleString();

const Header = ({ totalXP, isLoading }: { totalXP: number; isLoading: boolean }) => {
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
          <Text style={tw`text-lg font-bold text-sky-500`}>{isLoading ? "..." : formatXP(totalXP)}</Text>
        </View>
      </View>
    </View>
  );
};

const StreakMeter = ({ streak }: { streak: number }) => {
  const safeStreak = Math.max(streak, 0);
  const nextMilestone =
    safeStreak === 0
      ? STREAK_MILESTONE_STEP
      : safeStreak % STREAK_MILESTONE_STEP === 0
        ? safeStreak + STREAK_MILESTONE_STEP
        : safeStreak + (STREAK_MILESTONE_STEP - (safeStreak % STREAK_MILESTONE_STEP));
  const daysToNextMilestone = nextMilestone - safeStreak;
  const progressPercentage = nextMilestone > 0 ? (safeStreak / nextMilestone) * 100 : 0;
  const streakActive = safeStreak > 0;
  const streakColor = streakActive ? "text-orange-500" : "text-zinc-400";
  const flameColor = tw.color(streakActive ? "orange-500" : "zinc-400") ?? tw.color("zinc-400")!;

  return (
    <View style={tw`mt-4 items-center justify-center`}>
      <Meter
        percentage={progressPercentage}
        color={flameColor}
        pointerColor={flameColor}
        showPointer>
        <View style={tw`flex-row items-center`}>
          <FlameIcon color={flameColor} fill={streakActive ? flameColor : "transparent"} size={36} />
          <Text style={tw.style("text-5xl font-bold leading-[0] tracking-tighter", streakColor)}>{safeStreak}</Text>
        </View>
        <Text style={tw.style("text-center text-xl font-medium", streakColor)}>Day Streak</Text>
      </Meter>
      <Text style={tw.style("text-base font-medium", streakActive ? "text-orange-500/80" : "text-zinc-500")}>
        {`${daysToNextMilestone} day${daysToNextMilestone === 1 ? "" : "s"} until next milestone`}
      </Text>
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
  const { current, target } = useAtomValue($dailyProgress);
  const lessonProgress = useAtomValue($dailyLessonProgress);
  const accuracyProgress = useAtomValue($dailyAccuracyProgress);
  const totalSegments = 5;
  const dailyGoalSegments = Math.min(Math.floor((current / target) * totalSegments), totalSegments);
  const lessonsCompleted = Math.min(lessonProgress.current, lessonProgress.target);
  const highAccuracyHits = Math.min(accuracyProgress.current, accuracyProgress.target);

  return (
    <View style={tw`gap-4 rounded-2xl border-2 border-zinc-500/50 p-4`}>
      <Text style={tw`text-2xl font-bold`}>🎯 Daily Goals</Text>
      <View style={tw`gap-4`}>
        <Text style={tw`text-lg leading-tight`}>{`Complete 5 practices in Echo mode. (${lessonsCompleted}/5)`}</Text>
        <Progress value={lessonsCompleted} total={lessonProgress.target} />
      </View>
      <View style={tw`gap-4`}>
        <Text style={tw`text-lg leading-tight`}>{`Hit 85% accuracy 5 times in Echo mode. (${highAccuracyHits}/5)`}</Text>
        <Progress value={highAccuracyHits} total={accuracyProgress.target} />
      </View>
      <View style={tw`gap-4`}>
        <Text style={tw`text-lg leading-tight`}>{`Earn ${target} XP today. (${current} / ${target} XP)`}</Text>
        <Progress value={dailyGoalSegments} total={totalSegments} />
      </View>
    </View>
  );
};

export default function MainHomeScreen() {
  useDailyProgressQuery();
  const { data: myRankData, isLoading: rankLoading } = useMyRankQuery();
  const streak = myRankData?.current_streak ?? 0;
  const totalXP = myRankData?.total_xp ?? 0;

  useNavigationOptions({ header: () => <Header totalXP={totalXP} isLoading={rankLoading} /> });
  return (
    <ScrollView style={tw`flex-1`} contentContainerStyle={tw`gap-4 p-4`}>
      <StreakMeter streak={streak} />
      <WelcomeMessage />
      <ActivityCard />
      <DailyGoalsCard />
    </ScrollView>
  );
}
