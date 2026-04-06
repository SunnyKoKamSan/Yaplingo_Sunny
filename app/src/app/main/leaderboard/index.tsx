import { type ReactNode, useEffect, useMemo, useState } from "react";
import { FlatList, Image, Pressable, RefreshControl, View } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useIsFocused } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { FlameIcon, LightbulbIcon, TrophyIcon, UserIcon, ZapIcon } from "lucide-react-native";
import LottieView from "lottie-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from "react-native-svg";
import tw from "twrnc";

import { useCurrentUserQuery, useLeaderboardQuery, type LeaderboardEntry, type LeaderboardPeriod } from "~/client";
import AnimatedPodium from "~/components/AnimatedPodium";
import { Button, Spinner, Text } from "~/components/primitives";

const BG = "#ffffff";
const CROWN_URI = "https://lottie.host/e371643e-e22e-4a3e-a1ce-b8ab03785b60/WiYpVXACUw.lottie";
const REFRESH_COLOR = tw.color("green-500") ?? "#22C55E";

type TimeTab = LeaderboardPeriod;

const fmtXP = (value: number) => value.toLocaleString();

const FloatingMascot = ({ crown = false }: { crown?: boolean }) => {
  const ty = useSharedValue(0);

  useEffect(() => {
    ty.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
  }, [ty]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));

  return (
    <Animated.View style={[tw`items-center z-10`, style]}>
      {crown && (
        <View style={tw`-mb-9 z-20`}>
          <LottieView source={{ uri: CROWN_URI }} autoPlay loop style={{ width: 70, height: 70 }} />
        </View>
      )}
      <Image source={require("@/mascot.png")} style={tw`w-13 h-13`} resizeMode="contain" />
    </Animated.View>
  );
};

const StatCard = ({ label, value, icon }: { label: string; value: string; icon: ReactNode }) => (
  <View style={tw`items-center bg-green-600/20 rounded-2xl px-3 py-3 min-w-[95px] border border-green-400/30`}>
    {icon}
    <Text style={tw`text-xl font-bold text-green-800 mt-1`}>{value}</Text>
    <Text style={tw`text-xs text-green-700/70 mt-0.5`}>{label}</Text>
  </View>
);

const Header = ({ rank, xp, streak, loading }: { rank: number; xp: number; streak: number; loading: boolean }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ paddingTop: insets.top + 4, backgroundColor: BG }}>
      <View style={tw`items-center mb-4 mt-2`}>
        <Text style={[tw`text-4xl`, { fontFamily: "Feather-Bold", color: "#115c1a" }]}>Leaderboard</Text>
      </View>
      <View style={tw`flex-row justify-around px-3 pb-4`}>
        <StatCard
          label="Your Rank"
          value={loading ? "..." : `#${rank}`}
          icon={<TrophyIcon size={20} color="#16A34A" fill="#e1d612" />}
        />
        <StatCard label="XP" value={loading ? "..." : fmtXP(xp)} icon={<ZapIcon size={20} color="#2c8fc1" fill="#22C55E" />} />
        <StatCard
          label="Day Streak"
          value={loading ? "..." : `${streak}`}
          icon={<FlameIcon size={20} color="#fb923c" fill="#c91c16" />}
        />
      </View>
    </View>
  );
};

const Tips = () => (
  <View style={tw`mx-4 mt-2 mb-2 bg-amber-50 rounded-xl px-4 py-3`}>
    <View style={tw`flex-row items-center gap-2 mb-2`}>
      <LightbulbIcon size={16} color={tw.color("amber-500")} />
      <Text style={tw`text-sm font-bold text-amber-700`}>Climbing Tips</Text>
    </View>
    <View style={tw`gap-1.5`}>
      <Text style={tw`text-sm text-amber-800 leading-tight`}>• Complete daily check-ins to maintain your streak.</Text>
      <Text style={tw`text-sm text-amber-800 leading-tight`}>• Keep practicing in lessons to gain bonus XP.</Text>
    </View>
  </View>
);

const TimeTabs = ({ sel, onSel, overlay = false }: { sel: TimeTab; onSel: (tab: TimeTab) => void; overlay?: boolean }) => (
  <View style={tw.style("flex-row bg-zinc-100 rounded-full p-0.5", overlay ? "mx-8" : "mx-8 mt-1 mb-2")}>
    {(["this-week", "all-time"] as TimeTab[]).map((tab) => (
      <Pressable
        key={tab}
        onPress={() => onSel(tab)}
        style={tw.style("flex-1 items-center rounded-full py-1.5", sel === tab && "bg-green-700 shadow-sm")}>
        <Text style={tw.style("text-sm font-bold", sel === tab ? "text-white" : "text-zinc-500")}>
          {tab === "this-week" ? "This Week" : "All Time"}
        </Text>
      </Pressable>
    ))}
  </View>
);

