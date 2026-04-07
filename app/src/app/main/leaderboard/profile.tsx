import { Pressable, ScrollView, View } from "react-native";
import { useTheme } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FlameIcon, XIcon, ZapIcon } from "lucide-react-native";
import tw from "twrnc";

import { useUserQuery, type User } from "~/client";
import { Heatmap } from "~/components";
import { Spinner, Text } from "~/components/primitives";
import { useNavigationOptions } from "~/hooks";

const Header = ({ user }: { user?: User }) => {
  const theme = useTheme();
  const router = useRouter();
  return (
    <View style={[tw`flex-row items-center justify-between p-4`, { backgroundColor: theme.colors.card }]}>
      <Pressable onPress={() => router.dismiss()} style={({ pressed }) => tw.style(pressed && "opacity-50")}>
        <XIcon color={tw.color("zinc-500")} size={26} strokeWidth={2.5} />
      </Pressable>
      {user && (
        <View style={[tw`absolute inset-x-0 items-center justify-center`]}>
          <Text style={tw`text-2xl font-medium leading-[0]`}>{`@${user.name}`}</Text>
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
  const theme = useTheme();
  return (
    <View style={tw`gap-4 rounded-2xl border-2 border-zinc-500/50 py-2.5`}>
      <View style={tw`flex-row items-center justify-between px-4`}>
        <Text style={tw`text-2xl font-bold`}>Activity</Text>
        <View style={tw`flex-row items-center gap-1`}>
          <Text style={tw`mr-1 text-sm text-neutral-500`}>Less</Text>
          {[...Array(5)].map((_, i) => {
            const step = i + i;
            const intensity = theme.dark ? Math.max(900 - step * 100, 100) : Math.min((step + 1) * 100, 900);
            const color = tw.color(`emerald-${intensity}`);
            return <View key={i} style={[tw`size-3 rounded-sm`, { backgroundColor: color }]} />;
          })}
          <Text style={tw`ml-1 text-sm text-neutral-500`}>More</Text>
        </View>
      </View>
      <Heatmap entries={user.activity} contentContainerStyle={tw`px-4`} disabled={disabled} />
    </View>
  );
};

export default function MainLeaderboardProfileScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();

  const { data: user } = useUserQuery(uid);

  useNavigationOptions({
    header: () => <Header user={user} />,
  });

  if (!user) {
    return (
      <View style={tw`flex-1 items-center justify-center`}>
        <Spinner size={36} />
      </View>
    );
  }
  return (
    <ScrollView alwaysBounceVertical={false} contentContainerStyle={tw`flex-1 gap-4 p-4`}>
      <View style={tw`flex-row gap-4`}>
        <StreakCard user={user} />
        <PointsCard user={user} />
      </View>
      <ActivityCard user={user} disabled={true} />
    </ScrollView>
  );
}
