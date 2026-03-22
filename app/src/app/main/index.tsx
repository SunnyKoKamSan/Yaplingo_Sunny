import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@react-navigation/native";
import { useAtomValue } from "jotai";
import { CalendarIcon, FlameIcon, ZapIcon } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import tw from "twrnc";

import { useAchievementsQuery, useActiveEventsQuery, useAuthedUserQuery, useDailyProgressQuery, useGemBalanceQuery, useMyRankQuery } from "~/client";
import type { ActiveEvent } from "~/client/models";
import { AchievementGrid, GemShop, Heatmap, Meter, Progress, Text } from "~/components";
import { useNavigationOptions } from "~/hooks";
import { $dailyAccuracyProgress, $dailyLessonProgress, $dailyProgress } from "~/store";

const STREAK_MILESTONE_STEP = 5;
const formatXP = (xp: number) => xp.toLocaleString();
const GEM_ICON_SOURCE = require("../../../assets/gem.png");

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
        <View style={tw`flex-row items-center rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-1`}>
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
      <Meter percentage={progressPercentage} fadedProgress={!streakActive}>
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
  const [message] = useState(() => WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)]);
  return (
    <View style={tw`mx-4 items-center`}>
      <Text style={tw`text-center text-xl font-bold leading-tight`}>{`📢  ${message}`}</Text>
    </View>
  );
};

const ActivityCard = () => {
  const query = useAuthedUserQuery();
  const entries = query.data?.activity ?? {};
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

const hasTimezone = (value: string): boolean =>
  /(?:[zZ]|[+-]\d{2}:\d{2})$/.test(value);

const parseServerUtcMs = (value: string): number => {
  const normalized = hasTimezone(value) ? value : `${value}Z`;
  return new Date(normalized).getTime();
};

const getSecondsLeft = (endsAt: string, nowMs: number): number => {
  const endMs = parseServerUtcMs(endsAt);
  if (!Number.isFinite(endMs)) return 0;
  return Math.max(0, Math.floor((endMs - nowMs) / 1000));
};

const formatBoostTime = (secs: number): string => {
  const mins = Math.floor(secs / 60);
  const s = secs % 60;
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const m = mins % 60;
    return `${hrs}h ${m}m`;
  }
  return `${mins}:${s.toString().padStart(2, "0")}`;
};

const GemShopCard = ({ onPress, activeBoost }: { onPress: () => void; activeBoost?: { event: ActiveEvent; secondsLeft: number } }) => {
  const gemBalance = useAtomValue($gemBalance);
  const isMegaBoost = activeBoost && activeBoost.event.multiplier >= 10;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        tw`rounded-2xl border-2 border-zinc-500/50 bg-white dark:bg-zinc-900 overflow-hidden`,
        { opacity: pressed ? 0.95 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] },
      ]}
    >
      <View style={tw`p-4`}>
        <View style={tw`flex-row items-center justify-between`}>
          <View style={tw`flex-row items-center gap-3`}>
            <LinearGradient
              colors={["#f5f5f5", "#f5f5f5"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={tw`w-11 h-11 rounded-xl items-center justify-center`}
            >
              <Image source={GEM_ICON_SOURCE} resizeMode="contain" style={{ width: 24, height: 24 }} />
            </LinearGradient>
            <View>
              <Text style={tw`text-lg font-bold text-zinc-800 dark:text-zinc-100`}>Gem Shop</Text>
              <Text style={tw`text-xs text-zinc-500`}>Gems = Boosts + Rewards</Text>
            </View>
          </View>
          <View style={[
            tw`flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100`,
            {
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 8,
              elevation: 4,
            },
          ]}>
            <Image source={GEM_ICON_SOURCE} resizeMode="contain" style={{ width: 14, height: 14 }} />
            <Text style={tw`text-sm font-bold text-green-600`}>{gemBalance.toLocaleString()}</Text>
          </View>
        </View>

        {/* Active XP Boost Banner */}
        {activeBoost && (
          <LinearGradient
            colors={isMegaBoost ? ["#8B5CF6", "#7C3AED"] : ["#F97316", "#EA580C"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={tw`mt-3 flex-row items-center justify-between px-3 py-2.5 rounded-xl`}
          >
            <View style={tw`flex-row items-center gap-2`}>
              <ZapIcon size={16} color="white" fill="white" strokeWidth={0} />
              <Text style={tw`text-sm font-bold text-white`}>
                {activeBoost.event.multiplier}× XP BOOST ACTIVE
              </Text>
            </View>
            <View style={tw`flex-row items-center gap-1 bg-white/20 px-2 py-1 rounded-full`}>
              <Text style={tw`text-xs font-bold text-white`}>
                {formatBoostTime(activeBoost.secondsLeft)}
              </Text>
            </View>
          </LinearGradient>
        )}
      </View>
    </Pressable>
  );
};

export default function MainHomeScreen() {
  useDailyProgressQuery();
  useGemBalanceQuery();
  const { data: myRankData, isLoading: rankLoading } = useMyRankQuery();
  const { data: achievements } = useAchievementsQuery();
  const { data: activeEvents = [] } = useActiveEventsQuery();
  const streak = myRankData?.current_streak ?? 0;
  const totalXP = myRankData?.total_xp ?? 0;
  const [shopVisible, setShopVisible] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const activeBoost = activeEvents
    .map((event) => ({
      event,
      secondsLeft: getSecondsLeft(event.ends_at, now),
    }))
    .filter(({ secondsLeft }) => secondsLeft > 0)
    .sort((a, b) => b.event.multiplier - a.event.multiplier)[0];

  useNavigationOptions({ header: () => <Header totalXP={totalXP} isLoading={rankLoading} /> });
  return (
    <ScrollView style={tw`flex-1`} contentContainerStyle={tw`gap-4 p-4`}>
      <StreakMeter streak={streak} />
      <WelcomeMessage />
      <ActivityCard />
      <DailyGoalsCard />
      <GemShopCard onPress={() => setShopVisible(true)} activeBoost={activeBoost} />
      {achievements && achievements.length > 0 && (
        <AchievementGrid achievements={achievements} />
      )}
      <GemShop visible={shopVisible} onClose={() => setShopVisible(false)} />
    </ScrollView>
  );
}
