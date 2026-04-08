import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Image, Pressable, RefreshControl, View, type ViewProps } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Defs, Path, Rect, Stop, LinearGradient as SvgLinearGradient } from "react-native-svg";
import { useTheme } from "@react-navigation/native";
import { useFocusEffect, useRouter } from "expo-router";
import LottieView from "lottie-react-native";
import { TrophyIcon, ZapIcon } from "lucide-react-native";
import tw from "twrnc";

import { useCurrentUserQuery, useLeaderboardQuery, type LeaderboardEntry } from "~/client";
import { Spinner, Text } from "~/components/primitives";

const LOTTIE_CROWN_URI = "https://lottie.host/e371643e-e22e-4a3e-a1ce-b8ab03785b60/WiYpVXACUw.lottie";

type PodiumRank = 1 | 2 | 3;
type PodiumEntry = { name: string; label: string; onPress?: () => void };
type PodiumEntries = Partial<Record<PodiumRank, PodiumEntry>>;

const AnimatedPodium = ({
  token,
  entries,
  champion,
  style,
  ...props
}: {
  token: number;
  entries: PodiumEntries;
  champion?: React.ReactNode;
} & ViewProps) => {
  const theme = useTheme();

  const [width, setWidth] = useState(0);
  const _token = useRef<number | null>(null);

  const W = 500;
  const H = 300;
  const GROUND = 250;
  const SCALE = 1.16;
  const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);

  const LAYOUT: Record<
    PodiumRank,
    { x: number; w: number; h: number; y: number; grad: { light: [string, string]; dark: [string, string] } }
  > = {
    1: { x: 250, w: 80, h: 160, y: 110, grad: { light: ["#3eec17", "#247843"], dark: ["#22c55e", "#166534"] } },
    2: { x: 130, w: 80, h: 130, y: 140, grad: { light: ["#3decac", "#1d7454"], dark: ["#2dd4bf", "#0d9488"] } },
    3: { x: 370, w: 80, h: 100, y: 170, grad: { light: ["#11d597", "#02422e"], dark: ["#10b981", "#065f46"] } },
  };

  const GROUND_COLORS = {
    light: { top: "#57534e", bottom: "#44403c" },
    dark: { top: "#3f3f46", bottom: "#27272a" },
  };

  const s = width > 0 ? (width / W) * SCALE : 1;
  const sw = width > 0 ? W * s : W;
  const sh = width > 0 ? H * s : H;
  const ox = width > 0 ? (width - sw) / 2 : 0;

  const y1 = useSharedValue(GROUND);
  const y2 = useSharedValue(GROUND);
  const y3 = useSharedValue(GROUND);
  const sx = useSharedValue(0);
  const sy = useSharedValue(0);
  const sr = useSharedValue(0);

  useEffect(() => {
    if (_token.current === token) return;
    _token.current = token;
    y1.value = y2.value = y3.value = GROUND;
    sx.value = sy.value = sr.value = 0;

    const rise = (sv: SharedValue<number>, d: number, t: number, f: number) => {
      sv.value = withDelay(
        d,
        withSequence(
          withTiming(t, {
            duration: 420,
            easing: EASE,
          }),
          withTiming(f, {
            duration: 180,
            easing: EASE,
          }),
        ),
      );
    };
    if (entries[3]) rise(y3, 500, 160, 170);
    if (entries[2]) rise(y2, 1000, 130, 140);
    if (entries[1]) {
      y1.value = withDelay(
        1500,
        withSequence(
          withTiming(235, { duration: 220, easing: Easing.out(Easing.quad) }),
          withTiming(235, { duration: 900 }),
          withTiming(90, { duration: 300, easing: EASE }),
          withTiming(110, { duration: 220, easing: EASE }),
        ),
      );
      const shake = (sv: SharedValue<number>, vals: number[]) => {
        sv.value = withDelay(
          2000,
          withSequence(
            withRepeat(withSequence(...vals.map((v) => withTiming(v, { duration: 50 }))), 3, false),
            withTiming(0, { duration: 40 }),
          ),
        );
      };
      shake(sx, [3, -3, 1, -2]);
      shake(sy, [0, 2, -1]);
      shake(sr, [1, -1, 0.5, -0.5]);
    }
  }, [EASE, entries, token, y1, y2, y3, sx, sy, sr]);

  const as1 = useAnimatedStyle(() => ({
    transform: [
      { translateY: y1.value * s + sy.value * s },
      { translateX: sx.value * s },
      { rotate: `${sr.value}deg` },
    ],
  }));
  const as2 = useAnimatedStyle(() => ({ transform: [{ translateY: y2.value * s }] }));
  const as3 = useAnimatedStyle(() => ({ transform: [{ translateY: y3.value * s }] }));

  const renderLabel = (r: PodiumRank) => {
    const e = entries[r];
    if (!e) return null;
    const l = LAYOUT[r];
    const left = l.x * s;
    const lw = 118 * s;
    const cs = Math.max(0.88, Math.min(s * 0.9, 1.05));
    const pt = l.y * s;
    const ah = 40 * s;
    const nh = 24 * s;
    const xh = Math.max(10, 11 * s);
    const top = r === 1 && champion ? pt - 86 - nh - xh - 8 * s : Math.max(pt - ah - nh - xh - 8 * s, 96);

    const label = (
      <View>
        {r === 1 && champion && <View style={{ transform: [{ scale: cs }] }}>{champion}</View>}
        <Text style={[tw`text-center font-bold`, { fontSize: Math.max(16, 10 * s), minHeight: nh }]} numberOfLines={1}>
          {e.name}
        </Text>
        <View style={tw`flex-row items-center justify-center gap-1`}>
          <ZapIcon size={12} color={tw.color("neutral-500")} fill={tw.color("neutral-500")} />
          <Text style={[tw`font-medium tracking-tighter text-neutral-500`, { fontSize: Math.max(16, 10 * s) }]}>
            {e.label}
          </Text>
        </View>
      </View>
    );

    if (e.onPress) {
      return (
        <Pressable
          key={`l-${r}`}
          onPress={e.onPress}
          style={[tw`absolute items-center`, { left, top, width: lw, marginLeft: -lw / 2 }]}>
          {label}
        </Pressable>
      );
    }

    return (
      <View key={`l-${r}`} style={[tw`absolute items-center`, { left, top, width: lw, marginLeft: -lw / 2 }]}>
        {label}
      </View>
    );
  };

  const renderPillar = (r: PodiumRank) => {
    const e = entries[r];
    if (!e) return null;
    const l = LAYOUT[r];
    const bw = l.w * s;
    const bh = l.h * s;
    const left = (l.x - l.w / 2) * s;
    const as = r === 1 ? as1 : r === 2 ? as2 : as3;
    const gradId = `pillar-grad-${r}`;
    const grad = theme.dark ? l.grad.dark : l.grad.light;

    return (
      <Animated.View
        key={`p-${r}`}
        style={[tw`absolute overflow-hidden rounded-t-lg`, { left, top: 0, width: bw, height: bh }, as]}>
        <Svg width="100%" height="100%" style={tw`absolute inset-0`}>
          <Defs>
            <SvgLinearGradient id={gradId} x1="0.5" y1="0" x2="0.5" y2="1">
              <Stop offset="0" stopColor={grad[0]} stopOpacity="1" />
              <Stop offset="1" stopColor={grad[1]} stopOpacity="1" />
            </SvgLinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradId})`} />
        </Svg>
        <View style={tw`flex-1 items-center`}>
          <Text
            style={[
              tw`font-bold`,
              {
                color: "#fff",
                fontSize: r === 1 ? Math.max(34, 48 * s) : Math.max(26, 32 * s),
                marginTop: r === 1 ? 36 * s : 20 * s,
              },
            ]}>
            {r}
          </Text>
        </View>
      </Animated.View>
    );
  };

  const groundColors = theme.dark ? GROUND_COLORS.dark : GROUND_COLORS.light;

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[tw`w-full self-center`, { aspectRatio: W / (H * SCALE) }, style]}
      {...props}>
      <View style={[tw`absolute top-0 overflow-hidden`, { left: ox, width: sw, height: GROUND * s }]}>
        {renderPillar(3)}
        {renderPillar(2)}
        {renderPillar(1)}
      </View>
      <View style={[tw`absolute top-0`, { left: ox, width: sw, height: GROUND * s, overflow: "visible" as const }]}>
        {renderLabel(3)}
        {renderLabel(2)}
        {renderLabel(1)}
      </View>
      <Svg
        width={sw || "100%"}
        height={sh || "100%"}
        viewBox="0 0 500 300"
        style={[tw`absolute top-0`, { left: ox }]}
        pointerEvents="none">
        <Rect x="0" y="250" width="500" height="50" fill={groundColors.top} />
        <Path
          d="M0,250 Q25,246 50,250 T100,250 T150,247 T200,250 T250,245 T300,250 T350,248 T400,250 T450,246 T500,250 L500,256 L0,256 Z"
          fill={groundColors.bottom}
        />
      </Svg>
    </View>
  );
};

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
    <Animated.View style={[tw`z-10 items-center`, style]}>
      {crown && (
        <View style={tw`z-20 -mb-[36px]`}>
          <LottieView
            autoPlay={true}
            loop={true}
            source={{ uri: LOTTIE_CROWN_URI }}
            style={{ width: 70, height: 70 }}
          />
        </View>
      )}
      <Image source={require("@/mascot.png")} style={{ width: 46, height: 46 }} resizeMode="contain" />
    </Animated.View>
  );
};

const PodiumView = ({
  token,
  entries,
  onEntryPress,
}: {
  token: number;
  entries: LeaderboardEntry[];
  onEntryPress?: (entry: LeaderboardEntry) => void;
}) => {
  const first = entries.find((e) => e.rank === 1);
  const second = entries.find((e) => e.rank === 2);
  const third = entries.find((e) => e.rank === 3);

  const podium = useMemo((): PodiumEntries => {
    const entry = (e?: LeaderboardEntry) =>
      e ? { name: e.name, label: e.score.toString(), onPress: () => onEntryPress?.(e) } : undefined;
    return { 1: entry(first), 2: entry(second), 3: entry(third) };
  }, [first, second, third, onEntryPress]);

  if (entries.length === 0) return null;
  return <AnimatedPodium token={token} entries={podium} champion={<FloatingMascot crown={true} />} />;
};

const LeaderboardListItem = ({
  entry,
  index = 0,
  animated = true,
  highlighted = false,
  onPress,
}: {
  entry: LeaderboardEntry;
  index?: number;
  animated?: boolean;
  highlighted?: boolean;
  onPress?: () => void;
}) => {
  const translateX = useSharedValue(100);
  const opacity = useSharedValue(0);

  const [key, setKey] = useState(0);

  useEffect(() => {
    translateX.value = 500;
    opacity.value = 0;
    translateX.value = withDelay(index * 50, withTiming(0, { duration: 500 }));
    opacity.value = withDelay(index * 50, withTiming(1, { duration: 500 }));
  }, [index, translateX, opacity, key]);

  useFocusEffect(
    useCallback(() => {
      setKey(Math.random());
    }, []),
  );

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Animated.View style={animated ? style : undefined}>
      <Pressable
        onPress={onPress}
        style={tw.style(
          "flex-row items-center rounded-xl border-2 border-zinc-500/50 bg-zinc-200/50 p-2 dark:bg-zinc-800/50",
          highlighted && "border-zinc-500",
        )}>
        <View style={tw`w-1/10 items-center justify-center rounded-lg`}>
          <Text style={tw`text-xl font-bold`}>#{entry.rank}</Text>
        </View>
        <View style={tw`w-5/10 grow px-2.5`}>
          <Text style={tw`text-xl font-medium`}>{entry.name}</Text>
        </View>
        <View style={tw`w-3/10 flex-row items-center justify-center gap-1.5 rounded-lg bg-sky-500/25`}>
          <ZapIcon size={16} color={tw.color("sky-500")} fill={tw.color("sky-500")} />
          <Text style={tw`text-xl font-bold tracking-tighter text-sky-500`}>{entry.score}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
};

export default function MainLeaderboardScreen() {
  const router = useRouter();

  const [key, setKey] = useState(0);

  const { data: user, isRefetching: isRefetchingUser, refetch: refetchUser } = useCurrentUserQuery();

  const {
    data: leaderboard,
    isRefetching: isRefetchingLeaderboard,
    refetch: refetchLeaderboard,
  } = useLeaderboardQuery();

  useFocusEffect(
    useCallback(() => {
      setKey(Math.random());
    }, []),
  );

  const openProfile = (entry: LeaderboardEntry) =>
    router.navigate(
      {
        pathname: "./profile",
        params: { uid: entry.uid },
      },
      { relativeToDirectory: true },
    );

  return (
    <View style={tw`flex-1 items-center justify-center pt-4`}>
      {user && leaderboard ? (
        <>
          <PodiumView token={key} entries={leaderboard.entries.slice(0, 3)} onEntryPress={openProfile} />
          <FlatList
            data={leaderboard.entries}
            renderItem={({ item, index }) => (
              <LeaderboardListItem
                entry={item}
                index={index}
                highlighted={item.uid === leaderboard.me.uid}
                onPress={() => openProfile(item)}
              />
            )}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                tintColor={tw.color("zinc-500")}
                refreshing={isRefetchingUser || isRefetchingLeaderboard}
                onRefresh={() => {
                  refetchUser();
                  refetchLeaderboard();
                }}
              />
            }
            style={tw`w-full border-b-2 border-zinc-500/50`}
            contentContainerStyle={tw`grow gap-2 p-2`}
            ListHeaderComponent={
              <View style={tw`gap-2`}>
                <View style={tw`flex-row items-stretch gap-2`}>
                  <View
                    style={tw`grow items-center justify-center rounded-xl border-2 border-zinc-500/50 bg-zinc-200 p-2 dark:bg-zinc-800`}>
                    <View style={tw`flex-row items-center gap-1`}>
                      <TrophyIcon size={24} color={tw.color("yellow-500")} fill={tw.color("yellow-500")} />
                      <Text style={tw`text-3xl font-bold text-yellow-500`}>#{leaderboard.me.rank}</Text>
                    </View>
                    <Text style={tw`text-lg font-medium`}>Your Rank</Text>
                  </View>
                  <View
                    style={tw`grow items-center justify-center rounded-xl border-2 border-zinc-500/50 bg-zinc-200 p-2 dark:bg-zinc-800`}>
                    <View style={tw`flex-row items-center gap-1`}>
                      <ZapIcon size={24} color={tw.color("sky-500")} fill={tw.color("sky-500")} />
                      <Text style={tw`text-3xl font-bold text-sky-500`}>{leaderboard.me.score}</Text>
                    </View>
                    <Text style={tw`text-lg font-medium`}>Current Balance</Text>
                  </View>
                  <View
                    style={tw`grow items-center justify-center rounded-xl border-2 border-zinc-500/50 bg-zinc-200 p-2 dark:bg-zinc-800`}>
                    <View style={tw`flex-row items-center gap-1`}>
                      <ZapIcon size={24} color={tw.color("blue-500")} />
                      <Text style={tw`text-3xl font-bold text-blue-500`}>{user.points[0]}</Text>
                    </View>
                    <Text style={tw`text-lg font-medium`}>Gained Today</Text>
                  </View>
                </View>
                <Text style={tw`text-center text-base text-neutral-500`}>
                  Start climbing the global leaderboard by gaining XP!
                </Text>
              </View>
            }
          />
          <View style={tw`w-full p-2`}>
            <LeaderboardListItem entry={leaderboard.me} animated={false} />
          </View>
        </>
      ) : (
        <Spinner size={36} />
      )}
    </View>
  );
}
