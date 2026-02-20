import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  FadeInDown,
} from "react-native-reanimated";
import { useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  FlameIcon,
  LightbulbIcon,
  TrophyIcon,
  UserIcon,
  ZapIcon,
} from "lucide-react-native";
import LottieView from "lottie-react-native";
import { LinearGradient } from "expo-linear-gradient";
import tw from "twrnc";

import { AnimatedPodium, Button, Spinner, Text } from "~/components";
import {
  useAuthedUserQuery,
  useLeaderboardQuery,
  useMyRankQuery,
} from "~/client";
import { useNavigationOptions } from "~/hooks";
import type { LeaderboardItem, Topic } from "~/client/models";

// ─── Constants ───────────────────────────────────────────────────────────────

// Background green intensified ~10% from #F0FDF4
const BG_COLOR = "#E2FAE6";

const LOTTIE_CROWN_URI =
  "https://lottie.host/e371643e-e22e-4a3e-a1ce-b8ab03785b60/WiYpVXACUw.lottie";

const TOPICS: { key: Topic; label: string; emoji: string }[] = [
  { key: "Global", label: "Global", emoji: "🌍" },
  { key: "Food", label: "Food", emoji: "🍜" },
  { key: "Culture", label: "Culture", emoji: "🎭" },
  { key: "Travel", label: "Travel", emoji: "✈️" },
  { key: "Business", label: "Business", emoji: "💼" },
  { key: "Technology", label: "Tech", emoji: "💡" },
];

type TimeTab = "this-week" | "all-time";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getISOWeek = (date: Date) => {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return { year: d.getUTCFullYear(), week: weekNum };
};

const buildPeriods = (count: number) => {
  const periods: { key: string; label: string }[] = [];
  const now = new Date();
  const nowUtcDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  for (let i = 0; i < count; i += 1) {
    const date = new Date(nowUtcDate);
    date.setUTCDate(date.getUTCDate() - i * 7);
    const { year, week } = getISOWeek(date);
    const key = `WEEK-${year}-${String(week).padStart(2, "0")}`;
    const label =
      i === 0 ? "This Week" : i === 1 ? "Last Week" : `${i} weeks ago`;
    periods.push({ key, label });
  }
  return periods;
};

const formatXP = (xp: number) => xp.toLocaleString();

// ─── Animated Mascot (inside #1 bar) ────────────────────────────────────────

const FloatingMascot = ({ showCrown }: { showCrown?: boolean }) => {
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
  }, [translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[tw`items-center z-10`, animatedStyle]}>
      {showCrown && (
        <View style={tw`-mb-9 z-20`}>
          <LottieView
            source={{ uri: LOTTIE_CROWN_URI }}
            autoPlay
            loop
            style={{ width: 70, height: 70 }}
          />
        </View>
      )}
      <Image
        source={require("@/mascot.png")}
        style={tw`w-13 h-13`}
        resizeMode="contain"
      />
    </Animated.View>
  );
};

// ─── Header ──────────────────────────────────────────────────────────────────

const StatCard = ({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) => (
  <View
    style={tw`items-center bg-green-600/20 rounded-2xl px-3 py-3 min-w-[95px] border border-green-400/30`}
  >
    {icon}
    <Text style={tw`text-xl font-bold text-green-800 dark:text-green-100 mt-1`}>
      {value}
    </Text>
    <Text style={tw`text-xs text-green-700/70 dark:text-green-200/70 mt-0.5`}>
      {label}
    </Text>
  </View>
);

const ScreenHeader = ({
  rank,
  totalXP,
  streak,
  isLoading,
}: {
  rank: number;
  totalXP: number;
  streak: number;
  isLoading: boolean;
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[{ paddingTop: insets.top + 4, backgroundColor: BG_COLOR }]}>
      <View style={tw`items-center mb-4 mt-2`}>
        <Text
          style={[tw`text-4xl`, { fontFamily: "Feather-Bold", color: "#115c1a" }]}
        >
          Leaderboard
        </Text>
      </View>
      <View style={tw`flex-row justify-around px-3 pb-4`}>
        <StatCard
          label="Your Rank"
          value={isLoading ? "..." : `#${rank}`}
          icon={<TrophyIcon size={20} color="#16A34A" fill="#e1d612"/>}
        />
        <StatCard
          label="XP"
          value={isLoading ? "..." : formatXP(totalXP)}
          icon={<ZapIcon size={20} color="#2c8fc1" fill="#22C55E" />}
        />
        <StatCard
          label="Day Streak"
          value={isLoading ? "..." : `${streak}`}
          icon={<FlameIcon size={20} color="#fb923c" fill="#c91c16" />}
        />
      </View>
    </View>
  );
};

