import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@react-navigation/native";
import { useAtomValue } from "jotai";
import { CalendarIcon, DiamondIcon, FlameIcon, ZapIcon } from "lucide-react-native";
import tw from "twrnc";

import { useAchievementsQuery, useDailyProgressQuery, useGemBalanceQuery, useMyRankQuery } from "~/client";
import { AchievementGrid, GemShop, Heatmap, Meter, Progress, Text } from "~/components";
import { useNavigationOptions } from "~/hooks";
import { $dailyAccuracyProgress, $dailyLessonProgress, $dailyProgress, $gemBalance } from "~/store";

const STREAK_MILESTONE_STEP = 5;
const formatXP = (xp: number) => xp.toLocaleString();

const Header = ({ totalXP, isLoading }: { totalXP: number; isLoading: boolean }) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const gemBalance = useAtomValue($gemBalance);

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
        {/* Left: Date */}
        <View style={tw`flex-row items-center gap-1.5`}>
          <CalendarIcon size={18} strokeWidth={2.5} color={theme.colors.text} />
          <Text style={tw`text-lg font-medium`}>
            {new Date().toLocaleDateString("en-GB", { month: "short", day: "numeric" })}
          </Text>
        </View>

        {/* Center: Logo */}
        <View style={tw`absolute inset-x-0 items-center justify-center`}>
          <Text style={[tw`text-3xl leading-[0] text-green-500`, { fontFamily: "Feather-Bold" }]}>yaplingo</Text>
        </View>

        {/* Right: Stats capsule (XP + Gems) */}
        <View style={tw`flex-row items-center gap-1 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-1`}>
          {/* Gem pill */}
          <View style={tw`flex-row items-center gap-0.5 rounded-full bg-green-500/15 px-2 py-0.5`}>
            <DiamondIcon size={13} color="#22C55E" fill="#22C55E" />
            <Text style={tw`text-xs font-bold text-green-600 dark:text-green-400`}>
              {isLoading ? "..." : gemBalance.toLocaleString()}
            </Text>
          </View>
          {/* Divider */}
          <View style={tw`w-px h-3.5 bg-zinc-300 dark:bg-zinc-600`} />
          {/* XP pill */}
          <View style={tw`flex-row items-center gap-0.5 rounded-full bg-sky-500/15 px-2 py-0.5`}>
            <ZapIcon size={13} color="#0EA5E9" fill="#0EA5E9" />
            <Text style={tw`text-xs font-bold text-sky-600 dark:text-sky-400`}>
              {isLoading ? "..." : formatXP(totalXP)}
            </Text>
          </View>
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
      <Meter percentage={progressPercentage}>
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
  "Let's nail those tricky sounds today!",
  "Time to train those tongue muscles!",
  "Let's make your words shine today!",
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
  const xpProgressPercent = target > 0 ? Math.min(Math.max((current / target) * 100, 0), 100) : 0;
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
        <Text style={tw`text-lg leading-tight`}>{`Hit 80% accuracy 5 times in Echo mode. (${highAccuracyHits}/5)`}</Text>
        <Progress value={highAccuracyHits} total={accuracyProgress.target} />
      </View>
      <View style={tw`gap-4`}>
        <Text style={tw`text-lg leading-tight`}>{`Earn ${target} XP today. (${current} / ${target} XP)`}</Text>
        <View style={tw`h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800`}>
          <View style={[tw`h-full rounded-full bg-green-500`, { width: `${xpProgressPercent}%` }]} />
        </View>
      </View>
    </View>
  );
};

const GemShopCard = ({ onPress }: { onPress: () => void }) => (
  <Pressable
    onPress={onPress}
    style={tw`flex-row items-center justify-between rounded-2xl border-2 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/30 p-4`}
  >
    <View style={tw`flex-row items-center gap-3`}>
      <View style={tw`w-10 h-10 rounded-xl bg-green-500/15 items-center justify-center`}>
        <DiamondIcon size={22} color="#22C55E" fill="#22C55E" />
      </View>
      <View>
        <Text style={tw`text-lg font-bold text-zinc-800 dark:text-zinc-100`}>Gem Shop</Text>
        <Text style={tw`text-xs text-zinc-500`}>Spend gems on boosts & rewards</Text>
      </View>
    </View>
    <View style={tw`rounded-xl bg-green-500 px-4 py-2`}>
      <Text style={tw`text-sm font-bold text-white`}>Open</Text>
    </View>
  </Pressable>
);

export default function MainHomeScreen() {
  useDailyProgressQuery();
  useGemBalanceQuery();
  const { data: myRankData, isLoading: rankLoading } = useMyRankQuery();
  const { data: achievements } = useAchievementsQuery();
  const streak = myRankData?.current_streak ?? 0;
  const totalXP = myRankData?.total_xp ?? 0;
  const [shopVisible, setShopVisible] = useState(false);

  useNavigationOptions({ header: () => <Header totalXP={totalXP} isLoading={rankLoading} /> });
  return (
    <ScrollView style={tw`flex-1`} contentContainerStyle={tw`gap-4 p-4`}>
      <StreakMeter streak={streak} />
      <WelcomeMessage />
      <ActivityCard />
      <DailyGoalsCard />
      <GemShopCard onPress={() => setShopVisible(true)} />
      {achievements && achievements.length > 0 && (
        <AchievementGrid achievements={achievements} />
      )}
      <GemShop visible={shopVisible} onClose={() => setShopVisible(false)} />
    </ScrollView>
  );
}
