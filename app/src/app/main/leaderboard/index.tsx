import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { useFocusEffect, useRouter } from "expo-router";
import { FlameIcon, TrophyIcon, ZapIcon } from "lucide-react-native";
import tw from "twrnc";

import { useCurrentUserQuery, useLeaderboardQuery, type LeaderboardEntry } from "~/client";
import { Spinner, Text } from "~/components/primitives";

const PodiumPillar = ({
  entry,
  place,
  onPress,
}: {
  entry: LeaderboardEntry;
  place: 1 | 2 | 3;
  onPress?: () => void;
}) => {
  const PODIUM_CONFIG = {
    1: { height: 180, color: "green-500", delay: 0 },
    2: { height: 150, color: "blue-500", delay: 100 },
    3: { height: 120, color: "slate-400", delay: 200 },
  } as const;

  const config = PODIUM_CONFIG[place];
  const height = useSharedValue(0);

  const [key, setKey] = useState(Math.random());

  useEffect(() => {
    height.value = 0;
    height.value = withDelay(config.delay, withTiming(config.height, { duration: 750 }));
  }, [config.delay, config.height, height, key]);

  useFocusEffect(
    useCallback(() => {
      setKey(Math.random());
    }, []),
  );

  const style = useAnimatedStyle(() => ({ height: height.value }));

  return (
    <Pressable onPress={onPress} style={tw`flex-1 items-center gap-2`}>
      {place === 1 && <Text style={tw`text-center text-2xl`}>👑</Text>}
      <Text style={tw`text-center text-lg font-bold text-${config.color}`}>{entry.name}</Text>
      <Animated.View
        style={[
          tw`items-center justify-between overflow-hidden rounded-t-xl border-2 border-b-0 p-4`,
          { borderColor: tw.color(config.color), backgroundColor: tw.color(`${config.color}/20`) },
          style,
        ]}>
        <Text style={tw`mt-auto text-5xl font-bold text-${config.color}`}>{place}</Text>
        <View style={tw`mt-auto flex-row items-center gap-1`}>
          <ZapIcon size={14} color={tw.color(config.color)} fill={tw.color(config.color)} />
          <Text style={tw`text-lg font-bold text-${config.color} tracking-tighter`}>{entry.score}</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
};

const PodiumView = ({
  entries,
  onEntryPress,
}: {
  entries: LeaderboardEntry[];
  onEntryPress?: (entry: LeaderboardEntry) => void;
}) => {
  const [first, second, third] = entries;

  return (
    <View style={tw`w-full flex-row items-end gap-2 border-b border-zinc-500/50`}>
      {second && <PodiumPillar entry={second} place={2} onPress={() => onEntryPress?.(second)} />}
      {first && <PodiumPillar entry={first} place={1} onPress={() => onEntryPress?.(first)} />}
      {third && <PodiumPillar entry={third} place={3} onPress={() => onEntryPress?.(third)} />}
    </View>
  );
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

  const [key, setKey] = useState(Math.random());

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

  const { data: user, isRefetching: isRefetchingUser, refetch: refetchUser } = useCurrentUserQuery();

  const {
    data: leaderboard,
    isRefetching: isRefetchingLeaderboard,
    refetch: refetchLeaderboard,
  } = useLeaderboardQuery();

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
          <PodiumView entries={leaderboard.entries.slice(0, 3)} onEntryPress={openProfile} />
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
                    <Text style={tw`text-lg font-medium`}>Current XP</Text>
                  </View>
                  <View
                    style={tw`grow items-center justify-center rounded-xl border-2 border-zinc-500/50 bg-zinc-200 p-2 dark:bg-zinc-800`}>
                    <View style={tw`flex-row items-center gap-1`}>
                      <FlameIcon size={24} color={tw.color("orange-500")} fill={tw.color("orange-500")} />
                      <Text style={tw`text-3xl font-bold text-orange-500`}>{user.streak}</Text>
                    </View>
                    <Text style={tw`text-lg font-medium`}>Day Streak</Text>
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
