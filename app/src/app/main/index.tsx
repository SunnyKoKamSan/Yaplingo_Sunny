import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@react-navigation/native";
import { CalendarIcon, FlameIcon, ZapIcon } from "lucide-react-native";
import tw from "twrnc";

import { useAuthedUserQuery, type User } from "~/client";
import { Heatmap } from "~/components";
import { Text } from "~/components/primitives";
import { useNavigationOptions } from "~/hooks";
import { formatCompactNumber } from "~/utils";

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
        <View style={tw`flex-row items-center gap-1.5 rounded-full bg-sky-500/25 px-2 py-0.5`}>
          <ZapIcon size={16} color={tw.color("sky-500")} fill={tw.color("sky-500")} />
          <Text style={tw`text-lg font-bold tracking-tighter text-sky-500`}>
            {user ? formatCompactNumber(user.points[1]) : "-"}
          </Text>
        </View>
      </View>
    </View>
  );
};

const StreakCard = ({ user }: { user: User }) => {
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

const MilestoneCard = ({ user }: { user: User }) => {
  const [today, total] = user.points;
  const remaining = user.milestone - user.points[0];
  const progress = Math.round((user.points[0] / user.milestone) * 100);
  return (
    <View style={tw`grow items-center justify-center gap-2 rounded-2xl border-2 border-zinc-500/50 p-4`}>
      {remaining > 0 ? (
        <View>
          <Text style={tw`text-center text-3xl font-bold tracking-tighter text-sky-500`}>{remaining} XP</Text>
          <Text style={tw`text-center text-base font-medium`}>to keep your streak</Text>
        </View>
      ) : (
        <View>
          <Text style={tw`text-center text-3xl font-bold tracking-tighter text-sky-500`}>{user.milestone} XP</Text>
          <Text style={tw`text-center text-lg font-medium`}>Completed</Text>
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

const ActivityCard = ({ user }: { user: User }) => {
  return (
    <View style={tw`gap-4 rounded-2xl border-2 border-zinc-500/50 py-2.5`}>
      <Text style={tw`px-4 text-2xl font-bold`}>Activity</Text>
      <Heatmap entries={user.activity ?? {}} contentContainerStyle={tw`px-4`} />
    </View>
  );
};

export default function MainHomeScreen() {
  const query = useAuthedUserQuery();

  useNavigationOptions({ header: () => <Header user={query.data} /> });

  return (
    <ScrollView alwaysBounceVertical={false} contentContainerStyle={tw`flex-1 gap-4 p-4`}>
      {query.isSuccess && (
        <>
          <View style={tw`flex-row gap-4`}>
            <StreakCard user={query.data} />
            <MilestoneCard user={query.data} />
          </View>
          <ActivityCard user={query.data} />
        </>
      )}
    </ScrollView>
  );
}
