import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@react-navigation/native";
import { CalendarIcon, ZapIcon } from "lucide-react-native";
import tw from "twrnc";

import { useCurrentUserQuery, type User } from "~/client";
import { Spinner, Text } from "~/components/primitives";
import { useNavigationOptions, useTomorrowCountdown } from "~/hooks";
import { formatCompactNumber } from "~/utils";

import { ActivityCard, StreakCard } from "./leaderboard/profile";

const Header = ({ user }: { user?: User }) => {
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
        <View style={tw`flex-row items-center gap-1.5 rounded-full bg-sky-500/25 px-2.5 py-0.5`}>
          <ZapIcon size={16} color={tw.color("sky-500")} fill={tw.color("sky-500")} />
          <Text style={tw`text-lg font-bold tracking-tighter text-sky-500`}>
            {user ? formatCompactNumber(user.points[1]) : "-"}
          </Text>
        </View>
      </View>
    </View>
  );
};

const MilestoneCard = ({ user }: { user: User }) => {
  const [today, total] = user.points;
  const remaining = user.milestone - user.points[0];
  const progress = Math.round((user.points[0] / user.milestone) * 100);

  const countdown = useTomorrowCountdown();

  return (
    <View style={tw`grow items-center justify-center gap-2 rounded-2xl border-2 border-zinc-500/50 p-4`}>
      {remaining > 0 ? (
        <View>
          <Text style={tw`text-center text-3xl font-bold tracking-tighter text-sky-500`}>{remaining} XP</Text>
          <Text style={tw`text-center text-base font-medium`}>to bump your streak</Text>
          {user.streak > 0 && (
            <Text style={tw`text-center text-sm font-medium text-neutral-500`}>streak resets at {countdown}</Text>
          )}
        </View>
      ) : (
        <View>
          <Text style={tw`text-center text-3xl font-bold tracking-tighter text-sky-500`}>{user.milestone} XP</Text>
          <Text style={tw`text-center text-lg font-medium`}>Completed</Text>
          <Text style={tw`text-center text-sm font-medium text-neutral-500`}>next milestone at {countdown}</Text>
        </View>
      )}
      <View style={tw`flex-row items-center justify-center gap-2`}>
        <Text style={tw`text-xs font-medium tracking-tighter text-neutral-500`}>{total - today}</Text>
        <View style={tw`w-32 items-stretch justify-center`}>
          <View style={tw`h-2.5 overflow-hidden rounded bg-zinc-500/50`}>
            <View style={[tw`h-full bg-sky-500`, { width: `${progress}%` }]} />
          </View>
        </View>
        <Text style={tw`text-xs font-medium tracking-tighter text-neutral-500`}>{total - today + user.milestone}</Text>
      </View>
    </View>
  );
};

export default function MainHomeScreen() {
  const { data: user } = useCurrentUserQuery();

  useNavigationOptions({ header: () => <Header user={user} /> });

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
        <MilestoneCard user={user} />
      </View>
      <ActivityCard user={user} />
    </ScrollView>
  );
}
