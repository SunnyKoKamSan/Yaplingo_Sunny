import { Pressable, ScrollView, View } from "react-native";
import { useTheme } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { XIcon, ZapIcon } from "lucide-react-native";
import tw from "twrnc";

import { useUserQuery, type User } from "~/client";
import { Spinner, Text } from "~/components/primitives";
import { useSetNavigationOptions } from "~/hooks";

import { ActivityCard, ProfileCard, StreakCard } from "../profile";

const Header = () => {
  const theme = useTheme();
  const router = useRouter();
  return (
    <View style={[tw`flex-row items-center justify-between p-4`, { backgroundColor: theme.colors.card }]}>
      <Pressable onPress={() => router.dismiss()} style={({ pressed }) => tw.style(pressed && "opacity-50")}>
        <XIcon color={tw.color("zinc-500")} size={26} strokeWidth={2.5} />
      </Pressable>
      <View style={[tw`absolute inset-x-0 items-center justify-center`]}>
        <Text style={tw`text-2xl font-bold`}>PROFILE CARD</Text>
      </View>
    </View>
  );
};

const PointsCard = ({ user }: { user: User }) => {
  return (
    <View style={tw`grow items-center justify-center rounded-2xl border-2 border-zinc-500/50 p-4`}>
      <View style={tw`flex-row items-center`}>
        <ZapIcon color={tw.color("sky-500")} fill={tw.color("sky-500")} size={36} />
        <Text style={tw`text-5xl font-bold leading-[0] tracking-tighter text-sky-500`}>{user.points.total}</Text>
      </View>
      <Text style={tw`text-center text-xl font-medium text-sky-500`}>XP Points</Text>
    </View>
  );
};

export default function MainLeaderboardProfileScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();

  const { data: user } = useUserQuery(uid);

  useSetNavigationOptions({
    header: () => <Header />,
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
      <ProfileCard user={user} />
      <View style={tw`flex-row gap-4`}>
        <StreakCard user={user} />
        <PointsCard user={user} />
      </View>
      <ActivityCard user={user} disabled={true} />
    </ScrollView>
  );
}