// ─── Climbing Tips ───────────────────────────────────────────────────────────

const ClimbingTips = () => (
  <View
    style={tw`mx-4 mt-2 mb-2 bg-amber-50 dark:bg-amber-950/30 rounded-xl px-4 py-3`}
  >
    <View style={tw`flex-row items-center gap-2 mb-2`}>
      <LightbulbIcon size={16} color={tw.color("amber-500")} />
      <Text style={tw`text-sm font-bold text-amber-700 dark:text-amber-400`}>
        Climbing Tips
      </Text>
    </View>
    <View style={tw`gap-1.5`}>
      <Text style={tw`text-sm text-amber-800 dark:text-amber-300 leading-tight`}>
        • Complete daily check-ins to maintain your streak.
      </Text>
      <Text style={tw`text-sm text-amber-800 dark:text-amber-300 leading-tight`}>
        • Participate in a full session in Echo for bonus points.
      </Text>
    </View>
  </View>
);

// ─── Topic Tabs ──────────────────────────────────────────────────────────────

const TopicTabs = ({
  selected,
  onSelect,
}: {
  selected: Topic;
  onSelect: (topic: Topic) => void;
}) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={tw`gap-2 px-4 py-2`}
  >
    {TOPICS.map((topic) => {
      const active = selected === topic.key;
      return (
        <Pressable
          key={topic.key}
          onPress={() => onSelect(topic.key)}
          style={tw.style(
            "flex-row items-center gap-1.5 rounded-full border-2 px-3 py-1.5",
            active
              ? "border-green-500 bg-green-500/10"
              : "border-zinc-300/60 dark:border-zinc-600/60",
          )}
        >
          <Text style={tw`text-base`}>{topic.emoji}</Text>
          <Text
            style={tw.style(
              "text-sm font-medium",
              active
                ? "text-green-600 dark:text-green-400"
                : "text-zinc-600 dark:text-zinc-400",
            )}
          >
            {topic.label}
          </Text>
        </Pressable>
      );
    })}
  </ScrollView>
);

// ─── Time Tabs (This Week + All Time only) ───────────────────────────────────

const TimeTabs = ({
  selected,
  onSelect,
}: {
  selected: TimeTab;
  onSelect: (tab: TimeTab) => void;
}) => (
  <View
    style={tw`flex-row mx-4 mt-1 mb-2 bg-zinc-100 dark:bg-zinc-800 rounded-full p-1`}
  >
    {(["this-week", "all-time"] as TimeTab[]).map((tab) => {
      const active = selected === tab;
      const labels: Record<TimeTab, string> = {
        "this-week": "This Week",
        "all-time": "All Time",
      };
      return (
        <Pressable
          key={tab}
          onPress={() => onSelect(tab)}
          style={tw.style(
            "flex-1 items-center py-2.5 rounded-full",
            active && "bg-green-700 shadow-sm",
          )}
        >
          <Text
            style={tw.style(
              "text-sm font-bold",
              active ? "text-white" : "text-zinc-500 dark:text-zinc-400",
            )}
          >
            {labels[tab]}
          </Text>
        </Pressable>
      );
    })}
  </View>
);

// ─── Podium ──────────────────────────────────────────────────────────────────

const PodiumSection = ({ top3, playToken }: { top3: LeaderboardItem[]; playToken: number }) => {
  if (top3.length === 0) return null;

  return (
    <LinearGradient
      colors={[BG_COLOR, "#D1FAE5", BG_COLOR]}
      style={tw`pt-10 pb-0`}
    >
      <View>
        <AnimatedPodium
          playToken={playToken}
          entries={{
            1: top3[0] ? { name: top3[0].name, xpLabel: formatXP(top3[0].total_xp) } : undefined,
            2: top3[1] ? { name: top3[1].name, xpLabel: formatXP(top3[1].total_xp) } : undefined,
            3: top3[2] ? { name: top3[2].name, xpLabel: formatXP(top3[2].total_xp) } : undefined,
          }}
          championContent={<FloatingMascot showCrown />}
        />
      </View>
    </LinearGradient>
  );
};

// ─── List Section ────────────────────────────────────────────────────────────