const GradientBackground = () => (
  <View style={tw`absolute inset-0`}>
    <Svg width="100%" height="100%" preserveAspectRatio="none">
      <Defs>
        <SvgLinearGradient id="podium-bg" x1="0.5" y1="0" x2="0.5" y2="1">
          <Stop offset="0" stopColor={BG} stopOpacity="1" />
          <Stop offset="0.5" stopColor="#D1FAE5" stopOpacity="1" />
          <Stop offset="1" stopColor={BG} stopOpacity="1" />
        </SvgLinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#podium-bg)" />
    </Svg>
  </View>
);

const Podium = ({
  top3,
  token,
  tab,
  onTab,
}: {
  top3: LeaderboardEntry[];
  token: number;
  tab: TimeTab;
  onTab: (tab: TimeTab) => void;
}) => {
  const first = top3.find((entry) => entry.rank === 1);
  const second = top3.find((entry) => entry.rank === 2);
  const third = top3.find((entry) => entry.rank === 3);

  if (!first && !second && !third) return <TimeTabs sel={tab} onSel={onTab} />;

  return (
    <View style={tw`pt-2 pb-0`}>
      <GradientBackground />
      <View>
        <AnimatedPodium
          playToken={token}
          entries={{
            1: first ? { name: first.name, xpLabel: fmtXP(first.score) } : undefined,
            2: second ? { name: second.name, xpLabel: fmtXP(second.score) } : undefined,
            3: third ? { name: third.name, xpLabel: fmtXP(third.score) } : undefined,
          }}
          championContent={<FloatingMascot crown={true} />}
        />
        <View pointerEvents="box-none" style={[tw`absolute left-0 right-0`, { bottom: 8 }]}>
          <TimeTabs sel={tab} onSel={onTab} overlay={true} />
        </View>
      </View>
    </View>
  );
};

const Row = ({
  item,
  me,
  idx,
  onPress,
}: {
  item: LeaderboardEntry;
  me: boolean;
  idx: number;
  onPress?: () => void;
}) => (
  <Animated.View entering={FadeInDown.delay(idx * 30).duration(250).easing(Easing.out(Easing.quad))}>
    <Pressable onPress={onPress} disabled={!onPress}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 14,
          paddingHorizontal: 16,
          marginHorizontal: 12,
          marginTop: idx === 0 ? 12 : 0,
          marginBottom: 12,
          borderRadius: 14,
          backgroundColor: me ? "#ECFDF5" : "#FFF",
          borderWidth: 1,
          borderColor: "#EEF7F0",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.04,
          shadowRadius: 12,
          elevation: 3,
        }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            borderWidth: 2,
            borderColor: me ? "#16A34A" : "#E5E7EB",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 14,
            backgroundColor: "#FFF",
          }}>
          <Text style={{ fontSize: 20, fontWeight: "900", color: "#065F46" }}>{`#${item.rank}`}</Text>
        </View>
        <View style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: 14 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: me ? "#DCFCE7" : "#F3F4F6",
              alignItems: "center",
              justifyContent: "center",
            }}>
            <UserIcon size={18} color={me ? "#16A34A" : "#9CA3AF"} />
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: me ? "#065F46" : "#111827" }} numberOfLines={1}>
            {item.name}
          </Text>
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
            backgroundColor: "#FFF",
            shadowColor: "#34D399",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.06,
            shadowRadius: 10,
            elevation: 2,
          }}>
          <Text style={{ fontSize: 14, fontWeight: "800", color: "#059669" }}>{fmtXP(item.score)}</Text>
        </View>
      </View>
    </Pressable>
  </Animated.View>
);

const Empty = () => (
  <View style={tw`flex-1 items-center justify-center py-20`}>
    <Text style={tw`text-6xl mb-4`}>🏆</Text>
    <Text style={tw`mt-2 text-lg font-bold text-zinc-400`}>No rankings yet</Text>
    <Text style={tw`mt-2 text-sm text-zinc-400 text-center px-8`}>Be the first to earn XP and climb the leaderboard!</Text>
  </View>
);

const ErrorState = ({ retry }: { retry: () => void }) => (
  <View style={tw`flex-1 items-center justify-center py-20`}>
    <Text style={tw`text-lg font-bold text-red-500`}>Failed to load leaderboard</Text>
    <Button style={tw`mt-4 px-6`} onPress={retry}>
      <Text style={tw`text-base font-semibold`}>Retry</Text>
    </Button>
  </View>
);

