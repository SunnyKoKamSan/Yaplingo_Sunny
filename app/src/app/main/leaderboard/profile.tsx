import { Pressable, ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FlameIcon, XIcon, ZapIcon } from "lucide-react-native";
import tw from "twrnc";

import { useUserQuery, type User } from "~/client";
import { Heatmap } from "~/components";
import { Spinner, Text } from "~/components/primitives";

const Header = ({ user, onClose }: { user?: User; onClose: () => void }) => {
  return (
    <View style={tw`flex-row items-center justify-between p-4 bg-white dark:bg-zinc-900`}>
      <Pressable onPress={onClose} style={({ pressed }) => tw.style(pressed && "opacity-50")}>
        <XIcon color={tw.color("zinc-500")} size={26} strokeWidth={2.5} />
      </Pressable>
      {user && (
        <View style={tw`absolute inset-x-0 items-center justify-center pointer-events-none`}>
          <Text style={tw`text-2xl font-medium`}>{`@${user.name}`}</Text>
        </View>
      )}
    </View>
  );
};

export const StreakCard = ({ user }: { user: User }) => {
  return (
    <View style={tw`grow items-center justify-center rounded-2xl border-2 border-zinc-500/50 p-4`}>
      <View style={tw`flex-row items-center`}>
        <FlameIcon color={tw.color("orange-500")} fill={tw.color("orange-500")} size={36} />
        <Text style={tw`text-5xl font-bold leading-[0] tracking-tighter text-orange-500`}>{user.streak ?? "-"}</Text>
      </View>
      <Text style={tw`text-center text-xl font-medium text-orange-500`}>Day Streak</Text>
    </View>
  );
};

export const PointsCard = ({ user }: { user: User }) => {
  return (
    <View style={tw`grow items-center justify-center rounded-2xl border-2 border-zinc-500/50 p-4`}>
      <View style={tw`flex-row items-center`}>
        <ZapIcon color={tw.color("sky-500")} fill={tw.color("sky-500")} size={36} />
        <Text style={tw`text-5xl font-bold leading-[0] tracking-tighter text-sky-500`}>{user.points[1]}</Text>
      </View>
      <Text style={tw`text-center text-xl font-medium text-sky-500`}>XP Points</Text>
    </View>
  );
};

export const ActivityCard = ({ user, disabled = false }: { user: User; disabled?: boolean }) => {
  return (
    <View style={tw`gap-4 rounded-2xl border-2 border-zinc-500/50 py-2.5`}>
      <Text style={tw`px-4 text-2xl font-bold`}>Activity</Text>
      <Heatmap entries={user.activity} contentContainerStyle={tw`px-4`} disabled={disabled} />
    </View>
  );
};

export default function MainLeaderboardProfileScreen() {
  const router = useRouter();
  const { uid } = useLocalSearchParams<{ uid: string }>();

  const { data: user } = useUserQuery(uid);

  if (!user) {
    return (
      <View style={tw`flex-1 items-center justify-center`}>
        <Spinner size={36} />
      </View>
    );
  }
  return (
    <View style={tw`flex-1`}>
      <Header user={user} onClose={() => router.dismiss()} />
      <ScrollView alwaysBounceVertical={false} contentContainerStyle={tw`flex-1 gap-4 p-4`}>
        <View style={tw`flex-row gap-4`}>
          <StreakCard user={user} />
          <PointsCard user={user} />
        </View>
        <ActivityCard user={user} disabled={true} />
      </ScrollView>
    </View>
  );
}