const LeaderboardRow = ({
  item,
  isCurrentUser,
  index,
}: {
  item: LeaderboardItem;
  isCurrentUser: boolean;
  index: number;
}) => (
  <Animated.View
    entering={FadeInDown.delay(index * 30).duration(250).easing(Easing.out(Easing.quad))}
  >
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: 16,
        marginHorizontal: 12,
        marginTop: index === 0 ? 12 : 0,
        marginBottom: 12,
        borderRadius: 14,
        backgroundColor: isCurrentUser ? "#ECFDF5" : "#FFFFFF",
        borderWidth: 1,
        borderColor: "#EEF7F0",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 3,
      }}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          borderWidth: 2,
          borderColor: isCurrentUser ? "#16A34A" : "#E5E7EB",
          alignItems: "center",
          justifyContent: "center",
          marginRight: 14,
          backgroundColor: "#FFFFFF",
        }}
      >
        <Text style={{ fontSize: 20, fontWeight: "900", color: "#065F46" }}>{item.rank}</Text>
      </View>

      <View style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: 14 }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isCurrentUser ? "#DCFCE7" : "#F3F4F6", alignItems: "center", justifyContent: "center" }}>
          <UserIcon size={18} color={isCurrentUser ? "#16A34A" : "#9CA3AF"} />
        </View>
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: "800", color: isCurrentUser ? "#065F46" : "#111827" }} numberOfLines={1}>{item.name}</Text>
      </View>

      <View
        style={{
          minWidth: 80,
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: 999,
          borderWidth: 2,
          borderColor: "#34D399",
          backgroundColor: "#FFFFFF",
          shadowColor: "#34D399",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.06,
          shadowRadius: 10,
          elevation: 2,
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: "800", color: "#059669" }}>{formatXP(item.total_xp)}</Text>
      </View>
    </View>
  </Animated.View>
);

// ─── Empty / Error States ────────────────────────────────────────────────────

const EmptyState = () => (
  <View style={tw`flex-1 items-center justify-center py-20`}>
    <Text style={tw`text-6xl mb-4`}>🏆</Text>
    <Text style={tw`mt-2 text-lg font-bold text-zinc-400`}>
      No rankings yet
    </Text>
    <Text style={tw`mt-2 text-sm text-zinc-400 text-center px-8`}>
      Be the first to earn XP and climb the leaderboard!
    </Text>
  </View>
);

const ErrorState = ({ onRetry }: { onRetry: () => void }) => (
  <View style={tw`flex-1 items-center justify-center py-20`}>
    <Text style={tw`text-lg font-bold text-red-500`}>
      Failed to load leaderboard
    </Text>
    <Button style={tw`mt-4 px-6`} onPress={onRetry}>
      <Text style={tw`text-base font-semibold`}>Retry</Text>
    </Button>
  </View>
);

// ─── Week Navigation ─────────────────────────────────────────────────────────

const WeekNav = ({
  label,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
}: {
  label: string;
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
}) => (
  <View style={tw`flex-row items-center justify-between px-4 mt-1 mb-1`}>
    <Pressable
      onPress={onBack}
      disabled={!canGoBack}
      style={tw.style("p-2", !canGoBack && "opacity-30")}
    >
      <ChevronLeftIcon size={22} color={tw.color("zinc-600")} strokeWidth={3} />
    </Pressable>
    <Text style={tw`text-sm font-bold text-zinc-600`}>{label}</Text>
    <Pressable
      onPress={onForward}
      disabled={!canGoForward}
      style={tw.style("p-2", !canGoForward && "opacity-30")}
    >
      <ChevronRightIcon size={22} color={tw.color("zinc-600")} strokeWidth={3} />
    </Pressable>
  </View>
);

// ─── Sticky Footer ──────────────────────────────────────────────────────────