const Footer = ({
  rank,
  xp,
  loading,
  error,
  name,
}: {
  rank: number;
  xp: number;
  loading: boolean;
  error: boolean;
  name?: string;
}) => {
  if (loading) {
    return (
      <View style={[tw`py-4 items-center`, { backgroundColor: "#188152" }]}>
        <Spinner size={24} color="#FFFFFF" />
      </View>
    );
  }
  if (error) {
    return (
      <View style={[tw`py-4 items-center`, { backgroundColor: "#188152" }]}>
        <Text style={tw`text-sm text-red-200`}>Unable to load your rank</Text>
      </View>
    );
  }
  return (
    <View style={tw`flex-row items-center justify-between px-5 py-3.5 bg-green-600/20 rounded-3xl border border-green-700`}>
      <View
        style={{
          width: 50,
          height: 50,
          borderRadius: 25,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 2,
          borderColor: "#000",
          backgroundColor: "#fff",
        }}>
        <Text style={{ color: "#000", fontWeight: "900", fontSize: 18 }}>{`#${rank}`}</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", flex: 1, marginLeft: 12 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: "#46786b",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}>
          <UserIcon size={20} color="white" />
        </View>
        <Text style={{ color: "#000", fontWeight: "800" }}>{name ?? "You"}</Text>
      </View>
      <View
        style={{
          minWidth: 88,
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 8,
          paddingHorizontal: 16,
          borderRadius: 999,
          backgroundColor: "#fff",
        }}>
        <Text style={{ color: "#000", fontWeight: "800" }}>{fmtXP(xp)}</Text>
      </View>
    </View>
  );
};

export default function MainLeaderboardScreen() {
  const router = useRouter();
  const focused = useIsFocused();
  const { data: user } = useCurrentUserQuery();

  const [token, setToken] = useState(0);
  const [tab, setTab] = useState<TimeTab>("this-week");
  const [refreshing, setRefreshing] = useState(false);

  const { data: leaderboard, isLoading, isRefetching, error, refetch } = useLeaderboardQuery(tab);

  useEffect(() => {
    if (focused) setToken((prev) => prev + 1);
  }, [focused]);

  useEffect(() => {
    setToken((prev) => prev + 1);
  }, [tab]);

  const entries = useMemo(() => leaderboard?.entries ?? [], [leaderboard?.entries]);
  const top3 = useMemo(() => entries.filter((entry) => entry.rank <= 3), [entries]);
  const rest = useMemo(() => entries.filter((entry) => entry.rank > 3), [entries]);
  const me = leaderboard?.me;

  const openProfile = (uid: string) => {
    router.navigate(
      {
        pathname: "./profile",
        params: { uid },
      },
      { relativeToDirectory: true },
    );
  };

  const doRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  if (isLoading && !leaderboard) {
    return (
      <View style={tw`flex-1`}>
        <Header rank={0} xp={0} streak={0} loading={true} />
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
        <Header rank={0} xp={0} streak={0} loading={true} />
        <ErrorState retry={() => void refetch()} />
      </View>
    );
  }

  return (
    <View style={tw`flex-1`}>
      <FlatList
        data={rest}
        renderItem={({ item, index }) => (
          <Row
            item={item}
            me={item.uid === me?.uid}
            idx={index}
            onPress={item.uid === me?.uid ? undefined : () => openProfile(item.uid)}
          />
        )}
        keyExtractor={(item) => item.uid}
        contentContainerStyle={tw`pb-4`}
        ListHeaderComponent={
          <View>
            <Header rank={me?.rank ?? 0} xp={me?.score ?? 0} streak={user?.streak ?? 0} loading={!me} />
            <Tips />
            <Podium top3={top3} token={token} tab={tab} onTab={setTab} />
          </View>
        }
        ListEmptyComponent={!top3.length ? <Empty /> : null}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || isRefetching}
            onRefresh={doRefresh}
            tintColor={REFRESH_COLOR}
            colors={[REFRESH_COLOR]}
          />
        }
        showsVerticalScrollIndicator={false}
        maxToRenderPerBatch={10}
        windowSize={10}
        initialNumToRender={15}
        removeClippedSubviews={true}
        style={{ backgroundColor: BG }}
      />
      <View style={tw`px-4 pb-4`}>
        <Footer rank={me?.rank ?? 0} xp={me?.score ?? 0} loading={!me} error={Boolean(error) && !me} name={user?.name} />
      </View>
    </View>
  );
}
