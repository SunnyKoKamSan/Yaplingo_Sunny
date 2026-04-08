import { useCallback } from "react";
import { Alert, Pressable, View } from "react-native";
import { SvgUri } from "react-native-svg";
import { useTheme } from "@react-navigation/native";
import { useSetAtom } from "jotai";
import { FlameIcon, LogOutIcon } from "lucide-react-native";
import tw from "twrnc";
import { decodeTime } from "ulid";

import { API_URL, useCurrentUserInsightsQuery, useCurrentUserQuery, type User } from "~/client";
import { Heatmap } from "~/components";
import { Spinner, Text } from "~/components/primitives";
import { useNavigationOptions } from "~/hooks";
import { $token } from "~/store";

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

export const ProfileCard = ({ user }: { user: User }) => {
  return (
    <View style={tw`flex-row items-center gap-8 p-4`}>
      <SvgUri width="96px" height="96px" uri={`${API_URL}/user/${user.id}.svg`} />
      <View style={tw`gap-4`}>
        <View style={tw`gap-1`}>
          <Text style={tw`text-3xl font-bold`}>{`@${user.name}`}</Text>
          <Text style={tw`text-sm font-medium tracking-tighter text-neutral-500`}>{user.id}</Text>
        </View>
        <Text style={tw`text-lg font-medium`}>Joined at {new Date(decodeTime(user.id)).toLocaleDateString()}</Text>
      </View>
    </View>
  );
};

export default function MainProfileScreen() {
  const setToken = useSetAtom($token);

  const { data: user } = useCurrentUserQuery();
  const { data: insights } = useCurrentUserInsightsQuery();

  const handleLogout = useCallback(() => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Logout",
        style: "destructive",
        onPress: () => setToken(""),
      },
    ]);
  }, [setToken]);

  useNavigationOptions({
    headerRight: () => (
      <Pressable onPress={handleLogout} style={tw`px-3 py-1`}>
        <LogOutIcon size={24} color={tw.color("red-500")} />
      </Pressable>
    ),
  });

  if (!user) {
    return (
      <View style={tw`flex-1 items-center justify-center`}>
        <Spinner size={36} />
      </View>
    );
  }

  return (
    <View style={tw`flex-1 gap-8 p-4`}>
      <ProfileCard user={user} />
      {insights !== undefined ? (
        <View style={tw`gap-2.5`}>
          <View style={tw`flex-row items-end justify-between`}>
            <Text style={[tw`text-2xl`, { fontFamily: "Feather-Bold" }]}>Insights</Text>
            <Text style={tw`text-sm text-neutral-500`}>based on your performance in last 30 days</Text>
          </View>
          <View style={tw`rounded-xl bg-neutral-200/50 p-4 dark:bg-neutral-800/50`}>
            {insights ? (
              <Text style={tw`text-lg`}>{insights.summary}</Text>
            ) : (
              <Text style={tw`text-center text-lg`}>no data available</Text>
            )}
          </View>
        </View>
      ) : (
        <View style={tw`mt-8 items-center justify-center`}>
          <Spinner size={36} />
        </View>
      )}
    </View>
  );
}