const MyRankFooter = ({
  rank,
  totalXP,
  isLoading,
  hasError,
  userName,
}: {
  rank: number;
  totalXP: number;
  isLoading: boolean;
  hasError: boolean;
  userName?: string;
}) => {
  if (isLoading) {
    return (
      <View style={[tw`py-4 items-center`, { backgroundColor: "#188152" }]}>
        <Spinner size={24} />
      </View>
    );
  }

  if (hasError) {
    return (
      <View style={[tw`py-4 items-center`, { backgroundColor: "#188152" }]}>
        <Text style={tw`text-sm text-red-400`}>Unable to load your rank</Text>
      </View>
    );
  }

  return (
    <View
      style={[
        tw`flex-row items-center justify-between px-5 py-3.5 bg-green-600/20 rounded-3xl border border-green-700`
      ]}
     >
         <View style={{ width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#000000', backgroundColor: '#ffffff' }}>
           <Text style={{color: '#000000', fontWeight: '900', fontSize: 18 }}>{rank}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginLeft: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#46786b', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
          <UserIcon size={20} color="white" />
        </View>
        <Text style={{ color: '#000000', fontWeight: '800' }}>{userName ?? 'You'}</Text>
      </View>
      <View style={{ minWidth: 88, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999, backgroundColor: '#ffffff' }}>
        <Text style={{ color: '#000000', fontWeight: '800' }}>{formatXP(totalXP)}</Text>
      </View>
    </View>
  );
};

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function MainCommunityScreen() {
  const isFocused = useIsFocused();
  const { data: currentUser } = useAuthedUserQuery();
  const [podiumPlayToken, setPodiumPlayToken] = useState(0);
  const [selectedTopic, setSelectedTopic] = useState<Topic>("Global");
  const [timeTab, setTimeTab] = useState<TimeTab>("this-week");
  const periods = useMemo(() => buildPeriods(5), []);
  const [periodIndex, setPeriodIndex] = useState(0);

  useEffect(() => {
    if (isFocused) {
      setPodiumPlayToken((token) => token + 1);
    }
  }, [isFocused]);

  // Determine period key based on selected time tab
  const periodKey = useMemo(() => {
    if (timeTab === "all-time") return "ALL_TIME";
    if (periodIndex === 0) return undefined;
    return periods[periodIndex]?.key;
  }, [timeTab, periods, periodIndex]);

  const {
    data: myRankData,
    isLoading: rankLoading,
    error: rankError,
  } = useMyRankQuery(periodKey, selectedTopic);

  useNavigationOptions({ headerShown: false });

  const {
    data: leaderboard,
    isLoading,
    error,
    refetch,
  } = useLeaderboardQuery(periodKey, selectedTopic);

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const items = useMemo(() => leaderboard || [], [leaderboard]);
  const top3 = useMemo(() => items.filter((i) => i.rank <= 3), [items]);
  const rest = useMemo(() => items.filter((i) => i.rank > 3), [items]);
  const currentUserEntry = useMemo(
    () => items.find((item) => item.user_id === currentUser?.id),
    [items, currentUser?.id],
  );

  const rank = currentUserEntry?.rank ?? myRankData?.rank ?? 0;
  const totalXP = currentUserEntry?.total_xp ?? myRankData?.total_xp ?? 0;
  const headerLoading = rankLoading && !currentUserEntry;
  const rankUnavailable = !!rankError && !currentUserEntry;

  const streak = myRankData?.current_streak ?? 0;

  if (isLoading && !leaderboard) {
    return (
      <View style={tw`flex-1`}>
        <ScreenHeader rank={0} totalXP={0} streak={0} isLoading />
        <View style={tw`flex-1 items-center justify-center`}>
          <Spinner size={48} />
          <Text style={tw`mt-4 text-zinc-500`}>Loading leaderboard...</Text>
        </View>
      </View>
    );
  }

  if (error && !leaderboard) {
    return (
      <View style={tw`flex-1`}>
        <ScreenHeader rank={0} totalXP={0} streak={0} isLoading />
        <ErrorState onRetry={refetch} />
      </View>
    );
  }

  return (
    <View style={tw`flex-1`}>
      <FlatList
        data={rest}
        renderItem={({ item, index }) => (
          <LeaderboardRow
            item={item}
            isCurrentUser={currentUser?.id === item.user_id}
            index={index}
          />
        )}
        keyExtractor={(item) => item.user_id}
        contentContainerStyle={tw`pb-4`}
        ListHeaderComponent={
          <View>
            <ScreenHeader
              rank={rank}
              totalXP={totalXP}
              streak={streak}
              isLoading={headerLoading}
            />
            <ClimbingTips />
            <TopicTabs
              selected={selectedTopic}
              onSelect={setSelectedTopic}
            />
            <TimeTabs selected={timeTab} onSelect={setTimeTab} />

            {timeTab === "this-week" && (
              <WeekNav
                label={periods[periodIndex]?.label ?? ""}
                canGoBack={periodIndex < periods.length - 1}
                canGoForward={periodIndex > 0}
                onBack={() =>
                  setPeriodIndex(Math.min(periods.length - 1, periodIndex + 1))
                }
                onForward={() =>
                  setPeriodIndex(Math.max(0, periodIndex - 1))
                }
              />
            )}

            <PodiumSection top3={top3} playToken={podiumPlayToken} />

            {/* remove spacer so podium and list touch */}
          </View>
        }
        ListEmptyComponent={top3.length === 0 ? <EmptyState /> : null}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={tw.color("green-500")}
            colors={[tw.color("green-500") as string]}
          />
        }
        showsVerticalScrollIndicator={false}
        maxToRenderPerBatch={10}
        windowSize={10}
        initialNumToRender={15}
        removeClippedSubviews
        style={{ backgroundColor: BG_COLOR }}
      />

      <MyRankFooter
        rank={rank}
        totalXP={totalXP}
        isLoading={headerLoading}
        hasError={rankUnavailable}
        userName={currentUser?.name}
      />
    </View>
  );
}
