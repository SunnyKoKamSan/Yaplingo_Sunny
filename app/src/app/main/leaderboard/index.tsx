import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { useRouter } from "expo-router";
import { ZapIcon } from "lucide-react-native";
import tw from "twrnc";

import { useLeaderboardQuery, type LeaderboardEntry } from "~/client";
import { Spinner, Text } from "~/components/primitives";

export default function MainLeaderboardScreen() {
  const router = useRouter();
  const { data: leaderboard, isRefetching, refetch } = useLeaderboardQuery();
  return (
    <View style={tw`flex-1 items-center justify-center`}>
      {leaderboard ? (
        <>
          <FlatList
            data={leaderboard.entries}
            renderItem={({ item }) => (
              <LeaderboardListItem
                entry={item}
                onPress={() =>
                  router.navigate(
                    {
                      pathname: "./profile",
                      params: { uid: item.uid },
                    },
                    { relativeToDirectory: true },
                  )
                }
              />
            )}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
            style={tw`w-full border-b-2 border-zinc-500/50`}
            contentContainerStyle={tw`grow gap-2 p-2`}
          />
          <View style={tw`w-full p-2`}>
            <LeaderboardListItem entry={leaderboard.me} />
          </View>
        </>
      ) : (
        <Spinner size={36} />
      )}
    </View>
  );
}

const LeaderboardListItem = ({ entry, onPress }: { entry: LeaderboardEntry; onPress?: () => void }) => {
  return (
    <Pressable
      onPress={onPress}
      style={tw`flex-row items-center rounded-xl border-2 border-zinc-500/50 bg-zinc-800/50 p-2`}>
      <View style={tw`w-1/10 items-center justify-center rounded-lg`}>
        <Text style={tw`text-xl font-bold`}>{entry.rank}</Text>
      </View>
      <View style={tw`w-5/10 grow gap-0.5 px-2.5`}>
        <Text style={tw`text-xl font-medium`}>{entry.name}</Text>
      </View>
      <View style={tw`w-3/10 flex-row items-center justify-center gap-1.5 rounded-lg bg-sky-500/25`}>
        <ZapIcon size={16} color={tw.color("sky-500")} fill={tw.color("sky-500")} />
        <Text style={tw`text-xl font-bold tracking-tighter text-sky-500`}>{entry.score}</Text>
      </View>
    </Pressable>
  );
};
